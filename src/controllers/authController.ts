import type { Request, Response } from 'express'
import * as AuthService from '../services/authService.js'
import {
	validateChangePasswordRequest,
	validateForgotPasswordRequest,
	validateLoginRequest,
	validateRegisterRequest,
	validateResetPasswordRequest,
} from '../validators/authValidator.js'
import { verifyToken } from '../utils/authToken.js'
import type { AuthUserPayload } from '../types.js'

type AuthedRequest = Request & {
	userId?: string
	user?: {
		_id: unknown
		email: string
		name: string
		role: AuthUserPayload['role']
		plan: AuthUserPayload['plan']
		country?: string
		emailVerified: boolean
		subscriptionExpiresAt?: Date | null
		createdAt?: Date
		updatedAt?: Date
	}
}

function maskEmail(value: unknown) {
	const email = typeof value === 'string' ? value.trim() : ''
	return email.replace(/(^.).*(@.*$)/, '$1***$2')
}

export async function register(req: Request, res: Response) {
	try {
		const startedAt = Date.now()
		console.log('[auth.register] start', {
			email: maskEmail(req.body?.email),
			at: new Date().toISOString(),
		})
		const validation = validateRegisterRequest(req.body || {})
		console.log('[auth.register] after validate', {
			ok: validation.ok,
			ms: Date.now() - startedAt,
		})
		if (!validation.ok) {
			return res.status(validation.status).json(validation.body)
		}

		const result = await AuthService.register(validation.value)
		console.log('[auth.register] after service', {
			success: result.success,
			msg: result.msg,
			ms: Date.now() - startedAt,
		})
		return res.status(200).json(result)
	} catch (error) {
		console.error('[auth.register] error', error)
		return res.status(200).json({
			success: false,
			msg: error instanceof Error ? error.message : 'Registration failed',
			errCls: 'error',
		})
	}
}

export async function activateRegistration(req: Request, res: Response) {
	try {
		const token = String(req.query.activation_token || '').trim()
		if (!token) {
			return res.status(200).render('activate_success', {
				success: false,
				message: 'Activation token is required',
				user: null,
			})
		}

		const result = await AuthService.activateRegistration(token)
		return res.status(200).render('activate_success', {
			success: result.success,
			message: result.msg,
			user: result.user || null,
		})
	} catch (error) {
		return res.status(200).render('activate_success', {
			success: false,
			message: error instanceof Error ? error.message : 'Activation failed',
			user: null,
		})
	}
}

export async function login(req: Request, res: Response) {
	try {
		const validation = validateLoginRequest(req.body || {})
		if (!validation.ok) {
			return res.status(validation.status).json(validation.body)
		}

		const result = await AuthService.login(validation.value)
		return res.status(200).json(result)
	} catch (error) {
		return res.status(200).json({
			success: false,
			msg: error instanceof Error ? error.message : 'Login failed',
			errCls: 'error',
		})
	}
}

export async function me(req: AuthedRequest, res: Response) {
	if (!req.user) {
		return res.status(401).json({ success: false, msg: 'Unauthorized', errCls: 'error' })
	}

	return res.status(200).json({
		success: true,
		msg: 'Authenticated',
		errCls: 'success',
		user: {
			id: String(req.user._id),
			email: req.user.email,
			name: req.user.name,
			role: req.user.role,
			plan: req.user.plan,
			...(req.user.country ? { country: req.user.country } : {}),
			emailVerified: req.user.emailVerified,
			subscriptionExpiresAt: req.user.subscriptionExpiresAt ?? null,
			createdAt: req.user.createdAt,
			updatedAt: req.user.updatedAt,
		},
	})
}

export async function forgotPassword(req: Request, res: Response) {
	try {
		const startedAt = Date.now()
		console.log('[auth.forgotPassword] start', {
			email: maskEmail(req.body?.email),
			at: new Date().toISOString(),
		})
		const validation = validateForgotPasswordRequest(req.body || {})
		console.log('[auth.forgotPassword] after validate', {
			ok: validation.ok,
			ms: Date.now() - startedAt,
		})
		if (!validation.ok) {
			return res.status(validation.status).json(validation.body)
		}

		const result = await AuthService.forgotPassword(validation.value.email)
		console.log('[auth.forgotPassword] after service', {
			success: result.success,
			msg: result.msg,
			ms: Date.now() - startedAt,
		})
		return res.status(200).json(result)
	} catch (error) {
		console.error('[auth.forgotPassword] error', error)
		return res.status(200).json({
			success: false,
			msg: error instanceof Error ? error.message : 'Forgot password failed',
			errCls: 'error',
		})
	}
}

export function showResetPasswordPage(req: Request, res: Response) {
	const token = String(req.query.token || '').trim()
	if (!token) {
		return res.status(400).render('reset_password', {
			token: '',
			success: false,
			message: 'Reset token is required',
		})
	}

	try {
		verifyToken(token)
		return res.status(200).render('reset_password', {
			token,
			success: true,
			message: '',
		})
	} catch {
		return res.status(400).render('reset_password', {
			token: '',
			success: false,
			message: 'Invalid or expired token',
		})
	}
}

export async function resetPassword(req: Request, res: Response) {
	try {
		const acceptsHtml = (req.headers.accept || '').includes('text/html')
		const validation = validateResetPasswordRequest(req.body || {})
		if (!validation.ok) {
			if (acceptsHtml) {
				return res.status(validation.status).render('reset_password', {
					token: String(req.body?.token || ''),
					success: false,
					message: validation.body.msg,
				})
			}
			return res.status(validation.status).json(validation.body)
		}

		const result = await AuthService.resetPassword(validation.value)
		if (acceptsHtml) {
			return res.status(200).render('reset_success', {
				success: result.success,
				message: result.msg,
			})
		}
		return res.status(200).json(result)
	} catch (error) {
		const acceptsHtml = (req.headers.accept || '').includes('text/html')
		if (acceptsHtml) {
			return res.status(200).render('reset_success', {
				success: false,
				message: error instanceof Error ? error.message : 'Reset password failed',
			})
		}
		return res.status(200).json({
			success: false,
			msg: error instanceof Error ? error.message : 'Reset password failed',
			errCls: 'error',
		})
	}
}

export async function changePassword(req: AuthedRequest, res: Response) {
	try {
		if (!req.userId) {
			return res.status(401).json({ success: false, msg: 'Unauthorized', errCls: 'error' })
		}

		const validation = validateChangePasswordRequest(req.body || {})
		if (!validation.ok) {
			return res.status(validation.status).json(validation.body)
		}

		const result = await AuthService.changePassword({
			userId: req.userId,
			password: validation.value.password,
		})
		return res.status(200).json(result)
	} catch (error) {
		return res.status(200).json({
			success: false,
			msg: error instanceof Error ? error.message : 'Change password failed',
			errCls: 'error',
		})
	}
}

export async function logout(req: AuthedRequest, res: Response) {
	try {
		if (!req.userId) {
			return res.status(401).json({ success: false, msg: 'Unauthorized', errCls: 'error' })
		}

		const result = await AuthService.logout(req.userId)
		return res.status(200).json(result)
	} catch (error) {
		return res.status(200).json({
			success: false,
			msg: error instanceof Error ? error.message : 'Logout failed',
			errCls: 'error',
		})
	}
}
