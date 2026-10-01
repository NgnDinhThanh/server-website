import type { NextFunction, Request, Response } from 'express'
import type { AuthenticatedRequest } from '../utils/authenticatedRequest.js'

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
	const user = (req as AuthenticatedRequest).user
	if (!user || (user.role !== 0 && user.role !== 1)) {
		return res.status(403).json({ error: 'Admin privileges are required' })
	}
	return next()
}
