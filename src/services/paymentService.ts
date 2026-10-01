import { bankNamesByBin, config, plans } from '../config.js'
import {
	getOrder,
	getPaymentCreationLock,
	listOrders,
	saveOrder,
	setPaymentCreationLock,
} from '../repositories/orderRepository.js'
import { getPayment, getPaymentByOrderCode } from '../repositories/paymentRepository.js'
import { createPaymentRequest, getPaymentRequest } from './payosService.js'
import { normalizeInvoice, preparePaidInvoice } from './invoiceService.js'
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
	PayosPaymentLink,
	PayosWebhookData,
	Plan,
	PlanId,
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

function roundVnd(value: number): number {
	return Math.round(value / config.vndRoundingStep) * config.vndRoundingStep
}

function calculateAmount(plan: Plan, months: number): number {
	return roundVnd(plan.monthlyUsd * months * config.usdToVndRate)
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
}: {
	plan: Plan
	planId: PlanId
	months: number
	amount: number
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
			currency: 'VND',
			taxCategory: 'NON_TAXABLE',
			taxRate: null,
			taxAmount: null,
		},
	]
}

function normalizeCheckoutSessionId(value: unknown): string {
	const sessionId = String(value || '').trim()
	if (!sessionId) return ''
	if (sessionId.length > 120) {
		throw createHttpError('checkoutSessionId is too long')
	}
	return sessionId
}

function isPendingStatus(status: unknown): boolean {
	return ['PENDING_PAYMENT'].includes(String(status || '').toUpperCase())
}

