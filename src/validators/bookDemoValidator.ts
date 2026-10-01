import type { BookDemoRequest, BookDemoRequestBody } from '../types.js'

type ValidationResult<TValue> =
	| { ok: true; value: TValue }
	| { ok: false; status: number; body: { success: false; msg: string; errCls: 'error' } }

const emailRegex = /.+@.+\..+/

function readString(value: unknown) {
	return typeof value === 'string' ? value.trim() : ''
}

function error(msg: string): ValidationResult<never> {
	return {
		ok: false,
		status: 200,
		body: { success: false, msg, errCls: 'error' },
	}
}

export function validateBookDemoRequest(
	body: BookDemoRequestBody
): ValidationResult<BookDemoRequest> {
	const fullName = readString(body.fullName)
	const email = readString(body.email).toLowerCase()
	const company = readString(body.company)
	const country = readString(body.country)
	const role = readString(body.role)
	const workflow = readString(body.workflow)

	if (!fullName || !email || !company || !country || !role) {
		return error('Please complete all required fields')
	}

	if (!emailRegex.test(email)) {
		return error('Please enter a valid email address')
	}

	return {
		ok: true,
		value: {
			fullName,
			email,
			company,
			country,
			role,
			...(workflow ? { workflow } : {}),
		},
	}
}
