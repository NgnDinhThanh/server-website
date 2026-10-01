import { PaymentModel } from '../models/Payment.js';
function sanitizePayment(payment) {
    const { rawProviderData, rawProviderStatus, webhook, ...stored } = payment;
    return stored;
}
export async function getPayment(paymentId) {
    return ((await PaymentModel.findOne({ paymentId }).lean()) || undefined);
}
export async function getPaymentByOrderCode(orderCode) {
    return ((await PaymentModel.findOne({ orderCode: Number(orderCode) }).lean()) ||
        undefined);
}
export async function findPaymentByProviderOrderId(providerOrderId) {
    return ((await PaymentModel.findOne({ providerOrderId }).lean()) ||
        undefined);
}
export async function findPaymentByProviderCaptureId(providerCaptureId) {
    return ((await PaymentModel.findOne({ providerCaptureId }).lean()) ||
        undefined);
}
export async function savePayment(payment) {
    const stored = sanitizePayment(payment);
    const saved = await PaymentModel.findOneAndUpdate({ paymentId: stored.paymentId }, stored, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
    return (saved || stored);
}
export async function listPayments() {
    return (await PaymentModel.find().lean());
}
