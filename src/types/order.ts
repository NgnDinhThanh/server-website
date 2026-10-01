import type { OrderInvoice } from './invoice.js'
import type { PlanId } from './plan.js'
import type { PaymentCurrency } from './payment.js'
import type { SubscriptionSnapshot } from './subscription.js'
import type { UserSnapshot } from './user.js'

export type OrderStatus =
	| 'PENDING_PAYMENT'
	| 'PAID'
	| 'ACTIVATED'
	| 'FULFILLED'
	| 'CANCELLED'
	| 'EXPIRED'
	| 'REFUNDED'
	| 'FAILED'

export type ActivationStatus =
	| 'NOT_STARTED'
	| 'PENDING_ADMIN'
	| 'ACTIVATED'
	| 'FAILED'

export type TaxCategory = 'NON_TAXABLE' | 'VAT_ZERO' | 'VAT_RATE'

export type OrderItemSnapshot = {
	productId: string
	planId: PlanId
	description: string
	quantity: number
	unitPrice: number
	amount: number
	currency: PaymentCurrency
	taxCategory: TaxCategory
	taxRate: number | null
	taxAmount: number | null
}

export type Order = {
	userId: string
	paymentId: string
	orderCode: number
	planId: PlanId
	planName: string
	items: OrderItemSnapshot[]
	months: number
	amount: number
	currency: PaymentCurrency
	invoice: OrderInvoice
	checkoutSessionId: string
	description: string
	status: OrderStatus
	activationStatus: ActivationStatus
	createdAt: string
	updatedAt: string
	expiresAt: string
	paidAt?: string
	subscription?: SubscriptionSnapshot
	reused: boolean
	userSnapshot: UserSnapshot
}
