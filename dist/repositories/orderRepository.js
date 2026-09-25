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
export function getPaymentCreationLock(key) {
    return paymentCreationLocks.get(key);
}
export function setPaymentCreationLock(key, promise) {
    paymentCreationLocks.set(key, promise);
    promise.then(() => paymentCreationLocks.delete(key), () => paymentCreationLocks.delete(key));
}
