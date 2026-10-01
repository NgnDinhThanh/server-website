import type { Request } from 'express'
import type { Order, UserRole, UserSnapshot } from '../types.js'
import { createHttpError } from './httpError.js'

export type AuthenticatedRequest = Request & {
	user?: {
		_id: unknown
		email: string
		name: string
		role: UserRole
		plan: UserSnapshot['plan']
		subscriptionExpiresAt?: Date | null
	}
	userId?: string
}

export function getAuthenticatedUserSnapshot(req: Request): UserSnapshot {
	const authReq = req as AuthenticatedRequest
	const id = String(authReq.userId || authReq.user?._id || '').trim()
	const email = String(authReq.user?.email || '').trim()
	const name = String(authReq.user?.name || '').trim()
	const role = authReq.user?.role
	const plan = authReq.user?.plan

	if (!id || !email || !name || typeof role !== 'number' || !plan) {
		throw createHttpError('Authenticated user is required', 401)
	}

	return {
		id,
		email,
		name,
		role,
		plan,
		subscriptionExpiresAt: authReq.user?.subscriptionExpiresAt ?? null,
	}
}

export function assertOrderOwner(req: Request, order: Order) {
	const authReq = req as AuthenticatedRequest
	const userId = String(authReq.userId || authReq.user?._id || '').trim()
	if (!userId || order.userId !== userId) {
		throw createHttpError('Order not found', 404)
	}
}
