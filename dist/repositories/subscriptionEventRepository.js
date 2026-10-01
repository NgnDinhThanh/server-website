import { SubscriptionEventModel } from '../models/SubscriptionEvent.js';
export async function getSubscriptionEvent(eventId) {
    return ((await SubscriptionEventModel.findOne({ eventId }).lean()) ||
        undefined);
}
export async function getSubscriptionEventByOrderCode(orderCode) {
    return ((await SubscriptionEventModel.findOne({
        orderCode: Number(orderCode),
    }).lean()) || undefined);
}
export async function saveSubscriptionEvent(event) {
    const saved = await SubscriptionEventModel.findOneAndUpdate({ eventId: event.eventId }, event, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
    return (saved || event);
}
export async function hasSubscriptionEventForOrder(orderCode) {
    return Boolean(await SubscriptionEventModel.exists({ orderCode: Number(orderCode) }));
}
export async function listSubscriptionEvents() {
    return (await SubscriptionEventModel.find().lean());
}
