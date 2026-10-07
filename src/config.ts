import type { Plan, PlanId } from './types.js'

function readEnv(key: string, fallback = '') {
	return (process.env[key] || fallback).trim()
}

function readNumberEnv(key: string, fallback: number) {
	const value = Number(readEnv(key))
	return Number.isFinite(value) ? value : fallback
}

function readPositiveNumberEnv(key: string, fallback: number) {
	const raw = readEnv(key)
	if (!raw) return fallback
	const value = Number(raw)
	return Number.isFinite(value) && value > 0 ? value : fallback
}

function readListEnv(key: string) {
	return readEnv(key)
		.split(',')
		.map(value => value.trim())
		.filter(Boolean)
}

function normalizeOrigin(value: string) {
	return value.replace(/\/$/, '')
}

const frontendUrl = readEnv('FRONTEND_URL', 'http://localhost:5173')
const frontendLocalUrl = readEnv('FRONTEND_LOCAL_URL', 'http://localhost:5173')
const publicBaseUrl =
	readEnv('PUBLIC_BASE_URL') || `http://localhost:${readNumberEnv('PORT', 4000)}`
const emailActivationUrl = readEnv('EMAIL_ACTIVATION_URL')

export const config = {
	port: readNumberEnv('PORT', 4000),
	frontendUrl,
	frontendOrigins: Array.from(
		new Set(
			[
				frontendUrl,
				frontendLocalUrl,
				publicBaseUrl,
				emailActivationUrl,
				...readListEnv('FRONTEND_URLS'),
			]
				.filter(Boolean)
				.map(normalizeOrigin)
		)
	),
	publicBaseUrl: normalizeOrigin(publicBaseUrl),
	usdToVndRate: readNumberEnv('USD_TO_VND_RATE', 24500),
	vndRoundingStep: readNumberEnv('VND_ROUNDING_STEP', 1000),
	forcedTestAmount: readEnv('PAYOS_TEST_AMOUNT')
		? readNumberEnv('PAYOS_TEST_AMOUNT', 0)
		: null,
	pendingOrderTtlMs:
		readNumberEnv('PENDING_ORDER_TTL_MINUTES', 15) * 60 * 1000,
	paypal: {
		enabled: readEnv('PAYPAL_ENABLED') === 'true',
		mode: readEnv('PAYPAL_MODE', 'sandbox'),
		apiBase:
			readEnv('PAYPAL_API_BASE') || 'https://api-m.sandbox.paypal.com',
		clientId: readEnv('PAYPAL_CLIENT_ID'),
		clientSecret: readEnv('PAYPAL_CLIENT_SECRET'),
		webhookId: readEnv('PAYPAL_WEBHOOK_ID'),
		currency: readEnv('PAYPAL_CURRENCY', 'USD'),
		orderTtlMs:
			readNumberEnv('PAYPAL_ORDER_TTL_MINUTES', 15) * 60 * 1000,
		requestTimeoutMs: readNumberEnv('PAYPAL_REQUEST_TIMEOUT_MS', 30_000),
		requestRetries: readNumberEnv('PAYPAL_REQUEST_RETRIES', 2),
	},
	aiTopup: {
		minVndAmount: readPositiveNumberEnv('AI_TOPUP_MIN_VND_AMOUNT', 100000),
		minUsdAmount: readPositiveNumberEnv('AI_TOPUP_MIN_USD_AMOUNT', 5),
		vndUnitPricePerToken: readPositiveNumberEnv('AI_TOPUP_VND_UNIT_PRICE_PER_TOKEN', 100),
		usdUnitPricePerToken: readPositiveNumberEnv('AI_TOPUP_USD_UNIT_PRICE_PER_TOKEN', 0.01),
	},
	tutorial: {
		youtubeApiKey: readEnv('YOUTUBE_API_KEY'),
		playlistId: readEnv('YOUTUBE_TUTORIAL_PLAYLIST_ID'),
		introVideoId: readEnv('YOUTUBE_TUTORIAL_INTRO_VIDEO_ID'),
	},
	feedback: {
		googleServiceAccountEmail: readEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
		googlePrivateKey: readEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n'),
		googleOAuthClientId: readEnv('GOOGLE_OAUTH_CLIENT_ID') || readEnv('GOOGLE_CLIENT_ID'),
		googleOAuthClientSecret:
			readEnv('GOOGLE_OAUTH_CLIENT_SECRET') || readEnv('GOOGLE_CLIENT_SECRET'),
		googleOAuthRedirectUri: readEnv('GOOGLE_OAUTH_REDIRECT_URI', 'https://developers.google.com/oauthplayground'),
		googleOAuthRefreshToken: readEnv('GOOGLE_OAUTH_REFRESH_TOKEN'),
		googleSheetId: readEnv('GOOGLE_FEEDBACK_SHEET_ID'),
		googleSheetName: readEnv('GOOGLE_FEEDBACK_SHEET_NAME', 'Feedback'),
		googleDriveFolderId: readEnv('GOOGLE_FEEDBACK_DRIVE_FOLDER_ID'),
		maxImageBytes: readPositiveNumberEnv('FEEDBACK_MAX_IMAGE_MB', 10) * 1024 * 1024,
		maxVideoBytes: readPositiveNumberEnv('FEEDBACK_MAX_VIDEO_MB', 100) * 1024 * 1024,
	},
	misa: {
		apiBaseUrl: readEnv('MISA_API_BASE_URL'),
		accessToken: readEnv('MISA_ACCESS_TOKEN'),
		clientId: readEnv('MISA_CLIENT_ID'),
		clientSecret: readEnv('MISA_CLIENT_SECRET'),
		taxCode: readEnv('MISA_TAX_CODE'),
		username: readEnv('MISA_USERNAME'),
		password: readEnv('MISA_PASSWORD'),
		invoiceSeries: readEnv('MISA_INVOICE_SERIES'),
		invTemplateNo: readEnv('MISA_INV_TEMPLATE_NO'),
		signType: readNumberEnv('MISA_SIGN_TYPE', 2),
		paymentMethod: readEnv('MISA_PAYMENT_METHOD'),
		vatRate: readEnv('MISA_VAT_RATE'),
		authorityMode: readEnv('MISA_AUTHORITY_MODE', 'without_code'),
		publishPath: readEnv('MISA_PUBLISH_PATH'),
		statusPath: readEnv('MISA_STATUS_PATH'),
		publishViewPath: readEnv('MISA_PUBLISH_VIEW_PATH'),
		sendEmailPath: readEnv('MISA_SEND_EMAIL_PATH'),
	},
}

