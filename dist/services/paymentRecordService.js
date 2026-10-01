import { savePayment } from '../repositories/paymentRepository.js';
export function createPaymentId(provider, orderCode) {
    return `${provider}:${orderCode}`;
}
export async function createPaymentRecord({ provider, orderCode, amount, currency, status, description, expiresAt, providerOrderId, providerCaptureId, checkoutUrl, qrCode, bank = {}, rawProviderData, }) {
    const now = new Date().toISOString();
    return await savePayment({
        paymentId: createPaymentId(provider, orderCode),
        orderCode,
        provider,
        providerOrderId,
        providerCaptureId,
        amount,
        currency,
        status,
        description,
        checkoutUrl,
        qrCode,
        bank,
        createdAt: now,
        updatedAt: now,
        expiresAt,
        rawProviderData,
    });
}
export async function markPaymentPaid(payment, update) {
    return await savePayment({
        ...payment,
        status: 'PAID',
        providerCaptureId: update.providerCaptureId || payment.providerCaptureId,
        paidAt: update.paidAt || payment.paidAt || new Date().toISOString(),
        amountPaid: update.amountPaid ?? payment.amountPaid ?? payment.amount,
        amountRemaining: update.amountRemaining ?? payment.amountRemaining ?? 0,
        rawProviderStatus: update.rawProviderStatus || payment.rawProviderStatus,
        webhook: update.webhook || payment.webhook,
        updatedAt: new Date().toISOString(),
    });
}
export async function updatePaymentRecord(payment, update) {
    return await savePayment({
        ...payment,
        ...update,
        updatedAt: new Date().toISOString(),
    });
}
