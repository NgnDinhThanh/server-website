import { config } from '../config.js'
import { createHttpError } from '../utils/httpError.js'
import { clearMisaTokenCache, getMisaAccessToken } from './misaAuthService.js'

function misaUrl(path: string) {
	return `${config.misa.apiBaseUrl.replace(/\/$/, '')}${path}`
}

async function requestMisa<T>(
	path: string,
	body?: unknown,
	retry = true
): Promise<T> {
	const token = await getMisaAccessToken()
	let response: Response
	try {
		response = await fetch(misaUrl(path), {
			method: body ? 'POST' : 'GET',
			headers: {
				Authorization: `Bearer ${token}`,
				ClientID: config.misa.clientId,
				CompanyTaxCode: config.misa.taxCode,
				'Content-Type': 'application/json',
			},
			body: body ? JSON.stringify(body) : undefined,
		})
	} catch (error) {
		throw createHttpError('MISA request failed before response', 502)
	}

	if (response.status === 401 && retry) {
		clearMisaTokenCache()
		return requestMisa<T>(path, body, false)
	}

	const rawText = await response.text().catch(() => '')
	let data: T | null = null
	try {
		data = rawText ? (JSON.parse(rawText) as T) : null
	} catch {
		data = null
	}
	if (!response.ok || !data) {
		throw createHttpError(`MISA request failed: ${path}`, 502)
	}

	return data
}

export function postMisa<T>(path: string, body: unknown) {
	return requestMisa<T>(path, body)
}

export function getMisa<T>(path: string) {
	return requestMisa<T>(path)
}
