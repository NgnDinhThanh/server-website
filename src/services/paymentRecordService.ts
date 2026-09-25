import { savePayment } from '../repositories/paymentRepository.js'
import type {
	BankInfo,
	PaymentCurrency,
	PaymentProvider,
	PaymentRecord,
	PaymentRecordStatus,
} from '../types.js'

export function createPaymentId(provider: PaymentProvider, orderCode: number) {
	return `${provider}:${orderCode}`
}

export function createPaymentRecord({
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
	rawProviderData?: PaymentRecord['rawProviderData']
}) {
	const now = new Date().toISOString()
	return savePayment({
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
	})
}

export function markPaymentPaid(
	payment: PaymentRecord,
	update: {
		providerCaptureId?: string
		paidAt?: string
		amountPaid?: number
		amountRemaining?: number
		rawProviderStatus?: PaymentRecord['rawProviderStatus']
		webhook?: PaymentRecord['webhook']
	}
) {
	return savePayment({
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

export function updatePaymentRecord(
	payment: PaymentRecord,
	update: Partial<
		Pick<
			PaymentRecord,
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
	return savePayment({
		...payment,
		...update,
		updatedAt: new Date().toISOString(),
	})
}
