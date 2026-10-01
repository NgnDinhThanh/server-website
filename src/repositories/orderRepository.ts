import type { Order } from '../types.js'
import { OrderModel } from '../models/Order.js'

const paymentCreationLocks = new Map<string, Promise<Order>>()

function toOrder(value: unknown): Order | undefined {
	if (!value) return undefined
	const object =
		typeof (value as { toObject?: () => unknown }).toObject === 'function'
			? (value as { toObject: () => unknown }).toObject()
			: value
	return object as Order
}

export async function getOrder(orderCode: number | string): Promise<Order | undefined> {
	return toOrder(await OrderModel.findOne({ orderCode: Number(orderCode) }).lean())
}

export async function saveOrder(order: Order): Promise<Order> {
	const saved = await OrderModel.findOneAndUpdate(
		{ orderCode: order.orderCode },
		order,
		{ new: true, upsert: true, setDefaultsOnInsert: true }
	).lean()
	return (saved || order) as Order
}

export async function listOrders(): Promise<Order[]> {
	return (await OrderModel.find().lean()) as Order[]
}

export function getPaymentCreationLock(key: string): Promise<Order> | undefined {
	return paymentCreationLocks.get(key)
}

export function setPaymentCreationLock(key: string, promise: Promise<Order>) {
	paymentCreationLocks.set(key, promise)
	promise.then(
		() => paymentCreationLocks.delete(key),
		() => paymentCreationLocks.delete(key)
	)
}
