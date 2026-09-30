export type InvoiceType = 'individual' | 'business'

export type InvoiceStatus =
	| 'NOT_REQUESTED'
	| 'REQUESTED'
	| 'PREVIEW_READY'
	| 'PUBLISHING'
	| 'PUBLISHED'
	| 'FAILED'

export type MisaInvoiceTrace = {
	refId: string | null
	transactionId: string | null
	invoiceId: string | null
	invoiceSeries: string | null
	publishStatus: string | null
	sendTaxStatus: string | null
	taxAuthorityCode: string | null
	rawStatus: string | null
}

export type OrderInvoice = {
	provider: 'misa'
	requested: boolean
	type: InvoiceType
	status: InvoiceStatus
	buyerName: string
	buyerCompanyName: string
	buyerTaxCode: string
	buyerIdNumber: string
	buyerAddress: string
	buyerEmail: string
	buyerPhone: string
	deliveryEmail: string
	emailDeliveryRequested: boolean
	emailSentAt: string | null
	emailError: string | null
	previewUrl: string | null
	downloadUrl: string | null
	invoiceNumber: string | null
	issuedAt: string | null
	misa: MisaInvoiceTrace
	error: string | null
	updatedAt: string
}
