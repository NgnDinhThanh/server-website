import { config, getMissingMisaEnv } from '../config.js'
import { createHttpError } from '../utils/httpError.js'
import type { MisaTokenResponse } from '../types.js'

type TokenCache = {
	token: string
	expiresAt: number
}

let tokenCache: TokenCache | null = config.misa.accessToken
	? {
			token: config.misa.accessToken,
			expiresAt: Number.POSITIVE_INFINITY,
		}
	: null

function misaUrl(path: string) {
	return `${config.misa.apiBaseUrl.replace(/\/$/, '')}${path}`
}

function assertMisaEnv() {
	const missing = getMissingMisaEnv()
	if (missing.length) {
		throw createHttpError(`Missing MISA env: ${missing.join(', ')}`, 500)
	}
}

function unwrapMisaToken(body: MisaTokenResponse) {
	if (body.Success === false || body.ErrorCode) {
		throw createHttpError(body.ErrorMessage || 'MISA token request failed', 502)
	}
	if (!body.Data) {
		throw createHttpError('MISA token was not returned', 502)
	}
	return body.Data
}

export async function getMisaAccessToken() {
	assertMisaEnv()

	if (tokenCache && tokenCache.expiresAt - 60_000 > Date.now()) {
		return tokenCache.token
	}

	let response: Response
	try {
		response = await fetch(misaUrl('/invoice/token'), {
			method: 'POST',
			headers: {
				ClientID: config.misa.clientId,
				ClientSecret: config.misa.clientSecret,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				taxcode: config.misa.taxCode,
				username: config.misa.username,
				password: config.misa.password,
			}),
		})
	} catch (error) {
		throw createHttpError('MISA token request failed before response', 502)
	}
	const body = (await response.json().catch(() => null)) as MisaTokenResponse | null

	if (!response.ok || !body) {
		throw createHttpError('MISA token request failed', 502)
	}

	const token = unwrapMisaToken(body)
	tokenCache = {
		token,
		// Developer Portal documents the invoice token as reusable for 14 days.
		expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
	}

	return token
}

export function clearMisaTokenCache() {
	if (config.misa.accessToken) {
		tokenCache = {
			token: config.misa.accessToken,
			expiresAt: Number.POSITIVE_INFINITY,
		}
		return
	}

	tokenCache = null
}
