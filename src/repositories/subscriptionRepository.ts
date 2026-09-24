import type { SubscriptionSnapshot } from '../types.js'

const subscriptions = new Map<string, SubscriptionSnapshot>()

export function getSubscription(
	accountId: string
): SubscriptionSnapshot | undefined {
	return subscriptions.get(accountId)
}

export function saveSubscription(
	subscription: SubscriptionSnapshot
): SubscriptionSnapshot {
	subscriptions.set(subscription.accountId, subscription)
	return subscription
}

export function listSubscriptions(): SubscriptionSnapshot[] {
	return Array.from(subscriptions.values())
}
