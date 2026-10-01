import type { AuthUserPayload } from './user.js'

export type JwtPayload = {
	id: string
	role: AuthUserPayload['role']
}

export type AuthResponse = {
	success: boolean
	msg: string
	errCls: 'success' | 'error' | 'text-success'
	access_token?: string
	user?: AuthUserPayload
}

export type RegisterRequestBody = {
	name?: unknown
	email?: unknown
	password?: unknown
	password2?: unknown
	country?: unknown
}

export type LoginRequestBody = {
	email?: unknown
	password?: unknown
}

export type ForgotPasswordRequestBody = {
	email?: unknown
}

export type ResetPasswordRequestBody = {
	token?: unknown
	password?: unknown
	password2?: unknown
}

export type ChangePasswordRequestBody = {
	password?: unknown
	password2?: unknown
}
