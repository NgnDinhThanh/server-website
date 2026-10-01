import type {
	ChangePasswordRequestBody,
	ForgotPasswordRequestBody,
	LoginRequestBody,
	RegisterRequestBody,
	ResetPasswordRequestBody,
} from '../types.js'

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

export function validateRegisterRequest(
	body: RegisterRequestBody
): ValidationResult<{
	name: string
	email: string
	password: string
	password2: string
	country: string
}> {
	const name = readString(body.name)
	const email = readString(body.email).toLowerCase()
	const password = readString(body.password)
	const password2 = readString(body.password2)
	const country = readString(body.country)

	if (!name || !email || !password || !password2 || !country) {
		return error('All fields are required')
	}
	if (!emailRegex.test(email)) {
		return error('Invalid email')
	}
	if (password.length < 6) {
		return error('Password must be at least 6 characters')
	}
	if (password !== password2) {
		return error('Passwords do not match')
	}

	return { ok: true, value: { name, email, password, password2, country } }
}

export function validateLoginRequest(
	body: LoginRequestBody
): ValidationResult<{ email: string; password: string }> {
	const email = readString(body.email).toLowerCase()
	const password = readString(body.password)

	if (!email || !password) {
		return error('Email and password are required')
	}

	return { ok: true, value: { email, password } }
}

export function validateForgotPasswordRequest(
	body: ForgotPasswordRequestBody
): ValidationResult<{ email: string }> {
	const email = readString(body.email).toLowerCase()

	if (!email) {
		return error('Email is required')
	}
	if (!emailRegex.test(email)) {
		return error('Invalid email')
	}

	return { ok: true, value: { email } }
}

export function validateResetPasswordRequest(
	body: ResetPasswordRequestBody
): ValidationResult<{ token: string; password: string; password2: string }> {
	const token = readString(body.token)
	const password = readString(body.password)
	const password2 = readString(body.password2)

	if (!token || !password || !password2) {
		return error('All fields are required')
	}
	if (password.length < 6) {
		return error('Password must be at least 6 characters')
	}
	if (password !== password2) {
		return error('Passwords do not match')
	}

	return { ok: true, value: { token, password, password2 } }
}

export function validateChangePasswordRequest(
	body: ChangePasswordRequestBody
): ValidationResult<{ password: string; password2: string }> {
	const password = readString(body.password)
	const password2 = readString(body.password2)

	if (!password || !password2) {
		return error('All fields are required')
	}
	if (password.length < 6) {
		return error('Password must be at least 6 characters')
	}
	if (password !== password2) {
		return error('Passwords do not match')
	}

	return { ok: true, value: { password, password2 } }
}
