import type { NextFunction, Request, Response } from 'express'
import { publicOrder } from '../presenters/orderPresenter.js'
import { getSyncedOrder } from '../services/paymentService.js'

export async function getInvoiceStatus(
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
