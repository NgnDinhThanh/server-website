import type { PaymentRecord } from '../types.js'
import { PaymentModel } from '../models/Payment.js'

function sanitizePayment(payment: PaymentRecord): PaymentRecord {
	const { rawProviderData, rawProviderStatus, webhook, ...stored } = payment
	return stored
}

export async function getPayment(paymentId: string): Promise<PaymentRecord | undefined> {
	return ((await PaymentModel.findOne({ paymentId }).lean()) || undefined) as
		| PaymentRecord
		| undefined
}

export async function getPaymentByOrderCode(
	orderCode: number | string
): Promise<PaymentRecord | undefined> {
	return ((await PaymentModel.findOne({ orderCode: Number(orderCode) }).lean()) ||
		undefined) as PaymentRecord | undefined
}

export async function findPaymentByProviderOrderId(
	providerOrderId: string
): Promise<PaymentRecord | undefined> {
	return ((await PaymentModel.findOne({ providerOrderId }).lean()) ||
		undefined) as PaymentRecord | undefined
}

export async function findPaymentByProviderCaptureId(
	providerCaptureId: string
): Promise<PaymentRecord | undefined> {
	return ((await PaymentModel.findOne({ providerCaptureId }).lean()) ||
		undefined) as PaymentRecord | undefined
}

export async function savePayment(payment: PaymentRecord): Promise<PaymentRecord> {
	const stored = sanitizePayment(payment)
	const saved = await PaymentModel.findOneAndUpdate(
		{ paymentId: stored.paymentId },
		stored,
		{ new: true, upsert: true, setDefaultsOnInsert: true }
	).lean()
	return (saved || stored) as PaymentRecord
}

export async function listPayments(): Promise<PaymentRecord[]> {
	return (await PaymentModel.find().lean()) as PaymentRecord[]
}
