import type { Request, Response, NextFunction } from 'express'
import {
	getTutorials as getTutorialsService,
	syncTutorials as syncTutorialsService,
} from '../services/tutorialService.js'

export async function getTutorials(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const result = await getTutorialsService()
		res.status(200).json(result)
	} catch (error) {
		next(error)
	}
}

export async function syncTutorials(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const result = await syncTutorialsService()
		res.status(200).json(result)
	} catch (error) {
		next(error)
	}
}
