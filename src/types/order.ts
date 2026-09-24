import type { BuyerSnapshot, CheckoutUser } from './account.js'
import type { OrderInvoice } from './invoice.js'
import type { PlanId } from './plan.js'
import type {
	BankInfo,
	PaymentCurrency,
	PaymentProvider,
	PaymentStatus,
} from './payment.js'
import type {
	PayosPaymentLink,
	PayosWebhookData,
	PaypalApiObject,
	PaypalWebhookEvent,
} from './provider.js'
import type { SubscriptionSnapshot } from './subscription.js'

export type OrderStatus =
	| 'PENDING_PAYMENT'
	| 'PAID'
	| 'FULFILLED'
	| 'CANCELLED'
	| 'EXPIRED'

export type Order = {
	accountId: string
	paymentId: string
	provider: PaymentProvider
	orderCode: number
	planId: PlanId
	planName: string
	months: number
	amount: number
	currency: PaymentCurrency
	user: CheckoutUser
	buyerSnapshot: BuyerSnapshot
	invoice: OrderInvoice
	checkoutSessionId: string
	description: string
	status: PaymentStatus
	activationStatus: string
	providerOrderId?: string
	providerCaptureId?: string
	paymentLinkId?: string
	checkoutUrl?: string
	qrCode?: string
	bank: BankInfo
	createdAt: string
	updatedAt: string
	expiresAt: string
	paidAt?: string
	amountPaid?: number
	amountRemaining?: number
	subscription?: SubscriptionSnapshot
	reused: boolean
	rawPaymentLink?: PayosPaymentLink
	rawPaymentStatus?: PayosPaymentLink
	rawPaypalOrder?: PaypalApiObject
	rawPaypalCapture?: PaypalApiObject
	webhook?: PayosWebhookData
	paypalWebhook?: PaypalWebhookEvent
}
