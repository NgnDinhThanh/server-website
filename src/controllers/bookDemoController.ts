import type { Request, Response } from 'express'
import * as BookDemoService from '../services/bookDemoService.js'
import { validateBookDemoRequest } from '../validators/bookDemoValidator.js'

export async function requestBookDemo(req: Request, res: Response) {
	try {
		const validation = validateBookDemoRequest(req.body || {})
		if (!validation.ok) {
			return res.status(validation.status).json(validation.body)
		}

		const result = await BookDemoService.requestBookDemo(validation.value)
		return res.status(200).json(result)
	} catch (error) {
		return res.status(200).json({
			success: false,
			msg: error instanceof Error ? error.message : 'Demo request failed',
			errCls: 'error',
		})
	}
}
