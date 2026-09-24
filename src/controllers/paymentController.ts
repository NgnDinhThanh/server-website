import type { NextFunction, Request, Response } from 'express'
import { publicOrder } from '../presenters/orderPresenter.js'
import { createPayment, getSyncedOrder } from '../services/paymentService.js'

export async function createDomesticPayment(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const order = await createPayment(req.body)
		const response = publicOrder(order)
		if (response.reused) {
			return res.json(response)
		}
		res.status(201).json(response)
	} catch (error) {
		next(error)
	}
}

export async function getPaymentStatus(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const order = await getSyncedOrder(String(req.params.orderCode || ''))
		if (!order) return res.status(404).json({ error: 'Order not found' })
		res.json(publicOrder(order))
	} catch (error) {
		next(error)
	}
}
