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
import { normalizeInvoice, preparePaidInvoice } from './invoiceService.js'
import {
	capturePaypalOrder,
	createPaypalOrder,
	getPaypalOrder,
	verifyPaypalWebhook,
} from './paypalService.js'
import { createPendingActivationRequest } from './activationRequestService.js'
import {
	createPaymentRecord,
	markPaymentPaid,
	updatePaymentRecord,
} from './paymentRecordService.js'
import { createHttpError } from '../utils/httpError.js'
import type {
	CreatePaymentBody,
	Order,
	OrderInvoice,
	PaypalApiObject,
	PaypalWebhookEvent,
	Plan,
	PlanId,
	RequestWithRawBody,
	OrderItemSnapshot,
	OrderStatus,
	UserSnapshot,
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

function createOrderItems({
	plan,
	planId,
	months,
	amount,
	currency,
}: {
	plan: Plan
	planId: PlanId
	months: number
	amount: number
	currency: 'USD'
}): OrderItemSnapshot[] {
	return [
		{
			productId: 'occ-subscription',
			planId,
			description: `${plan.name} subscription - ${months} month${
				months > 1 ? 's' : ''
			}`,
			quantity: 1,
			unitPrice: amount,
			amount,
			currency,
			taxCategory: 'VAT_ZERO',
			taxRate: 0,
			taxAmount: 0,
		},
	]
}

function toPaypalOrderStatus(providerStatus: unknown): OrderStatus {
	const normalized = String(providerStatus || '').toUpperCase()
	if (normalized === 'COMPLETED') return 'PAID'
	if (normalized.includes('REFUND')) return 'REFUNDED'
	if (normalized.includes('EXPIRE')) return 'EXPIRED'
	if (
		normalized.includes('CANCEL') ||
		normalized.includes('VOID') ||
		normalized.includes('DENIED')
	) {
		return 'CANCELLED'
	}
	if (normalized.includes('FAIL')) return 'FAILED'
	return 'PENDING_PAYMENT'
}

function calculatePaypalAmount(plan: Plan, months: number) {
	const value = (plan.monthlyUsd * months).toFixed(2)
	return {
		amount: Number(value),
		value,
		currency: config.paypal.currency,
	}
}

function createUserKey(user?: UserSnapshot): string {
	return user?.id || user?.email || ''
}

function isFreshPaypalOrder(order: Order, now = Date.now()): boolean {
	if (order.status !== 'PENDING_PAYMENT') {
		return false
	}
	const createdAt = Date.parse(order.createdAt || '')
	if (!Number.isFinite(createdAt)) return false
	return now - createdAt <= config.paypal.orderTtlMs
}

async function findReusablePaypalOrder({
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
	user: UserSnapshot
}): Promise<Order | null> {
	if (!checkoutSessionId) return null
	const userKey = createUserKey(user)

	for (const order of await listOrders()) {
		const payment = await getPayment(order.paymentId)
		if (
			payment?.provider === 'paypal' &&
			order.checkoutSessionId === checkoutSessionId &&
			order.planId === planId &&
			order.months === months &&
			order.amount === amount &&
			createUserKey(order.userSnapshot) === userKey &&
			isFreshPaypalOrder(order)
		) {
			return order
		}
	}

	return null
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
	user: UserSnapshot
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

async function activatePaidPaypalOrder(
	order: Order,
	capture: PaypalApiObject,
	captureId: string
) {
	order.status = 'PAID'
	order.activationStatus = 'PENDING_ADMIN'
	order.paidAt = new Date().toISOString()
	order.updatedAt = new Date().toISOString()
	const payment = await getPaymentByOrderCode(order.orderCode)
	if (payment) {
		await markPaymentPaid(payment, {
			providerCaptureId: captureId,
			paidAt: order.paidAt,
			amountPaid: order.amount,
			amountRemaining: 0,
			rawProviderStatus: capture,
		})
	}
	const savedOrder = await saveOrder(order)
	await createPendingActivationRequest(savedOrder)
	return preparePaidInvoice(savedOrder)
}

export async function createPaypalPayment(
	body: CreatePaymentBody,
	authenticatedUser: UserSnapshot
): Promise<Order> {
	if (!config.paypal.enabled) {
		throw createHttpError('PayPal payment is disabled', 503)
	}

	const planId = normalizePlanId(body.planId)
	const plan = plans[planId]
	const months = parseMonths(body.months || 1)
	const amount = calculatePaypalAmount(plan, months)
	const checkoutSessionId = normalizeCheckoutSessionId(body.checkoutSessionId)
	const user = authenticatedUser
	const invoice = normalizeInvoice(body.invoice)
	const reusableOrder = await findReusablePaypalOrder({
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
	invoice,
	checkoutSessionId,
}: {
	plan: Plan
	planId: PlanId
	months: number
	amount: { amount: number; value: string; currency: string }
	user: UserSnapshot
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
	const payment = await createPaymentRecord({
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
		userId: user.id,
		paymentId: payment.paymentId,
		orderCode,
		planId,
		planName: plan.name,
		items: createOrderItems({
			plan,
			planId,
			months,
			amount: amount.amount,
			currency: 'USD',
		}),
		months,
		amount: amount.amount,
		currency: 'USD',
		userSnapshot: user,
		invoice,
		checkoutSessionId,
		description,
		status: 'PENDING_PAYMENT',
		activationStatus: 'NOT_STARTED',
		createdAt: now,
		updatedAt: now,
		expiresAt,
		reused: false,
	})
}

export async function capturePaypalPayment(
	paypalOrderId: string,
	authenticatedUser: UserSnapshot
): Promise<Order> {
	const payment = await findPaymentByProviderOrderId(paypalOrderId)
	const order = payment ? await getOrder(payment.orderCode) : undefined
	if (!payment || payment.provider !== 'paypal' || !order) {
		throw createHttpError('PayPal order not found', 404)
	}
	if (order.userId !== createUserKey(authenticatedUser)) {
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
	const order = await getOrder(orderCode)
	if (!order) return null
	const payment = await getPayment(order.paymentId)
	if (payment?.provider !== 'paypal') return order
	if (order.status === 'PAID') return preparePaidInvoice(order)
	if (!payment.providerOrderId) return order

	const paypalOrder = await getPaypalOrder(payment.providerOrderId)
	const providerStatus = paypalOrder.status || payment.status || 'CREATED'
	order.status = toPaypalOrderStatus(providerStatus)
	await updatePaymentRecord(payment, {
		status: providerStatus,
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
		(paypalOrderId && (await findPaymentByProviderOrderId(paypalOrderId))) ||
		(captureId && (await findPaymentByProviderCaptureId(captureId))) ||
		null
	const order = payment ? (await getOrder(payment.orderCode)) || null : null

	if (!order || !payment || payment.provider !== 'paypal') return null

	await updatePaymentRecord(payment, { webhook: event })

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
		order.status = toPaypalOrderStatus(eventType)
		order.activationStatus =
			order.activationStatus === 'ACTIVATED'
				? order.activationStatus
				: 'NOT_STARTED'
		order.updatedAt = new Date().toISOString()
		await updatePaymentRecord(payment, {
			status: eventType,
			webhook: event,
		})
		return saveOrder(order)
	}

	if (eventType === 'CHECKOUT.ORDER.APPROVED') {
		order.status = 'PENDING_PAYMENT'
		order.updatedAt = new Date().toISOString()
		await updatePaymentRecord(payment, {
			status: 'APPROVED',
			webhook: event,
		})
		return saveOrder(order)
	}

	return saveOrder(order)
}
