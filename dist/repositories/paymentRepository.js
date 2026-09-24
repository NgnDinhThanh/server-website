const payments = new Map();
export function getPayment(paymentId) {
    return payments.get(paymentId);
}
export function getPaymentByOrderCode(orderCode) {
    return Array.from(payments.values()).find(payment => String(payment.orderCode) === String(orderCode));
}
export function findPaymentByProviderOrderId(providerOrderId) {
    return Array.from(payments.values()).find(payment => payment.providerOrderId === providerOrderId);
}
export function findPaymentByProviderCaptureId(providerCaptureId) {
    return Array.from(payments.values()).find(payment => payment.providerCaptureId === providerCaptureId);
}
export function savePayment(payment) {
    payments.set(payment.paymentId, payment);
    return payment;
}
export function listPayments() {
    return Array.from(payments.values());
}
