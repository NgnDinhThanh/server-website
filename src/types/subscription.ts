import type { PlanId } from './plan.js'

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED'
export type RenewalType = 'NEW' | 'RENEWAL' | 'REACTIVATION' | 'PLAN_CHANGE'

export type SubscriptionSnapshot = {
	userId: string
	planId: PlanId
	planName: string
	status: SubscriptionStatus
	startsAt: string
	expiresAt: string
	previousPlanId: PlanId | null
	previousExpiresAt: string | null
	renewalType: RenewalType
	appliedMonths: number
	appliedOrderCode: number
	appliedAt: string
}

export type SubscriptionEvent = {
	eventId: string
	userId: string
	orderCode: number
	paymentId?: string
	type: RenewalType
	previousPlanId: PlanId | null
	previousExpiresAt: string | null
	newPlanId: PlanId
	newExpiresAt: string
	appliedMonths: number
	appliedAt: string
}
