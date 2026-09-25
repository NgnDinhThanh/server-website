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
import { normalizeInvoice } from './invoiceService.js'
import { applyPaidOrderToSubscription } from './subscriptionService.js'
import { resolveCheckoutAccount } from './accountService.js'
import {
	createPaymentRecord,
	markPaymentPaid,
	updatePaymentRecord,
} from './paymentRecordService.js'
import { createHttpError } from '../utils/httpError.js'
import type {
	CheckoutUser,
	CreatePaymentBody,
	Order,
	OrderInvoice,
	PayosPaymentLink,
	PayosWebhookData,
	Plan,
	PlanId,
	BuyerSnapshot,
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

function normalizeCheckoutSessionId(value: unknown): string {
	const sessionId = String(value || '').trim()
	if (!sessionId) return ''
	if (sessionId.length > 120) {
		throw createHttpError('checkoutSessionId is too long')
	}
	return sessionId
}

function isPendingStatus(status: unknown): boolean {
	return ['PENDING', 'PROCESSING'].includes(String(status || '').toUpperCase())
}

function isFreshPendingOrder(order: Order, now = Date.now()): boolean {
	if (!isPendingStatus(order.status)) return false
	const createdAt = Date.parse(order.createdAt || '')
	if (!Number.isFinite(createdAt)) return false
	return now - createdAt <= config.pendingOrderTtlMs
}

function findReusablePendingOrder({
	checkoutSessionId,
	planId,
	months,
	amount,
}: {
	checkoutSessionId: string
	planId: PlanId
	months: number
	amount: number
}): Order | null {
	if (!checkoutSessionId) return null

	for (const order of listOrders()) {
		const payment = getPayment(order.paymentId)
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

function createUserKey(user?: CheckoutUser): string {
	return user?.id || user?.email || ''
}

function findReusableUserPendingOrder({
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
}): Order | null {
	const userKey = createUserKey(user)
	const order = findReusablePendingOrder({
		checkoutSessionId,
		planId,
		months,
		amount,
	})

	if (!order) return null
	return createUserKey(order.user) === userKey ? order : null
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

export async function createPayment(body: CreatePaymentBody): Promise<Order> {
	const planId = normalizePlanId(body.planId)
	const plan = plans[planId]
	const months = parseMonths(body.months || 1)
	const amount = calculateAmount(plan, months)
	const checkoutSessionId = normalizeCheckoutSessionId(body.checkoutSessionId)
	const { account, checkoutUser: user, buyerSnapshot } = resolveCheckoutAccount(
		body.user
	)
	const invoice = normalizeInvoice(body.invoice)
	const reusableOrder = findReusableUserPendingOrder({
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
		accountId: account.accountId,
		buyerSnapshot,
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
	accountId,
	buyerSnapshot,
	invoice,
	checkoutSessionId,
}: {
	plan: Plan
	planId: PlanId
	months: number
	amount: number
	user: CheckoutUser
	accountId: string
	buyerSnapshot: BuyerSnapshot
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
	const payment = createPaymentRecord({
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
		accountId,
		paymentId: payment.paymentId,
		orderCode,
		planId,
		planName: plan.name,
		months,
		amount,
		currency: 'VND',
		user,
		buyerSnapshot,
		invoice,
		checkoutSessionId,
		description,
		status: paymentLink.status || 'PENDING',
		activationStatus: 'NOT_STARTED',
		createdAt: now,
		updatedAt: now,
		expiresAt,
		reused: false,
	})
}

export async function syncOrderWithPayos(order: Order): Promise<Order> {
	if (!isPendingStatus(order.status)) return order

	const paymentLink = await getPaymentRequest(order.orderCode)
	const status = paymentLink.status || order.status
	const paidTransaction = paymentLink.transactions?.find(
		(transaction: Record<string, any>) => transaction.amount > 0
	)

	order.status = status
	const payment = getPaymentByOrderCode(order.orderCode)
	if (status === 'PAID' && payment) {
		markPaymentPaid(payment, {
			paidAt: paidTransaction?.transactionDateTime || new Date().toISOString(),
			amountPaid: paymentLink.amountPaid,
			amountRemaining: paymentLink.amountRemaining,
			rawProviderStatus: paymentLink,
		})
	} else if (payment) {
		updatePaymentRecord(payment, {
			status,
			rawProviderStatus: paymentLink,
		})
	}
	order.activationStatus =
		status === 'PAID' ? 'ACTIVATING' : order.activationStatus
	order.paidAt =
		status === 'PAID'
			? paidTransaction?.transactionDateTime ||
			order.paidAt ||
			new Date().toISOString()
			: order.paidAt
	order.updatedAt = new Date().toISOString()
	const savedOrder = saveOrder(order)
	return status === 'PAID' ? applyPaidOrderToSubscription(savedOrder) : savedOrder
}

export async function getSyncedOrder(
	orderCode: number | string
): Promise<Order | null> {
	const order = getOrder(orderCode)
	if (!order) return null
	return syncOrderWithPayos(order)
}

export function applyWebhookPaymentUpdate(data: PayosWebhookData): Order | null {
	const orderCode = String(data.orderCode)
	const order = getOrder(orderCode)

	if (!order) return null

	order.status = data.code === '00' ? 'PAID' : data.desc || 'UNKNOWN'
	order.activationStatus =
		order.status === 'PAID' ? 'ACTIVATING' : 'NOT_STARTED'
	order.paidAt = data.transactionDateTime || new Date().toISOString()
	order.updatedAt = new Date().toISOString()
	const payment = getPaymentByOrderCode(order.orderCode)
	if (order.status === 'PAID' && payment) {
		markPaymentPaid(payment, {
			paidAt: order.paidAt,
			amountPaid: data.amount,
			webhook: data,
		})
	} else if (payment) {
		updatePaymentRecord(payment, {
			status: order.status,
			webhook: data,
		})
	}
	const savedOrder = saveOrder(order)
	return order.status === 'PAID'
		? applyPaidOrderToSubscription(savedOrder)
		: savedOrder
}
