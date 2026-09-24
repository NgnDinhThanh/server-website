import type { PaymentRecord } from '../types.js'

const payments = new Map<string, PaymentRecord>()

export function getPayment(paymentId: string): PaymentRecord | undefined {
	return payments.get(paymentId)
}

export function getPaymentByOrderCode(
	orderCode: number | string
): PaymentRecord | undefined {
	return Array.from(payments.values()).find(
		payment => String(payment.orderCode) === String(orderCode)
	)
}

export function findPaymentByProviderOrderId(
	providerOrderId: string
): PaymentRecord | undefined {
	return Array.from(payments.values()).find(
		payment => payment.providerOrderId === providerOrderId
	)
}

export function findPaymentByProviderCaptureId(
	providerCaptureId: string
): PaymentRecord | undefined {
	return Array.from(payments.values()).find(
		payment => payment.providerCaptureId === providerCaptureId
	)
}

export function savePayment(payment: PaymentRecord): PaymentRecord {
	payments.set(payment.paymentId, payment)
	return payment
}

export function listPayments(): PaymentRecord[] {
	return Array.from(payments.values())
}
