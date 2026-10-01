import type {
	PayosPaymentLink,
	PayosWebhookData,
	PaypalApiObject,
	PaypalWebhookEvent,
} from './provider.js'

export type PaymentProvider = 'payos' | 'paypal'
export type PaymentCurrency = 'VND' | 'USD'

export type PaymentRecordStatus =
	| 'CREATED'
	| 'PENDING'
	| 'PROCESSING'
	| 'APPROVED'
	| 'PAYER_ACTION_REQUIRED'
	| 'PAID'
	| 'COMPLETED'
	| 'FAILED'
	| 'REFUNDED'
	| 'EXPIRED'
	| 'CANCELLED'
	| 'CANCELED'
	| 'VOIDED'
	| 'DENIED'
	| string

export type BankInfo = {
	name?: string
	bin?: string | number
	accountNumber?: string
	accountName?: string
}

export type PaymentRecord = {
	paymentId: string
	orderCode: number
	provider: PaymentProvider
	providerOrderId?: string
	providerCaptureId?: string
	amount: number
	currency: PaymentCurrency
	status: PaymentRecordStatus
	checkoutUrl?: string
	qrCode?: string
	bank: BankInfo
	description: string
	createdAt: string
	updatedAt: string
	expiresAt: string
	paidAt?: string
	amountPaid?: number
	amountRemaining?: number
	rawProviderData?: PayosPaymentLink | PaypalApiObject
	rawProviderStatus?: PayosPaymentLink | PaypalApiObject
	webhook?: PayosWebhookData | PaypalWebhookEvent
}
