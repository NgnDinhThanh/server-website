import { PayOS } from '@payos/node'
import type { PayosPaymentLink, PayosWebhookData } from '../types.js'
import type { HttpError } from '../types.js'

let payosClient: PayOS | null = null

function assertPayosEnv() {
	const missing = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'].filter(
		key => !process.env[key]
	)
	if (missing.length) {
		const error = new Error(
			`Missing payOS env: ${missing.join(', ')}`
		) as HttpError
		error.status = 500
		throw error
	}
}

function getPayos(): PayOS {
	assertPayosEnv()
	if (!payosClient) {
		payosClient = new PayOS({
			clientId: process.env.PAYOS_CLIENT_ID,
			apiKey: process.env.PAYOS_API_KEY,
			checksumKey: process.env.PAYOS_CHECKSUM_KEY,
		})
	}
	return payosClient
}

export function normalizePaymentLink(result: any): PayosPaymentLink {
	return result?.data ?? result
}

export async function createPaymentRequest(
	paymentRequest: Record<string, any>
): Promise<PayosPaymentLink> {
	return normalizePaymentLink(
		await getPayos().paymentRequests.create(paymentRequest as any)
	)
}

export async function getPaymentRequest(
	orderCode: number
): Promise<PayosPaymentLink> {
	return normalizePaymentLink(await getPayos().paymentRequests.get(orderCode))
}

export async function verifyWebhook(payload: unknown): Promise<PayosWebhookData> {
	return getPayos().webhooks.verify(payload as any)
}

export async function confirmWebhook(
	webhookUrl: string
): Promise<PayosPaymentLink> {
	return normalizePaymentLink(await getPayos().webhooks.confirm(webhookUrl))
}
