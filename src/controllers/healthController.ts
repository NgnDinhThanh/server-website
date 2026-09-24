import type { Request, Response } from 'express'
import {
	config,
	getMissingMisaEnv,
	hasPaypalEnv,
	hasPaypalWebhookEnv,
	hasPayosEnv,
} from '../config.js'

export function getHealth(req: Request, res: Response) {
	res.json({
		ok: true,
		name: 'occ-payos-test-server',
		publicBaseUrl: config.publicBaseUrl,
		hasPayosEnv: hasPayosEnv(),
		paypalMode: config.paypal.mode,
		hasPaypalEnv: hasPaypalEnv(),
		hasPaypalWebhookEnv: hasPaypalWebhookEnv(),
		invoiceProvider: process.env.INVOICE_PROVIDER || null,
		hasMisaEnv: getMissingMisaEnv().length === 0,
	})
}
