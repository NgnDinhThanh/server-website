const subscriptionEvents = new Map();
const orderCodeToEventId = new Map();
export function getSubscriptionEvent(eventId) {
    return subscriptionEvents.get(eventId);
}
export function getSubscriptionEventByOrderCode(orderCode) {
    const eventId = orderCodeToEventId.get(String(orderCode));
    return eventId ? subscriptionEvents.get(eventId) : undefined;
}
export function saveSubscriptionEvent(event) {
    subscriptionEvents.set(event.eventId, event);
    orderCodeToEventId.set(String(event.orderCode), event.eventId);
    return event;
}
export function hasSubscriptionEventForOrder(orderCode) {
    return orderCodeToEventId.has(String(orderCode));
}
export function listSubscriptionEvents() {
    return Array.from(subscriptionEvents.values());
}
