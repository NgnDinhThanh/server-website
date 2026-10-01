import { createHttpError } from './httpError.js';
export function getAuthenticatedUserSnapshot(req) {
    const authReq = req;
    const id = String(authReq.userId || authReq.user?._id || '').trim();
    const email = String(authReq.user?.email || '').trim();
    const name = String(authReq.user?.name || '').trim();
    const role = authReq.user?.role;
    const plan = authReq.user?.plan;
    if (!id || !email || !name || typeof role !== 'number' || !plan) {
        throw createHttpError('Authenticated user is required', 401);
    }
    return {
        id,
        email,
        name,
        role,
        plan,
        subscriptionExpiresAt: authReq.user?.subscriptionExpiresAt ?? null,
    };
}
export function assertOrderOwner(req, order) {
    const authReq = req;
    const userId = String(authReq.userId || authReq.user?._id || '').trim();
    if (!userId || order.userId !== userId) {
        throw createHttpError('Order not found', 404);
    }
}
