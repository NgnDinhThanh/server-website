const emailRegex = /.+@.+\..+/;
function readString(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function error(msg) {
    return {
        ok: false,
        status: 200,
        body: { success: false, msg, errCls: 'error' },
    };
}
export function validateRegisterRequest(body) {
    const name = readString(body.name);
    const email = readString(body.email).toLowerCase();
    const password = readString(body.password);
    const password2 = readString(body.password2);
    const country = readString(body.country);
    if (!name || !email || !password || !password2 || !country) {
        return error('All fields are required');
    }
    if (!emailRegex.test(email)) {
        return error('Invalid email');
    }
    if (password.length < 6) {
        return error('Password must be at least 6 characters');
    }
    if (password !== password2) {
        return error('Passwords do not match');
    }
    return { ok: true, value: { name, email, password, password2, country } };
}
export function validateLoginRequest(body) {
    const email = readString(body.email).toLowerCase();
    const password = readString(body.password);
    if (!email || !password) {
        return error('Email and password are required');
    }
    return { ok: true, value: { email, password } };
}
export function validateForgotPasswordRequest(body) {
    const email = readString(body.email).toLowerCase();
    if (!email) {
        return error('Email is required');
    }
    if (!emailRegex.test(email)) {
        return error('Invalid email');
    }
    return { ok: true, value: { email } };
}
export function validateResetPasswordRequest(body) {
    const token = readString(body.token);
    const password = readString(body.password);
    const password2 = readString(body.password2);
    if (!token || !password || !password2) {
        return error('All fields are required');
    }
    if (password.length < 6) {
        return error('Password must be at least 6 characters');
    }
    if (password !== password2) {
        return error('Passwords do not match');
    }
    return { ok: true, value: { token, password, password2 } };
}
export function validateChangePasswordRequest(body) {
    const password = readString(body.password);
    const password2 = readString(body.password2);
    if (!password || !password2) {
        return error('All fields are required');
    }
    if (password.length < 6) {
        return error('Password must be at least 6 characters');
    }
    if (password !== password2) {
        return error('Passwords do not match');
    }
    return { ok: true, value: { password, password2 } };
}
