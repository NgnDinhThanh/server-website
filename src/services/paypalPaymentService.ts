import { config, plans } from '../config.js'
import {
	getOrder,
	getPaymentCreationLock,
	listOrders,
	saveOrder,
	setPaymentCreationLock,
} from '../repositories/orderRepository.js'
import {
	findPaymentByProviderCaptureId,
	findPaymentByProviderOrderId,
	getPayment,
	getPaymentByOrderCode,
} from '../repositories/paymentRepository.js'
import { normalizeInvoice } from './invoiceService.js'
import {
	capturePaypalOrder,
	createPaypalOrder,
	getPaypalOrder,
	verifyPaypalWebhook,
} from './paypalService.js'
import { applyPaidOrderToSubscription } from './subscriptionService.js'
import { resolveCheckoutAccount } from './accountService.js'
import {
	createPaymentRecord,
	markPaymentPaid,
	updatePaymentRecord,
} from './paymentRecordService.js'
import { createHttpError } from '../utils/httpError.js'
import type {
	BuyerSnapshot,
	CheckoutUser,
	CreatePaymentBody,
	Order,
	OrderInvoice,
	PaypalApiObject,
	PaypalWebhookEvent,
	Plan,
	PlanId,
	RequestWithRawBody,
} from '../types.js'

function normalizePlanId(value: unknown): PlanId {
	const raw = String(value || '').trim().toLowerCase()
	if (raw === 'pro-designer' || raw === 'pro designer' || raw === 'pro_designer') {
		return 'pro-designer'
	}
	if (raw === 'premium') return 'premium'
	return 'pro'
}

function parseMonths(value: unknown): number {
	const months = Number(value)
	if (!Number.isSafeInteger(months) || months < 1) {
		throw createHttpError('months must be a positive whole number')
	}
	return months
}

function normalizeCheckoutSessionId(value: unknown): string {
	const sessionId = String(value || '').trim()
	if (!sessionId) return ''
	if (sessionId.length > 120) {
		throw createHttpError('checkoutSessionId is too long')
	}
	return sessionId
}

function createOrderCode(): number {
	const suffix = Math.floor(Math.random() * 1000)
	return Number(`${Date.now()}${suffix}`.slice(3, 15))
}

function createDescription(orderCode: number): string {
	return `OCC${String(orderCode).slice(-6)}`
}

function calculatePaypalAmount(plan: Plan, months: number) {
	const value = (plan.monthlyUsd * months).toFixed(2)
	return {
		amount: Number(value),
		value,
		currency: config.paypal.currency,
	}
}

function createUserKey(user?: CheckoutUser): string {
	return user?.id || user?.email || ''
}

function isFreshPaypalOrder(order: Order, now = Date.now()): boolean {
	const payment = getPayment(order.paymentId)
	if (payment?.provider !== 'paypal') return false
	if (!['CREATED', 'APPROVED', 'PAYER_ACTION_REQUIRED'].includes(order.status)) {
		return false
	}
	const createdAt = Date.parse(order.createdAt || '')
	if (!Number.isFinite(createdAt)) return false
	return now - createdAt <= config.paypal.orderTtlMs
}

function findReusablePaypalOrder({
	checkoutSessionId,
	planId,
	months,
	amount,
	user,
}: {
	checkoutSessionId: string
	planId: PlanId
	months: number
	amount: number
	user: CheckoutUser
}) {
	if (!checkoutSessionId) return null
	const userKey = createUserKey(user)

	return (
		listOrders().find(
			order => {
				const payment = getPayment(order.paymentId)
				return (
					payment?.provider === 'paypal' &&
					order.checkoutSessionId === checkoutSessionId &&
					order.planId === planId &&
					order.months === months &&
					order.amount === amount &&
					createUserKey(order.user) === userKey &&
					isFreshPaypalOrder(order)
				)
			}
		) || null
	)
}

function createPaymentLockKey({
	checkoutSessionId,
	planId,
	months,
	amount,
	user,
}: {
	checkoutSessionId: string
	planId: PlanId
	months: number
	amount: number
	user: CheckoutUser
}): string {
	if (!checkoutSessionId) return ''
	return ['paypal', checkoutSessionId, createUserKey(user), planId, months, amount].join(
		':'
	)
}

