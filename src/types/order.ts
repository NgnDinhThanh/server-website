import type { BuyerSnapshot, CheckoutUser } from './account.js'
import type { OrderInvoice } from './invoice.js'
import type { PlanId } from './plan.js'
import type { PaymentCurrency, PaymentStatus } from './payment.js'
import type { SubscriptionSnapshot } from './subscription.js'

export type OrderStatus =
	| 'PENDING_PAYMENT'
	| 'PAID'
	| 'FULFILLED'
	| 'CANCELLED'
	| 'EXPIRED'
	| 'REFUNDED'

export type OrderItemSnapshot = {
	productId: string
	planId: PlanId
	description: string
	quantity: number
	unitPrice: number
	amount: number
	currency: PaymentCurrency
	taxCategory: string | null
	taxRate: number | null
	taxAmount: number | null
}

export type Order = {
	accountId: string
	paymentId: string
	orderCode: number
	planId: PlanId
	planName: string
	items: OrderItemSnapshot[]
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
	createdAt: string
	updatedAt: string
	expiresAt: string
	paidAt?: string
	subscription?: SubscriptionSnapshot
	reused: boolean
}
