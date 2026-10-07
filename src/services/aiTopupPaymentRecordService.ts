import { saveAiTopupPayment } from '../repositories/aiTopupPaymentRepository.js'
import type {
	AiTopupPaymentRecord,
	BankInfo,
	PaymentCurrency,
	PaymentProvider,
	PaymentRecordStatus,
} from '../types.js'

export function createAiTopupPaymentId(
	provider: PaymentProvider,
	orderCode: number
) {
	return `ai-topup:${provider}:${orderCode}`
}

export async function createAiTopupPaymentRecord({
	provider,
	orderCode,
	amount,
	currency,
	status,
	description,
	expiresAt,
	providerOrderId,
	providerCaptureId,
	checkoutUrl,
	qrCode,
	bank = {},
	rawProviderData,
}: {
	provider: PaymentProvider
	orderCode: number
	amount: number
	currency: PaymentCurrency
	status: PaymentRecordStatus
	description: string
	expiresAt: string
	providerOrderId?: string
	providerCaptureId?: string
	checkoutUrl?: string
	qrCode?: string
	bank?: BankInfo
	rawProviderData?: AiTopupPaymentRecord['rawProviderData']
}) {
	const now = new Date().toISOString()
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
	})
}

export async function markAiTopupPaymentPaid(
	payment: AiTopupPaymentRecord,
	update: {
		providerCaptureId?: string
		paidAt?: string
		amountPaid?: number
		amountRemaining?: number
		rawProviderStatus?: AiTopupPaymentRecord['rawProviderStatus']
		webhook?: AiTopupPaymentRecord['webhook']
	}
) {
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
	})
}

export async function updateAiTopupPaymentRecord(
	payment: AiTopupPaymentRecord,
	update: Partial<
		Pick<
			AiTopupPaymentRecord,
			| 'status'
			| 'providerOrderId'
			| 'providerCaptureId'
			| 'paidAt'
			| 'amountPaid'
			| 'amountRemaining'
			| 'rawProviderData'
			| 'rawProviderStatus'
			| 'webhook'
		>
	>
) {
	return await saveAiTopupPayment({
		...payment,
		...update,
		updatedAt: new Date().toISOString(),
	})
}
