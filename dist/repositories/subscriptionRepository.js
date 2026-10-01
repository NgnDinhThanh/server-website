import { SubscriptionModel } from '../models/Subscription.js';
export async function getSubscription(userId) {
    return ((await SubscriptionModel.findOne({ userId }).lean()) || undefined);
}
export async function saveSubscription(subscription) {
    const saved = await SubscriptionModel.findOneAndUpdate({ userId: subscription.userId }, subscription, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
    return (saved || subscription);
}
export async function listSubscriptions() {
    return (await SubscriptionModel.find().lean());
}
