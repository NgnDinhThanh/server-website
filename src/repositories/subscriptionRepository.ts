import type { SubscriptionSnapshot } from '../types.js'
import { SubscriptionModel } from '../models/Subscription.js'

export async function getSubscription(
	userId: string
): Promise<SubscriptionSnapshot | undefined> {
	return ((await SubscriptionModel.findOne({ userId }).lean()) || undefined) as
		| SubscriptionSnapshot
		| undefined
}

export async function saveSubscription(
	subscription: SubscriptionSnapshot
): Promise<SubscriptionSnapshot> {
	const saved = await SubscriptionModel.findOneAndUpdate(
		{ userId: subscription.userId },
		subscription,
		{ new: true, upsert: true, setDefaultsOnInsert: true }
	).lean()
	return (saved || subscription) as SubscriptionSnapshot
}

export async function listSubscriptions(): Promise<SubscriptionSnapshot[]> {
	return (await SubscriptionModel.find().lean()) as SubscriptionSnapshot[]
}
