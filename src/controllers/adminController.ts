import type { NextFunction, Request, Response } from 'express'
import {
	activateSubscriptionRequest,
	listPendingActivationRequests,
} from '../services/activationRequestService.js'
import { getAuthenticatedUserSnapshot } from '../utils/authenticatedRequest.js'

export async function listActivationRequests(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		res.json({ requests: await listPendingActivationRequests() })
	} catch (error) {
		next(error)
	}
}

export async function activateRequest(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const result = await activateSubscriptionRequest({
			requestId: String(req.params.requestId || ''),
			adminUser: getAuthenticatedUserSnapshot(req),
		})
		res.json(result)
	} catch (error) {
		next(error)
	}
}
