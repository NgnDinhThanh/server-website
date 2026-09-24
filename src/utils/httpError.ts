import type { HttpError } from '../types.js'

export function createHttpError(message: string, status = 400): HttpError {
	const error = new Error(message) as HttpError
	error.status = status
	return error
}
