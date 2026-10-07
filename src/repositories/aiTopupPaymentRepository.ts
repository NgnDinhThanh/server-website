import { AiTopupPaymentModel } from '../models/AiTopupPayment.js'
import type { AiTopupPaymentRecord } from '../types.js'

export async function getAiTopupPayment(
	paymentId: string
): Promise<AiTopupPaymentRecord | undefined> {
	return ((await AiTopupPaymentModel.findOne({ paymentId }).lean()) ||
		undefined) as AiTopupPaymentRecord | undefined
}

export async function getAiTopupPaymentByOrderCode(
	orderCode: number | string
): Promise<AiTopupPaymentRecord | undefined> {
	return ((await AiTopupPaymentModel.findOne({
		orderCode: Number(orderCode),
	}).lean()) || undefined) as AiTopupPaymentRecord | undefined
}

export async function findAiTopupPaymentByProviderOrderId(
	providerOrderId: string
): Promise<AiTopupPaymentRecord | undefined> {
	return ((await AiTopupPaymentModel.findOne({ providerOrderId }).lean()) ||
		undefined) as AiTopupPaymentRecord | undefined
}

export async function findAiTopupPaymentByProviderCaptureId(
	providerCaptureId: string
): Promise<AiTopupPaymentRecord | undefined> {
	return ((await AiTopupPaymentModel.findOne({ providerCaptureId }).lean()) ||
		undefined) as AiTopupPaymentRecord | undefined
}

export async function saveAiTopupPayment(
	payment: AiTopupPaymentRecord
): Promise<AiTopupPaymentRecord> {
	const saved = await AiTopupPaymentModel.findOneAndUpdate(
		{ paymentId: payment.paymentId },
		payment,
		{ upsert: true, new: true, setDefaultsOnInsert: true, lean: true }
	)
	return (saved || payment) as AiTopupPaymentRecord
}

export async function listAiTopupPayments(): Promise<AiTopupPaymentRecord[]> {
	return (await AiTopupPaymentModel.find().lean()) as AiTopupPaymentRecord[]
}
