import { publicAiTopupOrder } from '../presenters/aiTopupPresenter.js';
import { captureAiTopupPaypalPayment as captureAiTopupPaypalPaymentService, createAiTopupDomesticPayment, createAiTopupPaypalPayment, getSyncedAiTopupOrder, } from '../services/aiTopupPaymentService.js';
import { sendAiTopupInvoiceEmail } from '../services/aiTopupInvoiceService.js';
import { getAuthenticatedUserSnapshot, } from '../utils/authenticatedRequest.js';
import { createHttpError } from '../utils/httpError.js';
function assertAiTopupOwner(req, order) {
    const authReq = req;
    const userId = String(authReq.userId || authReq.user?._id || '').trim();
    if (!userId || order.userId !== userId) {
        throw createHttpError('AI top-up order not found', 404);
    }
}
export async function createDomesticAiTopupPayment(req, res, next) {
    try {
        const order = await createAiTopupDomesticPayment(req.body, getAuthenticatedUserSnapshot(req));
        const response = await publicAiTopupOrder(order);
        if (response.reused)
            return res.json(response);
        res.status(201).json(response);
    }
    catch (error) {
        next(error);
    }
}
export async function createPaypalAiTopupPayment(req, res, next) {
    try {
        const order = await createAiTopupPaypalPayment(req.body, getAuthenticatedUserSnapshot(req));
        const response = await publicAiTopupOrder(order);
        if (response.reused)
            return res.json(response);
        res.status(201).json(response);
    }
    catch (error) {
        next(error);
    }
}
export async function captureAiTopupPaypalPayment(req, res, next) {
    try {
        const order = await captureAiTopupPaypalPaymentService(String(req.params.paypalOrderId || ''), getAuthenticatedUserSnapshot(req));
        res.json(await publicAiTopupOrder(order));
    }
    catch (error) {
        next(error);
    }
}
export async function getAiTopupPaymentStatus(req, res, next) {
    try {
        const order = await getSyncedAiTopupOrder(String(req.params.orderCode || ''));
        if (!order)
            return res.status(404).json({ error: 'AI top-up order not found' });
        assertAiTopupOwner(req, order);
        res.json(await publicAiTopupOrder(order));
    }
    catch (error) {
        next(error);
    }
}
export async function sendAiTopupOrderInvoiceEmail(req, res, next) {
    try {
        const order = await getSyncedAiTopupOrder(String(req.params.orderCode || ''));
        if (!order)
            return res.status(404).json({ error: 'AI top-up order not found' });
        assertAiTopupOwner(req, order);
        const email = typeof req.body?.email === 'string'
            ? req.body.email
            : typeof req.body?.receiverEmail === 'string'
                ? req.body.receiverEmail
                : '';
        const updatedOrder = await sendAiTopupInvoiceEmail(order, email);
        res.json(await publicAiTopupOrder(updatedOrder));
    }
    catch (error) {
        next(error);
    }
}
