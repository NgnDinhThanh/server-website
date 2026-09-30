import { config } from '../config.js';
import { getAccount } from '../repositories/accountRepository.js';
import { getPayment } from '../repositories/paymentRepository.js';
function toOrderStatus(status) {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'PAID')
        return 'PAID';
    if (normalized.includes('REFUNDED'))
        return 'REFUNDED';
    if (normalized.includes('CANCELLED') ||
        normalized.includes('CANCELED') ||
        normalized.includes('VOIDED') ||
        normalized.includes('DENIED')) {
        return 'CANCELLED';
    }
    if (normalized.includes('EXPIRED'))
        return 'EXPIRED';
    return 'PENDING_PAYMENT';
}
export function publicOrder(order) {
    const invoice = order.invoice;
    const account = getAccount(order.accountId);
    const payment = getPayment(order.paymentId);
    if (!payment) {
        throw new Error(`Payment record not found for order ${order.orderCode}`);
    }
    return {
        orderCode: order.orderCode,
        accountId: order.accountId,
        account: account
            ? {
                accountId: account.accountId,
                email: account.email,
                name: account.name,
            }
            : null,
        buyerSnapshot: order.buyerSnapshot,
        planId: order.planId,
        planName: order.planName,
        months: order.months,
        amount: order.amount,
        currency: order.currency,
        description: order.description,
        orderStatus: toOrderStatus(order.status),
        status: order.status,
        activationStatus: order.activationStatus,
        payment: {
            paymentId: payment.paymentId,
            orderCode: payment.orderCode,
            provider: payment.provider,
            providerOrderId: payment.providerOrderId,
            providerCaptureId: payment.providerCaptureId,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            checkoutUrl: payment.checkoutUrl,
            qrCode: payment.qrCode,
            bank: payment.bank,
            paidAt: payment.paidAt,
            amountPaid: payment.amountPaid,
            amountRemaining: payment.amountRemaining,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt,
            expiresAt: payment.expiresAt,
        },
        user: order.user,
        items: order.items ?? [],
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        expiresAt: order.expiresAt,
        paidAt: order.paidAt,
        subscription: order.subscription ?? null,
        invoiceProvider: invoice?.provider,
        invoiceRequested: invoice?.requested,
        invoiceStatus: invoice?.status,
        invoicePreviewUrl: invoice?.previewUrl ?? null,
        invoiceDownloadUrl: invoice?.downloadUrl ?? null,
        invoiceNumber: invoice?.invoiceNumber ?? null,
        invoiceIssuedAt: invoice?.issuedAt ?? null,
        invoiceError: invoice?.error ?? null,
        invoiceDeliveryEmail: invoice?.deliveryEmail ?? null,
        invoiceEmailDeliveryRequested: invoice?.emailDeliveryRequested ?? false,
        invoiceEmailSentAt: invoice?.emailSentAt ?? null,
        invoiceEmailError: invoice?.emailError ?? null,
        invoiceMisaRefId: invoice?.misa.refId ?? null,
        invoiceMisaTransactionId: invoice?.misa.transactionId ?? null,
        invoiceMisaInvoiceId: invoice?.misa.invoiceId ?? null,
        invoiceMisaPublishStatus: invoice?.misa.publishStatus ?? null,
        invoiceMisaSendTaxStatus: invoice?.misa.sendTaxStatus ?? null,
        invoiceMisaTaxAuthorityCode: invoice?.misa.taxAuthorityCode ?? null,
        reused: Boolean(order.reused),
        isForcedTestAmount: Boolean(config.forcedTestAmount),
    };
}
