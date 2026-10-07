import { AiTopupOrderModel } from '../models/AiTopupOrder.js';
const aiTopupPaymentCreationLocks = new Map();
function toAiTopupOrder(value) {
    if (!value || typeof value !== 'object')
        return undefined;
    const object = value;
    return object.orderCode ? object : undefined;
}
export async function getAiTopupOrder(orderCode) {
    return toAiTopupOrder(await AiTopupOrderModel.findOne({ orderCode: Number(orderCode) }).lean());
}
export async function saveAiTopupOrder(order) {
    const saved = await AiTopupOrderModel.findOneAndUpdate({ orderCode: order.orderCode }, order, { upsert: true, new: true, setDefaultsOnInsert: true, lean: true });
    return (saved || order);
}
export async function listAiTopupOrders() {
    return (await AiTopupOrderModel.find().lean());
}
export function getAiTopupPaymentCreationLock(key) {
    return aiTopupPaymentCreationLocks.get(key);
}
export function setAiTopupPaymentCreationLock(key, promise) {
    aiTopupPaymentCreationLocks.set(key, promise);
    promise.finally(() => aiTopupPaymentCreationLocks.delete(key));
}
