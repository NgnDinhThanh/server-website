import { plans } from '../config.js'
import {
	getActivationRequest,
	getActivationRequestByOrderCode,
	listActivationRequests,
	saveActivationRequest,
} from '../repositories/activationRequestRepository.js'
import { getPayment } from '../repositories/paymentRepository.js'
import { getSubscription } from '../repositories/subscriptionRepository.js'
import { getOrder, saveOrder } from '../repositories/orderRepository.js'
import { createHttpError } from '../utils/httpError.js'
import { renderEmailTemplate } from '../utils/emailTemplate.js'
import { applyPaidOrderToSubscription } from './subscriptionService.js'
import { sendAuthMail } from './authMailerService.js'
import type {
	Order,
	PlanId,
	RenewalType,
	SubscriptionActivationRequest,
	UserSnapshot,
} from '../types.js'

function isActive(expiresAt: string | null | undefined, now: Date) {
	if (!expiresAt) return false
	const time = Date.parse(expiresAt)
	return Number.isFinite(time) && time > now.getTime()
}

async function renewalTypeForOrder(order: Order): Promise<RenewalType> {
	const current = await getSubscription(order.userId)
	const active = isActive(current?.expiresAt, new Date())
	if (!current) return 'NEW'
	if (!active) return 'REACTIVATION'
	if (current.planId !== order.planId) return 'PLAN_CHANGE'
	return 'RENEWAL'
}

export async function createPendingActivationRequest(order: Order) {
	if (order.status !== 'PAID') {
		throw createHttpError('Cannot create activation request before payment is paid', 409)
	}

	const existing = await getActivationRequestByOrderCode(order.orderCode)
	if (existing) return existing

	const payment = await getPayment(order.paymentId)
	if (!payment) {
		throw createHttpError(`Payment record not found for order ${order.orderCode}`, 500)
	}

	const current = await getSubscription(order.userId)
	const now = new Date().toISOString()
	const request: SubscriptionActivationRequest = {
		requestId: `activation:${order.orderCode}`,
		userId: order.userId,
		user: order.userSnapshot,
		orderCode: order.orderCode,
		paymentId: order.paymentId,
		planId: order.planId,
		planName: order.planName,
		months: order.months,
		amount: order.amount,
		currency: order.currency,
		paymentProvider: payment.provider,
		status: 'PENDING',
		renewalType: await renewalTypeForOrder(order),
		previousPlanId: current?.planId ?? null,
		previousExpiresAt: current?.expiresAt ?? null,
		requestedAt: now,
		activatedAt: null,
		activatedByUserId: null,
	}

	order.activationStatus = 'PENDING_ADMIN'
	order.updatedAt = now
	await saveOrder(order)
	const savedRequest = await saveActivationRequest(request)
	await sendPaymentReceivedEmail(order.userSnapshot, order)
	return savedRequest
}

export async function listPendingActivationRequests() {
	return (await listActivationRequests()).sort((a, b) =>
		b.requestedAt.localeCompare(a.requestedAt)
	)
}

export async function activateSubscriptionRequest({
	requestId,
	adminUser,
}: {
	requestId: string
	adminUser: UserSnapshot
}) {
	if (adminUser.role !== 0 && adminUser.role !== 1) {
		throw createHttpError('Admin privileges are required', 403)
	}

	const request = await getActivationRequest(requestId)
	if (!request) throw createHttpError('Activation request not found', 404)
	if (request.status !== 'PENDING') {
		throw createHttpError('Activation request is not pending', 409)
	}

	const order = await getOrder(request.orderCode)
	if (!order) throw createHttpError('Order not found', 404)
	if (order.status !== 'PAID') {
		throw createHttpError('Order payment is not completed', 409)
	}

	const activatedOrder = await applyPaidOrderToSubscription(order)
	const activatedAt = new Date().toISOString()
	request.status = 'ACTIVATED'
	request.activatedAt = activatedAt
	request.activatedByUserId = adminUser.id
	await saveActivationRequest(request)

	await sendActivationCompletedEmail(activatedOrder.userSnapshot, activatedOrder)
	return {
		request,
		order: activatedOrder,
	}
}

async function sendActivationCompletedEmail(user: UserSnapshot, order: Order) {
	const html = await renderEmailTemplate('auth_action', {
		title: 'OneClick subscription activated',
		message: `Your ${plans[order.planId].name} subscription has been activated. Please sign in again if your account still shows the previous plan.`,
		buttonText: 'Open OneClick',
		url: process.env.FRONTEND_URL || 'http://localhost:5173',
	})

	await sendAuthMail({
		to: user.email,
		subject: 'Your OneClick subscription is active',
		html,
	})
}

async function sendPaymentReceivedEmail(user: UserSnapshot, order: Order) {
	const html = await renderEmailTemplate('auth_action', {
		title: 'OneClick payment received',
		message: `We received your payment for ${plans[order.planId].name}. Your subscription is waiting for activation by our team.`,
		buttonText: 'Open OneClick',
		url: process.env.FRONTEND_URL || 'http://localhost:5173',
	})

	await sendAuthMail({
		to: user.email,
		subject: 'We received your OneClick payment',
		html,
	})
}
