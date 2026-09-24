const subscriptions = new Map();
export function getSubscription(accountId) {
    return subscriptions.get(accountId);
}
export function saveSubscription(subscription) {
    subscriptions.set(subscription.accountId, subscription);
    return subscription;
}
export function listSubscriptions() {
    return Array.from(subscriptions.values());
}