function readPaypalCapture(capture: PaypalApiObject) {
	const purchaseUnit = capture.purchase_units?.[0]
	const paymentCapture = purchaseUnit?.payments?.captures?.[0]
	return {
		captureId: String(paymentCapture?.id || ''),
		status: String(capture.status || paymentCapture?.status || ''),
		amountValue: String(paymentCapture?.amount?.value || ''),
		currency: String(paymentCapture?.amount?.currency_code || ''),
		rawCapture: paymentCapture,
	}
}

function assertCapturedAmount(order: Order, capture: PaypalApiObject) {
	const captured = readPaypalCapture(capture)
	const expected = order.amount.toFixed(2)

	if (captured.status !== 'COMPLETED') {
		throw createHttpError(`PayPal capture status is ${captured.status || 'unknown'}`, 409)
	}
	if (captured.currency !== order.currency) {
		throw createHttpError('PayPal capture currency does not match order', 409)
	}
	if (Number(captured.amountValue).toFixed(2) !== expected) {
		throw createHttpError('PayPal capture amount does not match order', 409)
	}

	return captured
}

function activatePaidPaypalOrder(
	order: Order,
	capture: PaypalApiObject,
	captureId: string
) {
	order.status = 'PAID'
	order.activationStatus = 'ACTIVATING'
	order.paidAt = new Date().toISOString()
	order.updatedAt = new Date().toISOString()
	const payment = getPaymentByOrderCode(order.orderCode)
	if (payment) {
		markPaymentPaid(payment, {
			providerCaptureId: captureId,
			paidAt: order.paidAt,
			amountPaid: order.amount,
			amountRemaining: 0,
			rawProviderStatus: capture,
		})
	}
	return applyPaidOrderToSubscription(saveOrder(order))
}

export async function createPaypalPayment(
	body: CreatePaymentBody
): Promise<Order> {
	if (!config.paypal.enabled) {
		throw createHttpError('PayPal payment is disabled', 503)
	}

	const planId = normalizePlanId(body.planId)
	const plan = plans[planId]
	const months = parseMonths(body.months || 1)
	const amount = calculatePaypalAmount(plan, months)
	const checkoutSessionId = normalizeCheckoutSessionId(body.checkoutSessionId)
	const { account, checkoutUser: user, buyerSnapshot } = resolveCheckoutAccount(
		body.user
	)
	const invoice = normalizeInvoice(body.invoice)
	const reusableOrder = findReusablePaypalOrder({
		checkoutSessionId,
		planId,
		months,
		amount: amount.amount,
		user,
	})

	if (reusableOrder) {
		reusableOrder.reused = true
		reusableOrder.invoice = invoice
		reusableOrder.updatedAt = new Date().toISOString()
		return saveOrder(reusableOrder)
	}

	const lockKey = createPaymentLockKey({
		checkoutSessionId,
		planId,
		months,
		amount: amount.amount,
		user,
	})
	const activeCreation = lockKey ? getPaymentCreationLock(lockKey) : null

	if (activeCreation) {
		const order = await activeCreation
		order.reused = true
		order.invoice = invoice
		order.updatedAt = new Date().toISOString()
		return saveOrder(order)
	}

	const creationPromise = createNewPaypalOrder({
		plan,
		planId,
		months,
		amount,
		user,
		accountId: account.accountId,
		buyerSnapshot,
		invoice,
		checkoutSessionId,
	})
	if (lockKey) setPaymentCreationLock(lockKey, creationPromise)

	return creationPromise
}

async function createNewPaypalOrder({
	plan,
	planId,
	months,
	amount,
	user,
	accountId,
	buyerSnapshot,
	invoice,
	checkoutSessionId,
}: {
	plan: Plan
	planId: PlanId
	months: number
	amount: { amount: number; value: string; currency: string }
	user: CheckoutUser
	accountId: string
	buyerSnapshot: BuyerSnapshot
	invoice: OrderInvoice
	checkoutSessionId: string
}) {
	const orderCode = createOrderCode()
	const description = createDescription(orderCode)
	const paypalOrder = await createPaypalOrder({
		orderCode,
		amountValue: amount.value,
		currency: amount.currency,
		description,
		planName: plan.name,
		months,
	})
	const now = new Date().toISOString()
	const expiresAt = new Date(Date.now() + config.paypal.orderTtlMs).toISOString()
	const payment = createPaymentRecord({
		provider: 'paypal',
		orderCode,
		amount: amount.amount,
		currency: 'USD',
		status: paypalOrder.status || 'CREATED',
		description,
		expiresAt,
		providerOrderId: paypalOrder.id,
		rawProviderData: paypalOrder,
	})

	return saveOrder({
		accountId,
		paymentId: payment.paymentId,
		orderCode,
		planId,
		planName: plan.name,
		months,
		amount: amount.amount,
		currency: 'USD',
		user,
		buyerSnapshot,
		invoice,
		checkoutSessionId,
		description,
		status: paypalOrder.status || 'CREATED',
		activationStatus: 'NOT_STARTED',
		createdAt: now,
		updatedAt: now,
		expiresAt,
		reused: false,
	})
}

