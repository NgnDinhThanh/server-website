import { AiTopupPaymentModel } from '../models/AiTopupPayment.js';
export async function getAiTopupPayment(paymentId) {
    return ((await AiTopupPaymentModel.findOne({ paymentId }).lean()) ||
        undefined);
}
export async function getAiTopupPaymentByOrderCode(orderCode) {
    return ((await AiTopupPaymentModel.findOne({
        orderCode: Number(orderCode),
    }).lean()) || undefined);
}
export async function findAiTopupPaymentByProviderOrderId(providerOrderId) {
    return ((await AiTopupPaymentModel.findOne({ providerOrderId }).lean()) ||
        undefined);
}
export async function findAiTopupPaymentByProviderCaptureId(providerCaptureId) {
    return ((await AiTopupPaymentModel.findOne({ providerCaptureId }).lean()) ||
        undefined);
}
export async function saveAiTopupPayment(payment) {
    const saved = await AiTopupPaymentModel.findOneAndUpdate({ paymentId: payment.paymentId }, payment, { upsert: true, new: true, setDefaultsOnInsert: true, lean: true });
    return (saved || payment);
}
export async function listAiTopupPayments() {
    return (await AiTopupPaymentModel.find().lean());
}
