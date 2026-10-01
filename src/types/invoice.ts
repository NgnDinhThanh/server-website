export type InvoiceType = 'individual' | 'business'
export type InvoiceBuyerMode = 'consumer' | 'individual' | 'business'
export type InvoiceVisibility = 'seller_internal' | 'customer_visible'
export type InvoiceAuthorityMode =
	| 'WITH_TAX_AUTHORITY_CODE'
	| 'WITHOUT_TAX_AUTHORITY_CODE'
export type InvoiceDeliveryStatus =
	| 'NOT_REQUESTED'
	| 'PENDING'
	| 'SENT'
	| 'FAILED'

export type InvoiceStatus =
	| 'NOT_REQUESTED'
	| 'REQUESTED'
	| 'DRAFT'
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
	required: true
	detailsProvided: boolean
	buyerMode: InvoiceBuyerMode
	visibility: InvoiceVisibility
	authorityMode: InvoiceAuthorityMode
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
	deliveryStatus: InvoiceDeliveryStatus
	emailSentAt: string | null
	emailError: string | null
	accountDeliveryEmail: string
	accountDeliveryStatus: InvoiceDeliveryStatus
	accountEmailSentAt: string | null
	accountEmailError: string | null
	previewUrl: string | null
	downloadUrl: string | null
	invoiceNumber: string | null
	issuedAt: string | null
	misa: MisaInvoiceTrace
	error: string | null
	updatedAt: string
}