function toPayosOrderStatus(providerStatus: unknown): OrderStatus {
	const normalized = String(providerStatus || '').toUpperCase()
	if (normalized === 'PAID') return 'PAID'
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

function canUpdateInvoiceSnapshot(status: unknown): boolean {
	const normalized = String(status || '').toUpperCase()
	return ![
		'PAID',
		'FULFILLED',
		'CANCELLED',
		'CANCELED',
		'EXPIRED',
		'REFUNDED',
		'FAILED',
	].includes(normalized)
}

function isFreshPendingOrder(order: Order, now = Date.now()): boolean {
	if (!isPendingStatus(order.status)) return false
	const createdAt = Date.parse(order.createdAt || '')
	if (!Number.isFinite(createdAt)) return false
	return now - createdAt <= config.pendingOrderTtlMs
}

async function findReusablePendingOrder({
	checkoutSessionId,
	planId,
	months,
	amount,
}: {
	checkoutSessionId: string
	planId: PlanId
	months: number
	amount: number
}): Promise<Order | null> {
	if (!checkoutSessionId) return null

	for (const order of await listOrders()) {
		const payment = await getPayment(order.paymentId)
		if (
			payment?.provider === 'payos' &&
			order.checkoutSessionId === checkoutSessionId &&
			order.planId === planId &&
			order.months === months &&
			order.amount === amount &&
			isFreshPendingOrder(order)
		) {
			return order
		}
	}

	return null
}

function createUserKey(user?: UserSnapshot): string {
	return user?.id || user?.email || ''
}

async function findReusableUserPendingOrder({
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
	const userKey = createUserKey(user)
	const order = await findReusablePendingOrder({
		checkoutSessionId,
		planId,
		months,
		amount,
	})

	if (!order) return null
	return createUserKey(order.userSnapshot) === userKey ? order : null
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
	return [checkoutSessionId, createUserKey(user), planId, months, amount].join(':')
}

function createReturnUrl(orderCode: number): string {
	return `${config.frontendUrl}/?payment=return&orderCode=${orderCode}`
}

function createCancelUrl(orderCode: number): string {
	return `${config.frontendUrl}/?payment=cancel&orderCode=${orderCode}`
}

function resolveBankName(paymentLink: PayosPaymentLink): string | undefined {
	return (
		bankNamesByBin[String(paymentLink.bin)]
	)
}

export async function createPayment(
	body: CreatePaymentBody,
	authenticatedUser: UserSnapshot
): Promise<Order> {
	const planId = normalizePlanId(body.planId)
	const plan = plans[planId]
	const months = parseMonths(body.months || 1)
	const amount = calculateAmount(plan, months)
	const checkoutSessionId = normalizeCheckoutSessionId(body.checkoutSessionId)
	const user = authenticatedUser
	const invoice = normalizeInvoice(body.invoice)
	const reusableOrder = await findReusableUserPendingOrder({
		checkoutSessionId,
		planId,
		months,
		amount,
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
		amount,
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

	const creationPromise = createNewPaymentOrder({
		plan,
		planId,
		months,
		amount,
		user,
		invoice,
		checkoutSessionId,
	})
	if (lockKey) {
		setPaymentCreationLock(lockKey, creationPromise)
	}

	return creationPromise
}

async function createNewPaymentOrder({
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
	amount: number
	user: UserSnapshot
	invoice: OrderInvoice
	checkoutSessionId: string
}): Promise<Order> {
	const orderCode = createOrderCode()
	const description = createDescription(orderCode)
	const paymentRequest = {
		orderCode,
		amount,
		description,
		cancelUrl: createCancelUrl(orderCode),
		returnUrl: createReturnUrl(orderCode),
		items: [
			{
				name: `${plan.name} subscription`,
				quantity: months,
				price: amount,
			},
		],
	}
	const paymentLink = await createPaymentRequest(paymentRequest)
	const now = new Date().toISOString()
	const expiresAt = new Date(Date.now() + config.pendingOrderTtlMs).toISOString()
	const payment = await createPaymentRecord({
		provider: 'payos',
		orderCode,
		amount,
		currency: 'VND',
		status: paymentLink.status || 'PENDING',
		description,
		expiresAt,
		providerOrderId: paymentLink.paymentLinkId,
		checkoutUrl: paymentLink.checkoutUrl,
		qrCode: paymentLink.qrCode,
		bank: {
			name: resolveBankName(paymentLink),
			bin: paymentLink.bin,
			accountNumber: paymentLink.accountNumber,
			accountName: paymentLink.accountName,
		},
		rawProviderData: paymentLink,
	})

	return saveOrder({
		userId: user.id,
		paymentId: payment.paymentId,
		orderCode,
		planId,
		planName: plan.name,
		items: createOrderItems({ plan, planId, months, amount }),
		months,
		amount,
		currency: 'VND',
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

export async function syncOrderWithPayos(order: Order): Promise<Order> {
	if (!isPendingStatus(order.status)) {
		return order.status === 'PAID' ? preparePaidInvoice(order) : order
	}

	const paymentLink = await getPaymentRequest(order.orderCode)
	const providerStatus = paymentLink.status || 'PENDING'
	const orderStatus = toPayosOrderStatus(providerStatus)
	const paidTransaction = paymentLink.transactions?.find(
		(transaction: Record<string, any>) => transaction.amount > 0
	)

	order.status = orderStatus
	const payment = await getPaymentByOrderCode(order.orderCode)
	if (orderStatus === 'PAID' && payment) {
		await markPaymentPaid(payment, {
			paidAt: paidTransaction?.transactionDateTime || new Date().toISOString(),
			amountPaid: paymentLink.amountPaid,
			amountRemaining: paymentLink.amountRemaining,
			rawProviderStatus: paymentLink,
		})
	} else if (payment) {
		await updatePaymentRecord(payment, {
			status: providerStatus,
			rawProviderStatus: paymentLink,
		})
	}
	order.activationStatus =
		orderStatus === 'PAID' ? 'PENDING_ADMIN' : order.activationStatus
	order.paidAt =
		orderStatus === 'PAID'
			? paidTransaction?.transactionDateTime ||
			order.paidAt ||
			new Date().toISOString()
			: order.paidAt
	order.updatedAt = new Date().toISOString()
	const savedOrder = await saveOrder(order)
	if (orderStatus !== 'PAID') return savedOrder
	await createPendingActivationRequest(savedOrder)
	return preparePaidInvoice(savedOrder)
}

export async function getSyncedOrder(
	orderCode: number | string
): Promise<Order | null> {
	const order = await getOrder(orderCode)
	if (!order) return null
	return syncOrderWithPayos(order)
}

export async function updatePendingOrderInvoice(
	orderCode: number | string,
	invoiceInput: unknown
): Promise<Order | null> {
	const order = await getOrder(orderCode)
	if (!order) return null

	if (!canUpdateInvoiceSnapshot(order.status)) {
		throw createHttpError('Invoice details can only be updated before payment is paid', 409)
	}
	if (
		order.invoice.status === 'PUBLISHING' ||
		order.invoice.status === 'PUBLISHED'
	) {
		throw createHttpError('Invoice is already being processed', 409)
	}

	order.invoice = normalizeInvoice(invoiceInput)
	order.updatedAt = new Date().toISOString()
	return saveOrder(order)
}

export async function applyWebhookPaymentUpdate(
	data: PayosWebhookData
): Promise<Order | null> {
	const orderCode = String(data.orderCode)
	const order = await getOrder(orderCode)

	if (!order) return null

	const providerStatus = data.code === '00' ? 'PAID' : data.desc || 'FAILED'
	order.status = toPayosOrderStatus(providerStatus)
	order.activationStatus =
		order.status === 'PAID' ? 'PENDING_ADMIN' : 'NOT_STARTED'
	order.paidAt = data.transactionDateTime || new Date().toISOString()
	order.updatedAt = new Date().toISOString()
	const payment = await getPaymentByOrderCode(order.orderCode)
	if (order.status === 'PAID' && payment) {
		await markPaymentPaid(payment, {
			paidAt: order.paidAt,
			amountPaid: data.amount,
			webhook: data,
		})
	} else if (payment) {
		await updatePaymentRecord(payment, {
			status: providerStatus,
			webhook: data,
		})
	}
	const savedOrder = await saveOrder(order)
	if (order.status !== 'PAID') return savedOrder
	await createPendingActivationRequest(savedOrder)
	return preparePaidInvoice(savedOrder)
}
