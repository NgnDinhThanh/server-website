import { publicOrder } from '../presenters/orderPresenter.js';
import { createPayment, getSyncedOrder, updatePendingOrderInvoice, } from '../services/paymentService.js';
import { assertOrderOwner, getAuthenticatedUserSnapshot, } from '../utils/authenticatedRequest.js';
export async function createDomesticPayment(req, res, next) {
    try {
        const order = await createPayment(req.body, getAuthenticatedUserSnapshot(req));
        const response = await publicOrder(order);
        if (response.reused) {
            return res.json(response);
        }
        res.status(201).json(response);
    }
    catch (error) {
        next(error);
    }
}
export async function getPaymentStatus(req, res, next) {
    try {
        const order = await getSyncedOrder(String(req.params.orderCode || ''));
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        assertOrderOwner(req, order);
        res.json(await publicOrder(order));
    }
    catch (error) {
        next(error);
    }
}
export async function updatePaymentInvoice(req, res, next) {
    try {
        const existingOrder = await getSyncedOrder(String(req.params.orderCode || ''));
        if (!existingOrder)
            return res.status(404).json({ error: 'Order not found' });
        assertOrderOwner(req, existingOrder);
        const order = await updatePendingOrderInvoice(String(req.params.orderCode || ''), req.body?.invoice);
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        res.json(await publicOrder(order));
    }
    catch (error) {
        next(error);
    }
}
