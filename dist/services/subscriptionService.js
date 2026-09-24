import { plans } from '../config.js';
import { getSubscription, saveSubscription, } from '../repositories/subscriptionRepository.js';
import { getSubscriptionEventByOrderCode, hasSubscriptionEventForOrder, saveSubscriptionEvent, } from '../repositories/subscriptionEventRepository.js';
import { saveOrder } from '../repositories/orderRepository.js';
import { createHttpError } from '../utils/httpError.js';
function getAccountId(order) {
    if (!order.accountId) {
        throw createHttpError('Cannot activate subscription without account', 500);
    }
    return order.accountId;
}
function addMonths(date, months) {
    const result = new Date(date.getTime());
    const originalDay = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + months);
    const lastDayOfTargetMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
    return result;
}
function isActive(expiresAt, now) {
    if (!expiresAt)
        return false;
    const time = Date.parse(expiresAt);
    return Number.isFinite(time) && time > now.getTime();
}
function getRenewalType({ current, planId, active, }) {
    if (!current)
        return 'NEW';
    if (!active)
        return 'REACTIVATION';
    if (current.planId !== planId)
        return 'PLAN_CHANGE';
    return 'RENEWAL';
}
export function applyPaidOrderToSubscription(order) {
    if (order.status !== 'PAID')
        return order;
    if (order.subscription && hasSubscriptionEventForOrder(order.orderCode))
        return order;
    const existingEvent = getSubscriptionEventByOrderCode(order.orderCode);
    if (existingEvent)
        return order;
    const accountId = getAccountId(order);
    const now = new Date();
    const current = getSubscription(accountId);
    const currentIsActive = isActive(current?.expiresAt, now);
    const baseDate = current && currentIsActive ? new Date(current.expiresAt) : now;
    const expiresAt = addMonths(baseDate, order.months);
    const plan = plans[order.planId];
    const renewalType = getRenewalType({
        current,
        planId: order.planId,
        active: currentIsActive,
    });
    const snapshot = {
        userId: accountId,
        accountId,
        planId: order.planId,
        planName: plan.name,
        status: 'ACTIVE',
        startsAt: current && currentIsActive ? current.startsAt : now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        previousPlanId: current?.planId ?? null,
        previousExpiresAt: current?.expiresAt ?? null,
        renewalType,
        appliedMonths: order.months,
        appliedOrderCode: order.orderCode,
        appliedAt: now.toISOString(),
    };
    saveSubscription(snapshot);
    saveSubscriptionEvent({
        eventId: `subscription:${order.orderCode}`,
        accountId,
        orderCode: order.orderCode,
        paymentId: order.paymentId,
        type: renewalType,
        previousPlanId: current?.planId ?? null,
        previousExpiresAt: current?.expiresAt ?? null,
        newPlanId: order.planId,
        newExpiresAt: snapshot.expiresAt,
        appliedMonths: order.months,
        appliedAt: snapshot.appliedAt,
    });
    order.subscription = snapshot;
    order.activationStatus = 'ACTIVATED';
    order.updatedAt = now.toISOString();
    return saveOrder(order);
}
