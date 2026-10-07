import { bankNamesByBin, config } from '../config.js';
import { getOrder } from '../repositories/orderRepository.js';
import { getAiTopupOrder, getAiTopupPaymentCreationLock, listAiTopupOrders, saveAiTopupOrder, setAiTopupPaymentCreationLock, } from '../repositories/aiTopupOrderRepository.js';
import { findAiTopupPaymentByProviderOrderId, findAiTopupPaymentByProviderCaptureId, getAiTopupPayment, getAiTopupPaymentByOrderCode, } from '../repositories/aiTopupPaymentRepository.js';
import { normalizeInvoice } from './invoiceService.js';
import { createPaymentRequest, getPaymentRequest, } from './payosService.js';
import { capturePaypalOrder, createPaypalOrder, getPaypalOrder, verifyPaypalWebhook, } from './paypalService.js';
import { createAiTopupPaymentRecord, markAiTopupPaymentPaid, updateAiTopupPaymentRecord, } from './aiTopupPaymentRecordService.js';
import { creditPaidAiTopupOrder } from './aiTopupTokenService.js';
import { refreshAiTopupInvoice } from './aiTopupInvoiceService.js';
import { createHttpError } from '../utils/httpError.js';
function normalizeCurrency(value) {
    const currency = String(value || '').trim().toUpperCase();
    if (currency !== 'VND' && currency !== 'USD') {
        throw createHttpError('currency must be VND or USD');
    }
    return currency;
}
function normalizeAmount(value, currency) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw createHttpError('amount must be a positive number');
    }
    if (currency === 'VND') {
        if (!Number.isSafeInteger(amount)) {
            throw createHttpError('VND amount must be a whole number');
        }
        if (amount < config.aiTopup.minVndAmount) {
            throw createHttpError(`Minimum AI top-up amount is ${config.aiTopup.minVndAmount} VND`);
        }
        return amount;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(String(value))) {
        throw createHttpError('USD amount must have at most 2 decimal places');
    }
    if (amount < config.aiTopup.minUsdAmount) {
        throw createHttpError(`Minimum AI top-up amount is ${config.aiTopup.minUsdAmount} USD`);
    }
    return Number(amount.toFixed(2));
}
function resolveUnitPricePerToken(currency) {
    return currency === 'VND'
        ? config.aiTopup.vndUnitPricePerToken
        : config.aiTopup.usdUnitPricePerToken;
}
function calculateTokenAmount(amount, currency) {
    const unitPrice = resolveUnitPricePerToken(currency);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw createHttpError('AI top-up unit price must be a positive number', 500);
    }
    return Math.floor(amount / unitPrice);
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
async function createOrderCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const suffix = Math.floor(Math.random() * 1000);
        const orderCode = Number(`${Date.now()}${suffix}`.slice(3, 15));
        const existingSubscriptionOrder = await getOrder(orderCode);
        const existingAiTopupOrder = await getAiTopupOrder(orderCode);
        if (!existingSubscriptionOrder && !existingAiTopupOrder)
            return orderCode;
    }
    throw createHttpError('Unable to create unique AI top-up order code', 500);
}
function createDescription(orderCode) {
    return `OCCAI${String(orderCode).slice(-6)}`;
}
function createReturnUrl(orderCode) {
    return `${config.frontendUrl}/?aiTopup=return&orderCode=${orderCode}`;
}
function createCancelUrl(orderCode) {
    return `${config.frontendUrl}/?aiTopup=cancel&orderCode=${orderCode}`;
}
function createUserKey(user) {
    return user?.id || user?.email || '';
}
function isFreshPendingOrder(order, now = Date.now()) {
    if (order.status !== 'PENDING_PAYMENT')
        return false;
    const createdAt = Date.parse(order.createdAt || '');
    if (!Number.isFinite(createdAt))
        return false;
    return now - createdAt <= config.pendingOrderTtlMs;
}
async function findReusableAiTopupOrder({ checkoutSessionId, amount, currency, tokenAmount, user, provider, }) {
    if (!checkoutSessionId)
        return null;
    const userKey = createUserKey(user);
    for (const order of await listAiTopupOrders()) {
        const payment = await getAiTopupPayment(order.paymentId);
        if (payment?.provider === provider &&
            order.checkoutSessionId === checkoutSessionId &&
            order.amount === amount &&
            order.currency === currency &&
            order.tokenAmount === tokenAmount &&
            createUserKey(order.userSnapshot) === userKey &&
            isFreshPendingOrder(order)) {
            return order;
        }
    }
    return null;
}
function createPaymentLockKey({ checkoutSessionId, amount, currency, tokenAmount, user, provider, }) {
    if (!checkoutSessionId)
        return '';
    return [
        'ai-topup',
        provider,
        checkoutSessionId,
        createUserKey(user),
        currency,
        amount,
        tokenAmount,
    ].join(':');
}
function resolveBankName(paymentLink) {
    return bankNamesByBin[String(paymentLink.bin)];
}
function toProviderOrderStatus(providerStatus) {
    const normalized = String(providerStatus || '').toUpperCase();
    if (normalized === 'PAID' || normalized === 'COMPLETED')
        return 'PAID';
    if (normalized.includes('REFUND'))
        return 'REFUNDED';
    if (normalized.includes('EXPIRE'))
        return 'EXPIRED';
    if (normalized.includes('CANCEL') ||
        normalized.includes('VOID') ||
        normalized.includes('DENIED')) {
        return 'CANCELLED';
    }
    if (normalized.includes('FAIL'))
        return 'FAILED';
    return 'PENDING_PAYMENT';
}
function readPaypalCapture(capture) {
    const purchaseUnit = capture.purchase_units?.[0];
    const paymentCapture = purchaseUnit?.payments?.captures?.[0];
    return {
        captureId: String(paymentCapture?.id || ''),
        status: String(capture.status || paymentCapture?.status || ''),
        amountValue: String(paymentCapture?.amount?.value || ''),
        currency: String(paymentCapture?.amount?.currency_code || ''),
        rawCapture: paymentCapture,
    };
}
function assertCapturedAmount(order, capture) {
    const captured = readPaypalCapture(capture);
    const expected = order.amount.toFixed(2);
    if (captured.status !== 'COMPLETED') {
        throw createHttpError(`PayPal capture status is ${captured.status || 'unknown'}`, 409);
    }
    if (captured.currency !== order.currency) {
        throw createHttpError('PayPal capture currency does not match AI top-up order', 409);
    }
    if (Number(captured.amountValue).toFixed(2) !== expected) {
        throw createHttpError('PayPal capture amount does not match AI top-up order', 409);
    }
    return captured;
}
async function markAiTopupPaid(order, captureOrStatus, update) {
    order.status = 'PAID';
    order.paidAt = update?.paidAt || order.paidAt || new Date().toISOString();
    order.updatedAt = new Date().toISOString();
    const payment = await getAiTopupPaymentByOrderCode(order.orderCode);
    if (payment) {
        await markAiTopupPaymentPaid(payment, {
            providerCaptureId: update?.providerCaptureId,
            paidAt: order.paidAt,
            amountPaid: update?.amountPaid ?? order.amount,
            amountRemaining: update?.amountRemaining ?? 0,
            rawProviderStatus: captureOrStatus,
        });
    }
    const savedOrder = await saveAiTopupOrder(order);
    return creditPaidAiTopupOrder(savedOrder);
}
function normalizeTopupBody(body) {
    const currency = normalizeCurrency(body.currency);
    const amount = normalizeAmount(body.amount, currency);
    const tokenAmount = calculateTokenAmount(amount, currency);
    if (tokenAmount < 1) {
        throw createHttpError('AI top-up amount does not buy any tokens');
    }
    return {
        currency,
        amount,
        tokenAmount,
        unitPricePerToken: resolveUnitPricePerToken(currency),
        checkoutSessionId: normalizeCheckoutSessionId(body.checkoutSessionId),
        invoice: normalizeInvoice(body.invoice),
    };
}
export async function createAiTopupDomesticPayment(body, user) {
    const topup = normalizeTopupBody(body);
    if (topup.currency !== 'VND') {
        throw createHttpError('Domestic AI top-up payment requires VND');
    }
    const reusableOrder = await findReusableAiTopupOrder({
        ...topup,
        user,
        provider: 'payos',
    });
    if (reusableOrder) {
        reusableOrder.reused = true;
        reusableOrder.invoice = topup.invoice;
        reusableOrder.updatedAt = new Date().toISOString();
        return saveAiTopupOrder(reusableOrder);
    }
    const lockKey = createPaymentLockKey({
        ...topup,
        user,
        provider: 'payos',
    });
    const activeCreation = lockKey ? getAiTopupPaymentCreationLock(lockKey) : null;
    if (activeCreation) {
        const order = await activeCreation;
        order.reused = true;
        order.invoice = topup.invoice;
        order.updatedAt = new Date().toISOString();
        return saveAiTopupOrder(order);
    }
    const creationPromise = createNewAiTopupDomesticOrder(topup, user);
    if (lockKey)
        setAiTopupPaymentCreationLock(lockKey, creationPromise);
    return creationPromise;
}
async function createNewAiTopupDomesticOrder(topup, user) {
    const orderCode = await createOrderCode();
    const description = createDescription(orderCode);
    const paymentLink = await createPaymentRequest({
        orderCode,
        amount: topup.amount,
        description,
        cancelUrl: createCancelUrl(orderCode),
        returnUrl: createReturnUrl(orderCode),
        items: [
            {
                name: 'AI token top-up',
                quantity: 1,
                price: topup.amount,
            },
        ],
    });
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + config.pendingOrderTtlMs).toISOString();
    const payment = await createAiTopupPaymentRecord({
        provider: 'payos',
        orderCode,
        amount: topup.amount,
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
    return saveAiTopupOrder({
        userId: user.id,
        paymentId: payment.paymentId,
        orderCode,
        amount: topup.amount,
        currency: 'VND',
        unitPricePerToken: topup.unitPricePerToken,
        tokenAmount: topup.tokenAmount,
        invoice: topup.invoice,
        checkoutSessionId: topup.checkoutSessionId,
        description,
        status: 'PENDING_PAYMENT',
        creditStatus: 'NOT_STARTED',
        createdAt: now,
        updatedAt: now,
        expiresAt,
        reused: false,
        userSnapshot: user,
    });
}
export async function createAiTopupPaypalPayment(body, user) {
    if (!config.paypal.enabled) {
        throw createHttpError('PayPal payment is disabled', 503);
    }
    const topup = normalizeTopupBody(body);
    if (topup.currency !== 'USD') {
        throw createHttpError('PayPal AI top-up payment requires USD');
    }
    const reusableOrder = await findReusableAiTopupOrder({
        ...topup,
        user,
        provider: 'paypal',
    });
    if (reusableOrder) {
        reusableOrder.reused = true;
        reusableOrder.invoice = topup.invoice;
        reusableOrder.updatedAt = new Date().toISOString();
        return saveAiTopupOrder(reusableOrder);
    }
    const lockKey = createPaymentLockKey({
        ...topup,
        user,
        provider: 'paypal',
    });
    const activeCreation = lockKey ? getAiTopupPaymentCreationLock(lockKey) : null;
    if (activeCreation) {
        const order = await activeCreation;
        order.reused = true;
        order.invoice = topup.invoice;
        order.updatedAt = new Date().toISOString();
        return saveAiTopupOrder(order);
    }
    const creationPromise = createNewAiTopupPaypalOrder(topup, user);
    if (lockKey)
        setAiTopupPaymentCreationLock(lockKey, creationPromise);
    return creationPromise;
}
async function createNewAiTopupPaypalOrder(topup, user) {
    const orderCode = await createOrderCode();
    const description = createDescription(orderCode);
    const amountValue = topup.amount.toFixed(2);
    const paypalOrder = await createPaypalOrder({
        orderCode,
        amountValue,
        currency: 'USD',
        description,
        planName: 'AI token top-up',
        months: 1,
        itemName: 'AI token top-up',
        itemQuantity: 1,
        itemUnitAmountValue: amountValue,
    });
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + config.paypal.orderTtlMs).toISOString();
    const payment = await createAiTopupPaymentRecord({
        provider: 'paypal',
        orderCode,
        amount: topup.amount,
        currency: 'USD',
        status: paypalOrder.status || 'CREATED',
        description,
        expiresAt,
        providerOrderId: paypalOrder.id,
        rawProviderData: paypalOrder,
    });
    return saveAiTopupOrder({
        userId: user.id,
        paymentId: payment.paymentId,
        orderCode,
        amount: topup.amount,
        currency: 'USD',
        unitPricePerToken: topup.unitPricePerToken,
        tokenAmount: topup.tokenAmount,
        invoice: topup.invoice,
        checkoutSessionId: topup.checkoutSessionId,
        description,
        status: 'PENDING_PAYMENT',
        creditStatus: 'NOT_STARTED',
        createdAt: now,
        updatedAt: now,
        expiresAt,
        reused: false,
        userSnapshot: user,
    });
}
export async function syncAiTopupDomesticOrder(order) {
    if (order.status !== 'PENDING_PAYMENT')
        return order;
    const paymentLink = await getPaymentRequest(order.orderCode);
    const providerStatus = paymentLink.status || 'PENDING';
    const orderStatus = toProviderOrderStatus(providerStatus);
    const payment = await getAiTopupPaymentByOrderCode(order.orderCode);
    const paidTransaction = paymentLink.transactions?.find((transaction) => transaction.amount > 0);
    if (orderStatus === 'PAID') {
        return markAiTopupPaid(order, paymentLink, {
            paidAt: paidTransaction?.transactionDateTime || new Date().toISOString(),
            amountPaid: paymentLink.amountPaid,
            amountRemaining: paymentLink.amountRemaining,
        });
    }
    order.status = orderStatus;
    order.updatedAt = new Date().toISOString();
    if (payment) {
        await updateAiTopupPaymentRecord(payment, {
            status: providerStatus,
            rawProviderStatus: paymentLink,
        });
    }
    return saveAiTopupOrder(order);
}
export async function getSyncedAiTopupOrder(orderCode) {
    const order = await getAiTopupOrder(orderCode);
    if (!order)
        return null;
    const payment = await getAiTopupPayment(order.paymentId);
    if (payment?.provider === 'payos') {
        const syncedOrder = await syncAiTopupDomesticOrder(order);
        return refreshAiTopupInvoice(syncedOrder);
    }
    if (payment?.provider !== 'paypal')
        return refreshAiTopupInvoice(order);
    if (order.status !== 'PENDING_PAYMENT')
        return refreshAiTopupInvoice(order);
    if (!payment.providerOrderId)
        return order;
    const paypalOrder = await getPaypalOrder(payment.providerOrderId);
    const providerStatus = paypalOrder.status || payment.status || 'CREATED';
    order.status = toProviderOrderStatus(providerStatus);
    order.updatedAt = new Date().toISOString();
    await updateAiTopupPaymentRecord(payment, {
        status: providerStatus,
        rawProviderStatus: paypalOrder,
    });
    return refreshAiTopupInvoice(await saveAiTopupOrder(order));
}
export async function captureAiTopupPaypalPayment(paypalOrderId, user) {
    const payment = await findAiTopupPaymentByProviderOrderId(paypalOrderId);
    const order = payment ? await getAiTopupOrder(payment.orderCode) : undefined;
    if (!payment || payment.provider !== 'paypal' || !order) {
        throw createHttpError('AI top-up PayPal order not found', 404);
    }
    if (order.userId !== user.id) {
        throw createHttpError('AI top-up PayPal order not found', 404);
    }
    if ((order.status === 'PAID' || order.status === 'CREDITED') &&
        payment.providerCaptureId) {
        order.reused = true;
        order.updatedAt = new Date().toISOString();
        return saveAiTopupOrder(order);
    }
    const capture = await capturePaypalOrder(paypalOrderId);
    const captured = assertCapturedAmount(order, capture);
    return markAiTopupPaid(order, capture, {
        providerCaptureId: captured.captureId,
        amountPaid: order.amount,
        amountRemaining: 0,
    });
}
export async function applyAiTopupPayosWebhookPaymentUpdate(data) {
    const order = await getAiTopupOrder(String(data.orderCode || ''));
    if (!order)
        return null;
    const providerStatus = data.code === '00' ? 'PAID' : data.desc || 'FAILED';
    const orderStatus = toProviderOrderStatus(providerStatus);
    const payment = await getAiTopupPaymentByOrderCode(order.orderCode);
    if (orderStatus === 'PAID') {
        return markAiTopupPaid(order, data, {
            paidAt: data.transactionDateTime || new Date().toISOString(),
            amountPaid: data.amount,
        });
    }
    order.status = orderStatus;
    order.updatedAt = new Date().toISOString();
    if (payment) {
        await updateAiTopupPaymentRecord(payment, {
            status: providerStatus,
            webhook: data,
        });
    }
    return saveAiTopupOrder(order);
}
export async function applyAiTopupPaypalWebhookUpdate({ req, event, }) {
    const verified = await verifyPaypalWebhook({
        headers: req.headers,
        event,
    });
    if (!verified) {
        throw createHttpError('Invalid PayPal webhook signature', 400);
    }
    const eventType = String(event.event_type || '');
    const resource = event.resource || {};
    const captureId = String(resource.id || '');
    const paypalOrderId = String(resource.supplementary_data?.related_ids?.order_id || '');
    const payment = (paypalOrderId && (await findAiTopupPaymentByProviderOrderId(paypalOrderId))) ||
        (captureId && (await findAiTopupPaymentByProviderCaptureId(captureId))) ||
        null;
    const order = payment ? (await getAiTopupOrder(payment.orderCode)) || null : null;
    if (!order || !payment || payment.provider !== 'paypal')
        return null;
    await updateAiTopupPaymentRecord(payment, { webhook: event });
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        if (payment.providerCaptureId === captureId && order.status === 'CREDITED') {
            return saveAiTopupOrder(order);
        }
        const capture = {
            status: 'COMPLETED',
            purchase_units: [
                {
                    payments: {
                        captures: [resource],
                    },
                },
            ],
        };
        const captured = assertCapturedAmount(order, capture);
        return markAiTopupPaid(order, capture, {
            providerCaptureId: captured.captureId || captureId,
            amountPaid: order.amount,
            amountRemaining: 0,
        });
    }
    if (eventType === 'PAYMENT.CAPTURE.DENIED' ||
        eventType === 'PAYMENT.CAPTURE.REFUNDED' ||
        eventType === 'CHECKOUT.ORDER.VOIDED') {
        order.status = toProviderOrderStatus(eventType);
        order.updatedAt = new Date().toISOString();
        await updateAiTopupPaymentRecord(payment, {
            status: eventType,
            webhook: event,
        });
        return saveAiTopupOrder(order);
    }
    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
        order.status = 'PENDING_PAYMENT';
        order.updatedAt = new Date().toISOString();
        await updateAiTopupPaymentRecord(payment, {
            status: 'APPROVED',
            webhook: event,
        });
        return saveAiTopupOrder(order);
    }
    return saveAiTopupOrder(order);
}
