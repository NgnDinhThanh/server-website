import { createUser, findUserByEmail, findUserById, normalizeUserDocument, saveUser, } from '../repositories/userRepository.js';
import { signAccessToken, signEmailToken, verifyToken } from '../utils/authToken.js';
import { renderEmailTemplate } from '../utils/emailTemplate.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { sendAuthMail } from './authMailerService.js';
function toAuthUserPayload(user) {
    return {
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        ...(user.country ? { country: user.country } : {}),
        emailVerified: user.emailVerified,
        subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}
async function prepareAuthUser(user) {
    normalizeUserDocument(user);
    await saveUser(user);
    return user;
}
function getFrontendUrl() {
    return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}
function getPublicBaseUrl() {
    return (process.env.PUBLIC_BASE_URL ||
        process.env.EMAIL_ACTIVATION_URL ||
        'http://localhost:4000')
        .trim()
        .replace(/\/$/, '');
}
function logAuthStep(scope, step, startedAt) {
    console.log(`[${scope}] ${step}`, { ms: Date.now() - startedAt });
}
export async function register(input) {
    const startedAt = Date.now();
    logAuthStep('authService.register', 'before findUserByEmail', startedAt);
    const existing = await findUserByEmail(input.email);
    logAuthStep('authService.register', 'after findUserByEmail', startedAt);
    if (existing) {
        return { success: false, msg: 'Email already exists', errCls: 'error' };
    }
    logAuthStep('authService.register', 'before hashPassword', startedAt);
    const passwordHash = await hashPassword(input.password);
    logAuthStep('authService.register', 'after hashPassword', startedAt);
    const expiresHours = Number(process.env.EMAIL_VERIFY_EXPIRES_HOURS || 24);
    logAuthStep('authService.register', 'before signEmailToken', startedAt);
    const activationToken = signEmailToken({
        name: input.name,
        email: input.email,
        country: input.country,
        passwordHash,
    }, Number.isFinite(expiresHours) ? expiresHours : 24);
    logAuthStep('authService.register', 'after signEmailToken', startedAt);
    const activationUrl = `${getPublicBaseUrl()}/api/auth/activate?activation_token=${encodeURIComponent(activationToken)}`;
    logAuthStep('authService.register', 'before renderEmailTemplate', startedAt);
    const html = await renderEmailTemplate('auth_action', {
        title: 'Welcome to OneClick',
        message: "You're almost set to start using OneClick. Click the button below to verify your email.",
        buttonText: 'Verify Email',
        url: activationUrl,
    });
    logAuthStep('authService.register', 'after renderEmailTemplate', startedAt);
    logAuthStep('authService.register', 'before sendAuthMail', startedAt);
    await sendAuthMail({
        to: input.email,
        subject: 'Verify your OneClick account',
        html,
    });
    logAuthStep('authService.register', 'after sendAuthMail', startedAt);
    return {
        success: true,
        msg: 'Verification email sent. Please check your inbox.',
        errCls: 'success',
    };
}
export async function activateRegistration(token) {
    let payload;
    try {
        payload = verifyToken(token);
    }
    catch {
        return { success: false, msg: 'Invalid or expired token', errCls: 'error' };
    }
    if (!payload.name || !payload.email || !payload.passwordHash) {
        return { success: false, msg: 'Invalid token payload', errCls: 'error' };
    }
    let user = await findUserByEmail(payload.email);
    if (!user) {
        user = await createUser({
            name: payload.name,
            email: payload.email,
            passwordHash: payload.passwordHash,
            ...(payload.country ? { country: payload.country } : {}),
        });
    }
    user.emailVerified = true;
    await prepareAuthUser(user);
    const accessToken = signAccessToken({
        id: String(user._id),
        role: user.role,
    });
    user.accessToken = accessToken;
    await saveUser(user);
    return {
        success: true,
        msg: 'Account activated successfully',
        errCls: 'success',
        access_token: accessToken,
        user: toAuthUserPayload(user),
    };
}
export async function login(input) {
    const user = await findUserByEmail(input.email);
    if (!user) {
        return { success: false, msg: 'Invalid email or password', errCls: 'error' };
    }
    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
        return { success: false, msg: 'Invalid email or password', errCls: 'error' };
    }
    await prepareAuthUser(user);
    const token = signAccessToken({
        id: String(user._id),
        role: user.role,
    });
    user.accessToken = token;
    await saveUser(user);
    return {
        success: true,
        msg: 'Login successful',
        errCls: 'success',
        access_token: token,
        user: toAuthUserPayload(user),
    };
}
export async function forgotPassword(email) {
    const startedAt = Date.now();
    logAuthStep('authService.forgotPassword', 'before findUserByEmail', startedAt);
    const user = await findUserByEmail(email);
    logAuthStep('authService.forgotPassword', 'after findUserByEmail', startedAt);
    if (!user) {
        return { success: false, msg: 'User not found', errCls: 'error' };
    }
    const expiresHours = Number(process.env.PASSWORD_RESET_EXPIRES_HOURS || 24);
    logAuthStep('authService.forgotPassword', 'before signEmailToken', startedAt);
    const resetToken = signEmailToken({
        id: String(user._id),
        email: user.email,
    }, Number.isFinite(expiresHours) ? expiresHours : 24);
    logAuthStep('authService.forgotPassword', 'after signEmailToken', startedAt);
    const resetUrl = `${getPublicBaseUrl()}/api/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
    logAuthStep('authService.forgotPassword', 'before renderEmailTemplate', startedAt);
    const html = await renderEmailTemplate('auth_action', {
        title: 'Reset Your Password',
        message: 'Click the button below to set a new password.',
        buttonText: 'Reset Password',
        url: resetUrl,
    });
    logAuthStep('authService.forgotPassword', 'after renderEmailTemplate', startedAt);
    logAuthStep('authService.forgotPassword', 'before sendAuthMail', startedAt);
    await sendAuthMail({
        to: user.email,
        subject: 'Reset your OneClick password',
        html,
    });
    logAuthStep('authService.forgotPassword', 'after sendAuthMail', startedAt);
    return {
        success: true,
        msg: 'Password reset link sent to your email',
        errCls: 'success',
    };
}
export async function resetPassword(input) {
    let payload;
    try {
        payload = verifyToken(input.token);
    }
    catch {
        return { success: false, msg: 'Invalid or expired token', errCls: 'error' };
    }
    const user = (payload.id ? await findUserById(payload.id) : null) ||
        (payload.email ? await findUserByEmail(payload.email) : null);
    if (!user) {
        return { success: false, msg: 'User not found', errCls: 'error' };
    }
    user.passwordHash = await hashPassword(input.password);
    user.accessToken = undefined;
    await saveUser(user);
    return {
        success: true,
        msg: 'Password updated successfully',
        errCls: 'text-success',
    };
}
export async function changePassword(input) {
    const user = await findUserById(input.userId);
    if (!user) {
        return { success: false, msg: 'User not found', errCls: 'error' };
    }
    user.passwordHash = await hashPassword(input.password);
    await prepareAuthUser(user);
    const token = signAccessToken({
        id: String(user._id),
        role: user.role,
    });
    user.accessToken = token;
    await saveUser(user);
    return {
        success: true,
        msg: 'Password updated successfully',
        errCls: 'success',
        access_token: token,
        user: toAuthUserPayload(user),
    };
}
export async function logout(userId) {
    const user = await findUserById(userId);
    if (user) {
        user.accessToken = undefined;
        await saveUser(user);
    }
    return { success: true, msg: 'Logged out', errCls: 'success' };
}
