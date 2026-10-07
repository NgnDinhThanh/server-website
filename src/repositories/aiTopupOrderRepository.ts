import { AiTopupOrderModel } from '../models/AiTopupOrder.js'
import type { AiTopupOrder } from '../types.js'

const aiTopupPaymentCreationLocks = new Map<string, Promise<AiTopupOrder>>()

function toAiTopupOrder(value: unknown): AiTopupOrder | undefined {
	if (!value || typeof value !== 'object') return undefined
	const object = value as AiTopupOrder
	return object.orderCode ? object : undefined
}

export async function getAiTopupOrder(
	orderCode: number | string
): Promise<AiTopupOrder | undefined> {
	return toAiTopupOrder(
		await AiTopupOrderModel.findOne({ orderCode: Number(orderCode) }).lean()
	)
}

export async function saveAiTopupOrder(
	order: AiTopupOrder
): Promise<AiTopupOrder> {
	const saved = await AiTopupOrderModel.findOneAndUpdate(
		{ orderCode: order.orderCode },
		order,
		{ upsert: true, new: true, setDefaultsOnInsert: true, lean: true }
	)
	return (saved || order) as AiTopupOrder
}

export async function listAiTopupOrders(): Promise<AiTopupOrder[]> {
	return (await AiTopupOrderModel.find().lean()) as AiTopupOrder[]
}

export function getAiTopupPaymentCreationLock(
	key: string
): Promise<AiTopupOrder> | undefined {
	return aiTopupPaymentCreationLocks.get(key)
}

export function setAiTopupPaymentCreationLock(
	key: string,
	promise: Promise<AiTopupOrder>
) {
	aiTopupPaymentCreationLocks.set(key, promise)
	promise.finally(() => aiTopupPaymentCreationLocks.delete(key))
}
