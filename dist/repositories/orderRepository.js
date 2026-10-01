import { OrderModel } from '../models/Order.js';
const paymentCreationLocks = new Map();
function toOrder(value) {
    if (!value)
        return undefined;
    const object = typeof value.toObject === 'function'
        ? value.toObject()
        : value;
    return object;
}
export async function getOrder(orderCode) {
    return toOrder(await OrderModel.findOne({ orderCode: Number(orderCode) }).lean());
}
export async function saveOrder(order) {
    const saved = await OrderModel.findOneAndUpdate({ orderCode: order.orderCode }, order, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
    return (saved || order);
}
export async function listOrders() {
    return (await OrderModel.find().lean());
}
export function getPaymentCreationLock(key) {
    return paymentCreationLocks.get(key);
}
export function setPaymentCreationLock(key, promise) {
    paymentCreationLocks.set(key, promise);
    promise.then(() => paymentCreationLocks.delete(key), () => paymentCreationLocks.delete(key));
}
