const orders = new Map();
const paymentCreationLocks = new Map();
export function getOrder(orderCode) {
    return orders.get(String(orderCode));
}
export function saveOrder(order) {
    orders.set(String(order.orderCode), order);
    return order;
}
export function listOrders() {
    return Array.from(orders.values());
}
export function findOrderByProviderOrderId(providerOrderId) {
    return listOrders().find(order => order.providerOrderId === providerOrderId);
}
export function findOrderByProviderCaptureId(providerCaptureId) {
    return listOrders().find(order => order.providerCaptureId === providerCaptureId);
}
export function getPaymentCreationLock(key) {
    return paymentCreationLocks.get(key);
}
export function setPaymentCreationLock(key, promise) {
    paymentCreationLocks.set(key, promise);
    promise.then(() => paymentCreationLocks.delete(key), () => paymentCreationLocks.delete(key));
}
