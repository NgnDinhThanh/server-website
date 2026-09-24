export type CreatePaymentBody = {
	planId?: unknown
	months?: unknown
	checkoutSessionId?: unknown
	user?: unknown
	invoice?: unknown
}

export type RequestWithRawBody = import('express').Request & {
	rawBody?: string
}
