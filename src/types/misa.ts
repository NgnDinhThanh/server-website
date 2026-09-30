export type MisaApiResponse<T> = {
	Data?: T
	ErrorCode?: string
	ErrorMessage?: string
	Errors?: unknown
	Success?: boolean
}

export type MisaTokenResponse = MisaApiResponse<string>

export type MisaInvoiceTemplate = {
	IPTemplateID?: string
	TemplateName?: string
	InvTemplateName?: string
	InvSeries?: string
	InvTemplateNo?: string
	Inactive?: boolean
	IsInheritFromOldTemplate?: boolean | null
	IsSendSummary?: boolean
	IsPetrol?: boolean | null
	IsMoreVATRate?: boolean | null
}

export type MisaInvoiceBuyer = {
	BuyerLegalName: string
	BuyerTaxCode: string
	BuyerIDNumber: string
	BuyerAddress: string
	BuyerFullName: string
	BuyerEmail: string
	BuyerPhoneNumber: string
}

export type MisaInvoiceLineItem = {
	ItemType: 1
	LineNumber: number
	SortOrder: number
	ItemName: string
	ItemCode: string
	UnitName: string
	Quantity: number
	UnitPrice: number
	AmountOC: number
	Amount: number
	DiscountRate: number
	DiscountAmountOC: number
	DiscountAmount: number
	AmountWithoutVATOC: number
	AmountWithoutVAT: number
	VATRateName: string
	VATAmountOC: number
	VATAmount: number
}

export type MisaTaxRateInfo = {
	VATRateName: string
	AmountWithoutVATOC: number
	VATAmountOC: number
}

export type MisaInvoicePayload = {
	RefID: string
	InvSeries: string
	InvTemplateNo: string
	InvDate: string
	CurrencyCode: 'VND'
	ExchangeRate: 1
	IsInvoiceSummary: false
	IsSendEmail: false
	ReceiverName: string
	ReceiverEmail: string
	PaymentMethodName: string
	TotalSaleAmountOC: number
	TotalSaleAmount: number
	TotalAmountWithoutVATOC: number
	TotalAmountWithoutVAT: number
	DiscountRate: number
	TotalVATAmountOC: number
	TotalVATAmount: number
	TotalAmountOC: number
	TotalAmount: number
	TotalDiscountAmountOC: number
	TotalDiscountAmount: number
	OriginalInvoiceDetail: MisaInvoiceLineItem[]
	TaxRateInfo: MisaTaxRateInfo[]
} & MisaInvoiceBuyer

export type MisaPublishingPayload = {
	SignType: number
	InvoiceData: MisaInvoicePayload[]
}

export type MisaDownloadFile = {
	TransactionID?: string
	Data?: string
	FileData?: string
	FileName?: string
	MimeType?: string
}

export type MisaPreviewResult = {
	refId: string
	previewUrl: string
	rawStatus: string | null
}

export type MisaIssueResult = {
	refId: string
	transactionId: string | null
	invoiceId: string | null
	invoiceNumber: string | null
	issuedAt: string | null
	downloadUrl: string | null
	rawStatus: string | null
}

export type MisaPublishResult = MisaIssueResult

export type MisaInvoiceStatusResult = {
	TransactionID?: string
	PublishStatus?: number | string | null
	ReferenceType?: number | string | null
	InvoiceCode?: string | null
	SendTaxStatus?: number | string | null
	IsSentEmail?: boolean | null
	ErrorCode?: string | null
}

export type MisaSendEmailPayload = {
	SendEmailDatas: Array<{
		TransactionID: string
		ReceiverName: string
		ReceiverEmail: string
		CCEmail: string
		ReplyEmail: string
	}>
	IsInvoiceCode: boolean
	IsInvoiceCalculatingMachine?: boolean
}
