import { UserModel } from '../models/User.js';
import { USER_ROLE } from '../types.js';
const USER_PLANS = ['Free', 'Pro Designer', 'Pro', 'Premium'];
function isUserPlan(value) {
    return typeof value === 'string' && USER_PLANS.includes(value);
}
function isUserRole(value) {
    return value === 0 || value === 1 || value === 2;
}
export function normalizeUserDocument(user) {
    const legacyRole = user.role;
    if (!isUserRole(legacyRole)) {
        user.plan = isUserPlan(legacyRole) ? legacyRole : user.plan || 'Free';
        user.role = USER_ROLE.CUSTOMER;
    }
    if (!isUserPlan(user.plan)) {
        user.plan = 'Free';
    }
    if (typeof user.subscriptionExpiresAt === 'undefined') {
        user.subscriptionExpiresAt = null;
    }
    return user;
}
export function findUserByEmail(email) {
    return UserModel.findOne({ email: email.toLowerCase() });
}
export function findUserById(id) {
    return UserModel.findById(id);
}
export function createUser(input) {
    return UserModel.create({
        ...input,
        email: input.email.toLowerCase(),
        role: USER_ROLE.CUSTOMER,
        plan: 'Free',
        subscriptionExpiresAt: null,
        emailVerified: true,
    });
}
export function saveUser(user) {
    return user.save();
}
