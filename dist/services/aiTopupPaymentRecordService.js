import { saveAiTopupPayment } from '../repositories/aiTopupPaymentRepository.js';
export function createAiTopupPaymentId(provider, orderCode) {
    return `ai-topup:${provider}:${orderCode}`;
}
export async function createAiTopupPaymentRecord({ provider, orderCode, amount, currency, status, description, expiresAt, providerOrderId, providerCaptureId, checkoutUrl, qrCode, bank = {}, rawProviderData, }) {
    const now = new Date().toISOString();
    return await saveAiTopupPayment({
        paymentId: createAiTopupPaymentId(provider, orderCode),
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
export async function markAiTopupPaymentPaid(payment, update) {
    return await saveAiTopupPayment({
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
export async function updateAiTopupPaymentRecord(payment, update) {
    return await saveAiTopupPayment({
        ...payment,
        ...update,
        updatedAt: new Date().toISOString(),
    });
}
