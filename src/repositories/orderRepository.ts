import type { Order } from '../types.js'

const orders = new Map<string, Order>()
const paymentCreationLocks = new Map<string, Promise<Order>>()

export function getOrder(orderCode: number | string): Order | undefined {
	return orders.get(String(orderCode))
}

export function saveOrder(order: Order): Order {
	orders.set(String(order.orderCode), order)
	return order
}

export function listOrders(): Order[] {
	return Array.from(orders.values())
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
