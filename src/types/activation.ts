import type { PaymentCurrency, PaymentProvider } from './payment.js'
import type { PlanId } from './plan.js'
import type { RenewalType } from './subscription.js'
import type { UserSnapshot } from './user.js'

export type ActivationRequestStatus =
	| 'PENDING'
	| 'ACTIVATED'
	| 'REJECTED'
	| 'EXPIRED'

export type SubscriptionActivationRequest = {
	requestId: string
	userId: string
	user: UserSnapshot
	orderCode: number
	paymentId: string
	planId: PlanId
	planName: string
	months: number
	amount: number
	currency: PaymentCurrency
	paymentProvider: PaymentProvider
	status: ActivationRequestStatus
	renewalType: RenewalType
	previousPlanId: PlanId | null
	previousExpiresAt: string | null
	requestedAt: string
	activatedAt: string | null
	activatedByUserId: string | null
}
