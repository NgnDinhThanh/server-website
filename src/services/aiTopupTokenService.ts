import {
	getAiTokenBalance,
	getAiTokenLedgerEntry,
	saveAiTokenBalance,
	saveAiTokenLedgerEntry,
} from '../repositories/aiTokenRepository.js'
import { saveAiTopupOrder } from '../repositories/aiTopupOrderRepository.js'
import { prepareAiTopupInvoice } from './aiTopupInvoiceService.js'
import { sendAiTopupPaymentReceiptEmail } from './aiTopupNotificationService.js'
import { createHttpError } from '../utils/httpError.js'
import type { AiTopupOrder } from '../types.js'

const creditLocks = new Map<number, Promise<AiTopupOrder>>()

function createTopupCreditEntryId(orderCode: number) {
	return `ai-topup-credit:${orderCode}`
}

async function creditPaidAiTopupOrderUnsafe(order: AiTopupOrder) {
	if (order.status === 'CREDITED' && order.creditStatus === 'CREDITED') {
		return order
	}
	if (order.status !== 'PAID' && order.status !== 'CREDITED') {
		throw createHttpError('AI top-up tokens can only be credited after payment is paid', 409)
	}
	if (order.tokenAmount < 1) {
		throw createHttpError('AI top-up token amount is invalid', 500)
	}

	const entryId = createTopupCreditEntryId(order.orderCode)
	const existingEntry = await getAiTokenLedgerEntry(entryId)
	if (existingEntry) {
		order.status = 'CREDITED'
		order.creditStatus = 'CREDITED'
		order.creditedAt = order.creditedAt || existingEntry.createdAt
		order.updatedAt = new Date().toISOString()
		return saveAiTopupOrder(order)
	}

	const currentBalance = await getAiTokenBalance(order.userId)
	const availableTokens = currentBalance?.availableTokens || 0
	const balanceAfter = availableTokens + order.tokenAmount
	const creditedAt = new Date().toISOString()

	await saveAiTokenBalance({
		userId: order.userId,
		availableTokens: balanceAfter,
		updatedAt: creditedAt,
	})
	await saveAiTokenLedgerEntry({
		entryId,
		userId: order.userId,
		orderCode: order.orderCode,
		paymentId: order.paymentId,
		type: 'TOPUP_CREDIT',
		tokenDelta: order.tokenAmount,
		balanceAfter,
		amount: order.amount,
		currency: order.currency,
		unitPricePerToken: order.unitPricePerToken,
		description: order.description,
		createdAt: creditedAt,
	})

	order.status = 'CREDITED'
	order.creditStatus = 'CREDITED'
	order.creditedAt = creditedAt
	order.updatedAt = creditedAt
	const savedOrder = await saveAiTopupOrder(order)
	const notifiedOrder = await sendAiTopupPaymentReceiptEmail(savedOrder)
	return prepareAiTopupInvoice(notifiedOrder)
}

export async function creditPaidAiTopupOrder(order: AiTopupOrder) {
	const existingLock = creditLocks.get(order.orderCode)
	if (existingLock) return existingLock

	const creditPromise = creditPaidAiTopupOrderUnsafe(order)
	creditLocks.set(order.orderCode, creditPromise)
	try {
		return await creditPromise
	} catch (error) {
		order.creditStatus = 'FAILED'
		order.updatedAt = new Date().toISOString()
		await saveAiTopupOrder(order)
		throw error
	} finally {
		creditLocks.delete(order.orderCode)
	}
}
