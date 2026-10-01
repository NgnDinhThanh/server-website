import type { NextFunction, Request, Response } from 'express'
import { publicOrder } from '../presenters/orderPresenter.js'
import { getSyncedOrder } from '../services/paymentService.js'
import {
	downloadInvoice,
	listMisaInvoiceTemplates,
	publishInvoice,
	previewInvoice,
	refreshPublishedInvoice,
	sendInvoiceEmail,
} from '../services/invoiceService.js'
import { assertOrderOwner } from '../utils/authenticatedRequest.js'

export async function getMisaInvoiceTemplates(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const templates = await listMisaInvoiceTemplates(req.query)
		res.json(templates)
	} catch (error) {
		next(error)
	}
}

export async function getInvoiceStatus(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const order = await getSyncedOrder(String(req.params.orderCode || ''))
		if (!order) return res.status(404).json({ error: 'Order not found' })
		assertOrderOwner(req, order)
		const updatedOrder = await refreshPublishedInvoice(order)
		res.json(await publicOrder(updatedOrder))
	} catch (error) {
		next(error)
	}
}

export async function previewOrderInvoice(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const order = await getSyncedOrder(String(req.params.orderCode || ''))
		if (!order) return res.status(404).json({ error: 'Order not found' })
		assertOrderOwner(req, order)
		const updatedOrder = await previewInvoice(order)
		res.json(await publicOrder(updatedOrder))
	} catch (error) {
		next(error)
	}
}

export async function issueOrderInvoice(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const order = await getSyncedOrder(String(req.params.orderCode || ''))
		if (!order) return res.status(404).json({ error: 'Order not found' })
		assertOrderOwner(req, order)
		const updatedOrder = await publishInvoice(order)
		res.json(await publicOrder(updatedOrder))
	} catch (error) {
		next(error)
	}
}

export async function publishOrderInvoice(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const order = await getSyncedOrder(String(req.params.orderCode || ''))
		if (!order) return res.status(404).json({ error: 'Order not found' })
		assertOrderOwner(req, order)
		const updatedOrder = await publishInvoice(order)
		res.json(await publicOrder(updatedOrder))
	} catch (error) {
		next(error)
	}
}

export async function downloadOrderInvoice(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const order = await getSyncedOrder(String(req.params.orderCode || ''))
		if (!order) return res.status(404).json({ error: 'Order not found' })
		assertOrderOwner(req, order)
		const file = await downloadInvoice(order)
		res.setHeader('Content-Type', file.mimeType)
		res.setHeader(
			'Content-Disposition',
			`attachment; filename="${file.fileName}"`
		)
		res.send(file.buffer)
	} catch (error) {
		next(error)
	}
}

export async function sendOrderInvoiceEmail(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const order = await getSyncedOrder(String(req.params.orderCode || ''))
		if (!order) return res.status(404).json({ error: 'Order not found' })
		assertOrderOwner(req, order)
		const email =
			typeof req.body?.email === 'string'
				? req.body.email
				: typeof req.body?.receiverEmail === 'string'
					? req.body.receiverEmail
					: ''
		const updatedOrder = await sendInvoiceEmail(order, email)
		res.json(await publicOrder(updatedOrder))
	} catch (error) {
		next(error)
	}
}
