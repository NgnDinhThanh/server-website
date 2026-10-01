import { plans } from '../config.js'
import {
	getSubscription,
	saveSubscription,
} from '../repositories/subscriptionRepository.js'
import {
	getSubscriptionEventByOrderCode,
	hasSubscriptionEventForOrder,
	saveSubscriptionEvent,
} from '../repositories/subscriptionEventRepository.js'
import { saveOrder } from '../repositories/orderRepository.js'
import { findUserById, saveUser } from '../repositories/userRepository.js'
import { createHttpError } from '../utils/httpError.js'
import type {
	Order,
	PlanId,
	RenewalType,
	SubscriptionSnapshot,
	UserPlan,
} from '../types.js'

function getOrderUserId(order: Order): string {
	if (!order.userId) {
		throw createHttpError('Cannot activate subscription without user', 500)
	}
	return order.userId
}

function addMonths(date: Date, months: number): Date {
	const result = new Date(date.getTime())
	const originalDay = result.getUTCDate()

	result.setUTCDate(1)
	result.setUTCMonth(result.getUTCMonth() + months)

	const lastDayOfTargetMonth = new Date(
		Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
	).getUTCDate()
	result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth))

	return result
}

function isActive(expiresAt: string | null | undefined, now: Date): boolean {
	if (!expiresAt) return false
	const time = Date.parse(expiresAt)
	return Number.isFinite(time) && time > now.getTime()
}

function getRenewalType({
	current,
	planId,
	active,
}: {
	current?: SubscriptionSnapshot
	planId: PlanId
	active: boolean
}): RenewalType {
	if (!current) return 'NEW'
	if (!active) return 'REACTIVATION'
	if (current.planId !== planId) return 'PLAN_CHANGE'
	return 'RENEWAL'
}

export async function applyPaidOrderToSubscription(order: Order): Promise<Order> {
	if (order.status !== 'PAID') return order
	if (order.subscription && (await hasSubscriptionEventForOrder(order.orderCode))) {
		return order
	}
	const existingEvent = await getSubscriptionEventByOrderCode(order.orderCode)
	if (existingEvent) return order

	const userId = getOrderUserId(order)
	const now = new Date()
	const current = await getSubscription(userId)
	const currentIsActive = isActive(current?.expiresAt, now)
	const baseDate =
		current && currentIsActive ? new Date(current.expiresAt) : now
	const expiresAt = addMonths(baseDate, order.months)
	const plan = plans[order.planId]
	const renewalType = getRenewalType({
		current,
		planId: order.planId,
		active: currentIsActive,
	})
	const snapshot: SubscriptionSnapshot = {
		userId,
		planId: order.planId,
		planName: plan.name,
		status: 'ACTIVE',
		startsAt: current && currentIsActive ? current.startsAt : now.toISOString(),
		expiresAt: expiresAt.toISOString(),
		previousPlanId: current?.planId ?? null,
		previousExpiresAt: current?.expiresAt ?? null,
		renewalType,
		appliedMonths: order.months,
		appliedOrderCode: order.orderCode,
		appliedAt: now.toISOString(),
	}

	await saveSubscription(snapshot)
	await saveSubscriptionEvent({
		eventId: `subscription:${order.orderCode}`,
		userId,
		orderCode: order.orderCode,
		paymentId: order.paymentId,
		type: renewalType,
		previousPlanId: current?.planId ?? null,
		previousExpiresAt: current?.expiresAt ?? null,
		newPlanId: order.planId,
		newExpiresAt: snapshot.expiresAt,
		appliedMonths: order.months,
		appliedAt: snapshot.appliedAt,
	})

	order.subscription = snapshot
	order.activationStatus = 'ACTIVATED'
	order.updatedAt = now.toISOString()
	await updateUserPlan(order)
	return saveOrder(order)
}

async function updateUserPlan(order: Order) {
	const user = await findUserById(order.userId)
	if (!user) return
	const plan = plans[order.planId].name as UserPlan
	user.plan = plan
	user.subscriptionExpiresAt = order.subscription?.expiresAt
		? new Date(order.subscription.expiresAt)
		: user.subscriptionExpiresAt
	await saveUser(user)
}
