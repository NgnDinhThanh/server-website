import { publicOrder } from '../presenters/orderPresenter.js';
import { getSyncedOrder } from '../services/paymentService.js';
export async function getInvoiceStatus(req, res, next) {
    try {
        const order = await getSyncedOrder(String(req.params.orderCode || ''));
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        res.json(publicOrder(order));
    }
    catch (error) {
        next(error);
    }
}
