import type { SubscriptionEvent } from '../types.js'
import { SubscriptionEventModel } from '../models/SubscriptionEvent.js'

export async function getSubscriptionEvent(
	eventId: string
): Promise<SubscriptionEvent | undefined> {
	return ((await SubscriptionEventModel.findOne({ eventId }).lean()) ||
		undefined) as SubscriptionEvent | undefined
}

export async function getSubscriptionEventByOrderCode(
	orderCode: number | string
): Promise<SubscriptionEvent | undefined> {
	return ((await SubscriptionEventModel.findOne({
		orderCode: Number(orderCode),
	}).lean()) || undefined) as SubscriptionEvent | undefined
}

export async function saveSubscriptionEvent(
	event: SubscriptionEvent
): Promise<SubscriptionEvent> {
	const saved = await SubscriptionEventModel.findOneAndUpdate(
		{ eventId: event.eventId },
		event,
		{ new: true, upsert: true, setDefaultsOnInsert: true }
	).lean()
	return (saved || event) as SubscriptionEvent
}

export async function hasSubscriptionEventForOrder(
	orderCode: number | string
): Promise<boolean> {
	return Boolean(
		await SubscriptionEventModel.exists({ orderCode: Number(orderCode) })
	)
}

export async function listSubscriptionEvents(): Promise<SubscriptionEvent[]> {
	return (await SubscriptionEventModel.find().lean()) as SubscriptionEvent[]
}
