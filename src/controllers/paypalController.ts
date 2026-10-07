import type { NextFunction, Request, Response } from 'express'
import { config } from '../config.js'
import { publicOrder } from '../presenters/orderPresenter.js'
import {
	applyPaypalWebhookUpdate,
	capturePaypalPayment as capturePaypalPaymentService,
	createPaypalPayment as createPaypalPaymentService,
	getPaypalSyncedOrder,
} from '../services/paypalPaymentService.js'
import { applyAiTopupPaypalWebhookUpdate } from '../services/aiTopupPaymentService.js'
import {
	isTransientPaypalRequestError,
} from '../services/paypalService.js'
import type { RequestWithRawBody } from '../types.js'
import {
	assertOrderOwner,
	getAuthenticatedUserSnapshot,
} from '../utils/authenticatedRequest.js'

export function getPaypalConfig(req: Request, res: Response) {
	res.json({
		enabled: config.paypal.enabled,
		mode: config.paypal.mode,
		clientId: config.paypal.clientId,
		currency: config.paypal.currency,
	})
}

export async function createPaypalPayment(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const order = await createPaypalPaymentService(
			req.body,
			getAuthenticatedUserSnapshot(req)
		)
		const response = await publicOrder(order)
		if (response.reused) {
			return res.json(response)
		}
		res.status(201).json(response)
	} catch (error) {
		next(error)
	}
}

export async function capturePaypalPayment(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const order = await capturePaypalPaymentService(
			String(req.params.paypalOrderId || ''),
			getAuthenticatedUserSnapshot(req)
		)
		res.json(await publicOrder(order))
	} catch (error) {
		next(error)
	}
}

export async function getPaypalPaymentStatus(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const order = await getPaypalSyncedOrder(String(req.params.orderCode || ''))
		if (!order) return res.status(404).json({ error: 'Order not found' })
		assertOrderOwner(req, order)
		res.json(await publicOrder(order))
	} catch (error) {
		next(error)
	}
}

export async function handlePaypalWebhook(req: Request, res: Response) {
	try {
		const subscriptionOrder = await applyPaypalWebhookUpdate({
			req: req as RequestWithRawBody,
			event: req.body,
		})
		if (!subscriptionOrder) {
			await applyAiTopupPaypalWebhookUpdate({
				req: req as RequestWithRawBody,
				event: req.body,
			})
		}
		res.json({ ok: true })
	} catch (error) {
		if (isTransientPaypalRequestError(error)) {
			return res.status(503).json({
				ok: false,
				error: 'PayPal webhook verification temporarily unavailable',
			})
		}

		res.status(400).json({ ok: false, error: 'Invalid webhook signature' })
	}
}