export const plans: Record<PlanId, Plan> = {
	'pro-designer': { name: 'Pro Designer', monthlyUsd: 1 },
	'pro': { name: 'Pro', monthlyUsd: 49.92 },
	'premium': { name: 'Premium', monthlyUsd: 66.58 },
}

export const bankNamesByBin: Record<string, string> = {
	970415: 'VietinBank',
	970416: 'ACB',
	970418: 'BIDV',
	970419: 'NCB',
	970421: 'VRB',
	970422: 'MB Bank',
	970423: 'TPBank',
	970424: 'Shinhan Bank Vietnam',
	970425: 'ABBank',
	970426: 'MSB',
	970427: 'VietABank',
	970428: 'Nam A Bank',
	970429: 'SCB',
	970430: 'PGBank',
	970431: 'Eximbank',
	970432: 'VPBank',
	970433: 'VietBank',
	970434: 'Indovina Bank',
	970436: 'Vietcombank',
	970437: 'HDBank',
	970438: 'BaoViet Bank',
	970439: 'Public Bank Vietnam',
	970440: 'SeABank',
	970441: 'VIB',
	970443: 'SHB',
	970446: 'Co-opBank',
	970448: 'OCB',
	970449: 'LienVietPostBank',
	970452: 'KienlongBank',
	970454: 'Viet Capital Bank',
	970455: 'IBK Bank Hanoi',
	970456: 'IBK Bank HCMC',
	970457: 'Woori Bank Vietnam',
	970458: 'United Overseas Bank Vietnam',
	970459: 'CIMB Vietnam',
	970462: 'Kookmin Bank Hanoi',
	970463: 'Kookmin Bank HCMC',
	970464: 'KBank Vietnam',
	970466: 'KBank HCMC',
	970467: 'KEB Hana Bank HCMC',
	970468: 'KEB Hana Bank Hanoi',
	970470: 'Mirae Asset',
	970499: 'Agribank',
}

export const requiredMisaEnvKeys = [
	'MISA_API_BASE_URL',
	'MISA_CLIENT_ID',
	'MISA_CLIENT_SECRET',
	'MISA_TAX_CODE',
	'MISA_USERNAME',
	'MISA_PASSWORD',
	'MISA_INVOICE_SERIES',
	'MISA_INV_TEMPLATE_NO',
	'MISA_SIGN_TYPE',
	'MISA_PAYMENT_METHOD',
]

export function getMissingMisaEnv() {
	return requiredMisaEnvKeys.filter(key => !process.env[key])
}

export function hasPayosEnv() {
	return Boolean(
		process.env.PAYOS_CLIENT_ID &&
			process.env.PAYOS_API_KEY &&
			process.env.PAYOS_CHECKSUM_KEY
	)
}

export function hasPaypalEnv() {
	return Boolean(config.paypal.clientId && config.paypal.clientSecret)
}

export function hasPaypalWebhookEnv() {
	return Boolean(config.paypal.webhookId)
}
