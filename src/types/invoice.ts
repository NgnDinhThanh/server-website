export type InvoiceType = 'individual' | 'business'

export type InvoiceStatus =
	| 'NOT_REQUESTED'
	| 'REQUESTED'
	| 'PREVIEW_READY'
	| 'ISSUING'
	| 'ISSUED'
	| 'FAILED'

export type OrderInvoice = {
	provider: 'misa'
	requested: boolean
	type: InvoiceType
	status: InvoiceStatus
	buyerName: string
	buyerCompanyName: string
	buyerTaxCode: string
	buyerAddress: string
	buyerEmail: string
	buyerPhone: string
	previewUrl: string | null
	downloadUrl: string | null
	invoiceNumber: string | null
	issuedAt: string | null
	error: string | null
	updatedAt: string
}