export async function capturePaypalPayment(
	paypalOrderId: string
): Promise<Order> {
	const payment = findPaymentByProviderOrderId(paypalOrderId)
	const order = payment ? getOrder(payment.orderCode) : undefined
	if (!payment || payment.provider !== 'paypal' || !order) {
		throw createHttpError('PayPal order not found', 404)
	}
	if (order.status === 'PAID' && payment.providerCaptureId) {
		order.reused = true
		order.updatedAt = new Date().toISOString()
		return saveOrder(order)
	}

	const capture = await capturePaypalOrder(paypalOrderId)
	const captured = assertCapturedAmount(order, capture)
	return activatePaidPaypalOrder(order, capture, captured.captureId)
}

export async function getPaypalSyncedOrder(
	orderCode: number | string
): Promise<Order | null> {
	const order = getOrder(orderCode)
	if (!order) return null
	const payment = getPayment(order.paymentId)
	if (payment?.provider !== 'paypal') return order
	if (order.status === 'PAID' || !payment.providerOrderId) return order

	const paypalOrder = await getPaypalOrder(payment.providerOrderId)
	order.status = paypalOrder.status || order.status
	updatePaymentRecord(payment, {
		status: order.status,
		rawProviderStatus: paypalOrder,
	})
	order.updatedAt = new Date().toISOString()
	return saveOrder(order)
}

export async function applyPaypalWebhookUpdate({
	req,
	event,
}: {
	req: RequestWithRawBody
	event: PaypalWebhookEvent
}): Promise<Order | null> {
	const verified = await verifyPaypalWebhook({
		headers: req.headers,
		event,
	})
	if (!verified) {
		throw createHttpError('Invalid PayPal webhook signature', 400)
	}

	const eventType = String(event.event_type || '')
	const resource = event.resource || {}
	const captureId = String(resource.id || '')
	const paypalOrderId = String(
		resource.supplementary_data?.related_ids?.order_id || ''
	)
	const payment =
		(paypalOrderId && findPaymentByProviderOrderId(paypalOrderId)) ||
		(captureId && findPaymentByProviderCaptureId(captureId)) ||
		null
	const order = payment ? getOrder(payment.orderCode) || null : null

	if (!order || !payment || payment.provider !== 'paypal') return null

	updatePaymentRecord(payment, { webhook: event })

	if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
		if (payment.providerCaptureId === captureId && order.status === 'PAID') {
			return saveOrder(order)
		}
		const capture = {
			status: 'COMPLETED',
			purchase_units: [
				{
					payments: {
						captures: [resource],
					},
				},
			],
		}
		const captured = assertCapturedAmount(order, capture)
		return activatePaidPaypalOrder(order, capture, captured.captureId || captureId)
	}

	if (
		eventType === 'PAYMENT.CAPTURE.DENIED' ||
		eventType === 'PAYMENT.CAPTURE.REFUNDED' ||
		eventType === 'CHECKOUT.ORDER.VOIDED'
	) {
		order.status = eventType
		order.activationStatus =
			order.activationStatus === 'ACTIVATED'
				? order.activationStatus
				: 'NOT_STARTED'
		order.updatedAt = new Date().toISOString()
		updatePaymentRecord(payment, {
			status: eventType,
			webhook: event,
		})
		return saveOrder(order)
	}

	if (eventType === 'CHECKOUT.ORDER.APPROVED') {
		order.status = 'APPROVED'
		order.updatedAt = new Date().toISOString()
		updatePaymentRecord(payment, {
			status: 'APPROVED',
			webhook: event,
		})
		return saveOrder(order)
	}

	return saveOrder(order)
}
