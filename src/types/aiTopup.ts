import type { OrderInvoice } from './invoice.js'
import type { InvoiceDeliveryStatus } from './invoice.js'
import type {
	BankInfo,
	PaymentCurrency,
	PaymentProvider,
	PaymentRecordStatus,
} from './payment.js'
import type {
	PayosPaymentLink,
	PayosWebhookData,
	PaypalApiObject,
	PaypalWebhookEvent,
} from './provider.js'
import type { UserSnapshot } from './user.js'

export type AiTopupOrderStatus =
	| 'PENDING_PAYMENT'
	| 'PAID'
	| 'CREDITED'
	| 'CANCELLED'
	| 'EXPIRED'
	| 'REFUNDED'
	| 'FAILED'

export type AiTopupCreditStatus = 'NOT_STARTED' | 'CREDITED' | 'FAILED'

export type AiTopupTokenLedgerType =
	| 'TOPUP_CREDIT'
	| 'USAGE_DEBIT'
	| 'ADJUSTMENT'

export type AiTopupPaymentRecord = {
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

export type AiTopupOrder = {
	userId: string
	paymentId: string
	orderCode: number
	amount: number
	currency: PaymentCurrency
	unitPricePerToken: number
	tokenAmount: number
	invoice: OrderInvoice
	checkoutSessionId: string
	description: string
	status: AiTopupOrderStatus
	creditStatus: AiTopupCreditStatus
	createdAt: string
	updatedAt: string
	expiresAt: string
	paidAt?: string
	creditedAt?: string
	paymentReceiptEmailStatus?: InvoiceDeliveryStatus
	paymentReceiptEmailSentAt?: string | null
	paymentReceiptEmailError?: string | null
	reused: boolean
	userSnapshot: UserSnapshot
}

export type AiTokenLedgerEntry = {
	entryId: string
	userId: string
	orderCode?: number
	paymentId?: string
	type: AiTopupTokenLedgerType
	tokenDelta: number
	balanceAfter: number
	amount?: number
	currency?: PaymentCurrency
	unitPricePerToken?: number
	description: string
	createdAt: string
}

export type AiTokenBalance = {
	userId: string
	availableTokens: number
	updatedAt: string
}

export type CreateAiTopupPaymentBody = {
	amount: number
	currency: PaymentCurrency
	checkoutSessionId?: string
	invoice: unknown
}
