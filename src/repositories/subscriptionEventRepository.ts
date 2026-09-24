import type { SubscriptionEvent } from '../types.js'

const subscriptionEvents = new Map<string, SubscriptionEvent>()
const orderCodeToEventId = new Map<string, string>()

export function getSubscriptionEvent(
	eventId: string
): SubscriptionEvent | undefined {
	return subscriptionEvents.get(eventId)
}

export function getSubscriptionEventByOrderCode(
	orderCode: number | string
): SubscriptionEvent | undefined {
	const eventId = orderCodeToEventId.get(String(orderCode))
	return eventId ? subscriptionEvents.get(eventId) : undefined
}

export function saveSubscriptionEvent(
	event: SubscriptionEvent
): SubscriptionEvent {
	subscriptionEvents.set(event.eventId, event)
	orderCodeToEventId.set(String(event.orderCode), event.eventId)
	return event
}

export function hasSubscriptionEventForOrder(
	orderCode: number | string
): boolean {
	return orderCodeToEventId.has(String(orderCode))
}

export function listSubscriptionEvents(): SubscriptionEvent[] {
	return Array.from(subscriptionEvents.values())
}
