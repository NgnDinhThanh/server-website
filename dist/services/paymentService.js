import { bankNamesByBin, config, plans } from '../config.js';
import { getOrder, getPaymentCreationLock, listOrders, saveOrder, setPaymentCreationLock, } from '../repositories/orderRepository.js';
import { getPaymentByOrderCode } from '../repositories/paymentRepository.js';
import { createPaymentRequest, getPaymentRequest } from './payosService.js';
import { normalizeInvoice } from './invoiceService.js';
import { applyPaidOrderToSubscription } from './subscriptionService.js';
import { resolveCheckoutAccount } from './accountService.js';
import { createPaymentRecord, markPaymentPaid, } from './paymentRecordService.js';
import { createHttpError } from '../utils/httpError.js';
function normalizePlanId(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'pro-designer' || raw === 'pro designer' || raw === 'pro_designer') {
        return 'pro-designer';
    }
    if (raw === 'premium')
        return 'premium';
    return 'pro';
}
function parseMonths(value) {
    const months = Number(value);
    if (!Number.isSafeInteger(months) || months < 1) {
        throw createHttpError('months must be a positive whole number');
    }
    return months;
}
function roundVnd(value) {
    return Math.round(value / config.vndRoundingStep) * config.vndRoundingStep;
}
function calculateAmount(plan, months) {
    return roundVnd(plan.monthlyUsd * months * config.usdToVndRate);
}
function createOrderCode() {
    const suffix = Math.floor(Math.random() * 1000);
    return Number(`${Date.now()}${suffix}`.slice(3, 15));
}
function createDescription(orderCode) {
    return `OCC${String(orderCode).slice(-6)}`;
}
function normalizeCheckoutSessionId(value) {
    const sessionId = String(value || '').trim();
    if (!sessionId)
        return '';
    if (sessionId.length > 120) {
        throw createHttpError('checkoutSessionId is too long');
    }
    return sessionId;
}
function isPendingStatus(status) {
    return ['PENDING', 'PROCESSING'].includes(String(status || '').toUpperCase());
}
function isFreshPendingOrder(order, now = Date.now()) {
    if (!isPendingStatus(order.status))
        return false;
    const createdAt = Date.parse(order.createdAt || '');
    if (!Number.isFinite(createdAt))
        return false;
    return now - createdAt <= config.pendingOrderTtlMs;
}
function findReusablePendingOrder({ checkoutSessionId, planId, months, amount, }) {
    if (!checkoutSessionId)
        return null;
    for (const order of listOrders()) {
        if (order.checkoutSessionId === checkoutSessionId &&
            order.planId === planId &&
            order.months === months &&
            order.amount === amount &&
            isFreshPendingOrder(order)) {
            return order;
        }
    }
    return null;
}
function createUserKey(user) {
    return user?.id || user?.email || '';
}
function findReusableUserPendingOrder({ checkoutSessionId, planId, months, amount, user, }) {
    const userKey = createUserKey(user);
    const order = findReusablePendingOrder({
        checkoutSessionId,
        planId,
        months,
        amount,
    });
    if (!order)
        return null;
    return createUserKey(order.user) === userKey ? order : null;
}
function createPaymentLockKey({ checkoutSessionId, planId, months, amount, user, }) {
    if (!checkoutSessionId)
        return '';
    return [checkoutSessionId, createUserKey(user), planId, months, amount].join(':');
}
function createReturnUrl(orderCode) {
    return `${config.frontendUrl}/?payment=return&orderCode=${orderCode}`;
}
function createCancelUrl(orderCode) {
    return `${config.frontendUrl}/?payment=cancel&orderCode=${orderCode}`;
}
function resolveBankName(paymentLink) {
    return (bankNamesByBin[String(paymentLink.bin)]);
}
export async function createPayment(body) {
    const planId = normalizePlanId(body.planId);
    const plan = plans[planId];
    const months = parseMonths(body.months || 1);
    const amount = calculateAmount(plan, months);
    const checkoutSessionId = normalizeCheckoutSessionId(body.checkoutSessionId);
    const { account, checkoutUser: user, buyerSnapshot } = resolveCheckoutAccount(body.user);
    const invoice = normalizeInvoice(body.invoice);
    const reusableOrder = findReusableUserPendingOrder({
        checkoutSessionId,
        planId,
        months,
        amount,
        user,
    });
    if (reusableOrder) {
        reusableOrder.reused = true;
        reusableOrder.invoice = invoice;
        reusableOrder.updatedAt = new Date().toISOString();
        return saveOrder(reusableOrder);
    }
    const lockKey = createPaymentLockKey({
        checkoutSessionId,
        planId,
        months,
        amount,
        user,
    });
    const activeCreation = lockKey ? getPaymentCreationLock(lockKey) : null;
    if (activeCreation) {
        const order = await activeCreation;
        order.reused = true;
        order.invoice = invoice;
        order.updatedAt = new Date().toISOString();
        return saveOrder(order);
    }
    const creationPromise = createNewPaymentOrder({
        plan,
        planId,
        months,
        amount,
        user,
        accountId: account.accountId,
        buyerSnapshot,
        invoice,
        checkoutSessionId,
    });
    if (lockKey) {
        setPaymentCreationLock(lockKey, creationPromise);
    }
    return creationPromise;
}
async function createNewPaymentOrder({ plan, planId, months, amount, user, accountId, buyerSnapshot, invoice, checkoutSessionId, }) {
    const orderCode = createOrderCode();
    const description = createDescription(orderCode);
    const paymentRequest = {
        orderCode,
        amount,
        description,
        cancelUrl: createCancelUrl(orderCode),
        returnUrl: createReturnUrl(orderCode),
        items: [
            {
                name: `${plan.name} subscription`,
                quantity: months,
                price: amount,
            },
        ],
    };
    const paymentLink = await createPaymentRequest(paymentRequest);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + config.pendingOrderTtlMs).toISOString();
    const payment = createPaymentRecord({
        provider: 'payos',
        orderCode,
        amount,
        currency: 'VND',
        status: paymentLink.status || 'PENDING',
        description,
        expiresAt,
        providerOrderId: paymentLink.paymentLinkId,
        checkoutUrl: paymentLink.checkoutUrl,
        qrCode: paymentLink.qrCode,
        bank: {
            name: resolveBankName(paymentLink),
            bin: paymentLink.bin,
            accountNumber: paymentLink.accountNumber,
            accountName: paymentLink.accountName,
        },
        rawProviderData: paymentLink,
    });
    return saveOrder({
        accountId,
        paymentId: payment.paymentId,
        provider: 'payos',
        orderCode,
        planId,
        planName: plan.name,
        months,
        amount,
        currency: 'VND',
        user,
        buyerSnapshot,
        invoice,
        checkoutSessionId,
        description,
        status: paymentLink.status || 'PENDING',
        activationStatus: 'NOT_STARTED',
        paymentLinkId: paymentLink.paymentLinkId,
        checkoutUrl: paymentLink.checkoutUrl,
        qrCode: paymentLink.qrCode,
        bank: {
            name: resolveBankName(paymentLink),
            bin: paymentLink.bin,
            accountNumber: paymentLink.accountNumber,
            accountName: paymentLink.accountName,
        },
        createdAt: now,
        updatedAt: now,
        expiresAt,
        reused: false,
        rawPaymentLink: paymentLink,
    });
}
export async function syncOrderWithPayos(order) {
    if (!isPendingStatus(order.status))
        return order;
    const paymentLink = await getPaymentRequest(order.orderCode);
    const status = paymentLink.status || order.status;
    const paidTransaction = paymentLink.transactions?.find((transaction) => transaction.amount > 0);
    order.status = status;
    order.amountPaid = paymentLink.amountPaid;
    order.amountRemaining = paymentLink.amountRemaining;
    const payment = getPaymentByOrderCode(order.orderCode);
    if (status === 'PAID' && payment) {
        markPaymentPaid(payment, {
            paidAt: paidTransaction?.transactionDateTime || new Date().toISOString(),
            amountPaid: paymentLink.amountPaid,
            amountRemaining: paymentLink.amountRemaining,
            rawProviderStatus: paymentLink,
        });
    }
    order.activationStatus =
        status === 'PAID' ? 'ACTIVATING' : order.activationStatus;
    order.paidAt =
        status === 'PAID'
            ? paidTransaction?.transactionDateTime ||
                order.paidAt ||
                new Date().toISOString()
            : order.paidAt;
    order.updatedAt = new Date().toISOString();
    order.rawPaymentStatus = paymentLink;
    const savedOrder = saveOrder(order);
    return status === 'PAID' ? applyPaidOrderToSubscription(savedOrder) : savedOrder;
}
export async function getSyncedOrder(orderCode) {
    const order = getOrder(orderCode);
    if (!order)
        return null;
    return syncOrderWithPayos(order);
}
export function applyWebhookPaymentUpdate(data) {
    const orderCode = String(data.orderCode);
    const order = getOrder(orderCode);
    if (!order)
        return null;
    order.status = data.code === '00' ? 'PAID' : data.desc || 'UNKNOWN';
    order.activationStatus =
        order.status === 'PAID' ? 'ACTIVATING' : 'NOT_STARTED';
    order.amountPaid = data.amount;
    order.paidAt = data.transactionDateTime || new Date().toISOString();
    order.updatedAt = new Date().toISOString();
    order.webhook = data;
    const payment = getPaymentByOrderCode(order.orderCode);
    if (order.status === 'PAID' && payment) {
        markPaymentPaid(payment, {
            paidAt: order.paidAt,
            amountPaid: data.amount,
            webhook: data,
        });
    }
    const savedOrder = saveOrder(order);
    return order.status === 'PAID'
        ? applyPaidOrderToSubscription(savedOrder)
        : savedOrder;
}
