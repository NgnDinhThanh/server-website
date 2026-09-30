import { config } from '../config.js'
import { createHttpError } from '../utils/httpError.js'
import type { MisaInvoicePayload, Order } from '../types.js'

const CONSUMER_BUYER_NAME = 'Bán cho người tiêu dùng'

function assertMisaConfig() {
	const missing = [
		config.misa.invoiceSeries ? '' : 'MISA_INVOICE_SERIES',
		config.misa.invTemplateNo ? '' : 'MISA_INV_TEMPLATE_NO',
		config.misa.paymentMethod ? '' : 'MISA_PAYMENT_METHOD',
		config.misa.vatRate ? '' : 'MISA_VAT_RATE',
	].filter(Boolean)

	if (missing.length) {
		throw createHttpError(`Missing MISA invoice config: ${missing.join(', ')}`, 500)
	}
}

function readVatRate() {
	const vatRate = Number(config.misa.vatRate)
	if (!Number.isFinite(vatRate) || vatRate < 0) {
		throw createHttpError('MISA_VAT_RATE must be a non-negative number', 500)
	}
	return vatRate
}

function roundMoney(value: number) {
	return Math.round(value)
}

function resolveInvoiceAmountVnd(order: Order) {
	if (order.currency === 'USD') {
		return Math.round(order.amount * config.usdToVndRate)
	}
	return order.amount
}

export function createMisaInvoicePayload(order: Order): MisaInvoicePayload {
	assertMisaConfig()

	const invoice = order.invoice
	const vatRate = readVatRate()
	const totalAmount = resolveInvoiceAmountVnd(order)
	const amountWithoutVat = roundMoney(totalAmount / (1 + vatRate / 100))
	const vatAmount = totalAmount - amountWithoutVat
	const isConsumerInvoice = !invoice.requested
	const buyerLegalName =
		isConsumerInvoice
			? CONSUMER_BUYER_NAME
			: invoice.type === 'business'
			? invoice.buyerCompanyName
			: invoice.buyerName
	const buyerTaxCode =
		!isConsumerInvoice && invoice.type === 'business' ? invoice.buyerTaxCode : ''
	const buyerIdNumber =
		!isConsumerInvoice && invoice.type === 'individual'
			? invoice.buyerIdNumber
			: ''
	const buyerFullName = isConsumerInvoice ? CONSUMER_BUYER_NAME : invoice.buyerName
	const buyerAddress = isConsumerInvoice ? '' : invoice.buyerAddress
	const buyerEmail = isConsumerInvoice ? '' : invoice.buyerEmail
	const buyerPhone = isConsumerInvoice ? '' : invoice.buyerPhone

	return {
		RefID: `occ-${order.orderCode}`,
		InvSeries: config.misa.invoiceSeries,
		InvTemplateNo: config.misa.invTemplateNo,
		InvDate: (order.paidAt || new Date().toISOString()).slice(0, 10),
		CurrencyCode: 'VND',
		ExchangeRate: 1,
		IsInvoiceSummary: false,
		IsSendEmail: false,
		ReceiverName: '',
		ReceiverEmail: '',
		PaymentMethodName: config.misa.paymentMethod,
		BuyerLegalName: buyerLegalName,
		BuyerTaxCode: buyerTaxCode,
		BuyerIDNumber: buyerIdNumber,
		BuyerAddress: buyerAddress,
		BuyerFullName: buyerFullName,
		BuyerEmail: buyerEmail,
		BuyerPhoneNumber: buyerPhone,
		TotalSaleAmountOC: amountWithoutVat,
		TotalSaleAmount: amountWithoutVat,
		TotalAmountWithoutVATOC: amountWithoutVat,
		TotalAmountWithoutVAT: amountWithoutVat,
		DiscountRate: 0,
		TotalVATAmountOC: vatAmount,
		TotalVATAmount: vatAmount,
		TotalAmountOC: totalAmount,
		TotalAmount: totalAmount,
		TotalDiscountAmountOC: 0,
		TotalDiscountAmount: 0,
		OriginalInvoiceDetail: [
			{
				ItemType: 1,
				LineNumber: 1,
				SortOrder: 1,
				ItemName: `${order.planName} subscription - ${order.months} month${
					order.months > 1 ? 's' : ''
				}`,
				ItemCode: order.planId,
				UnitName: 'month',
				Quantity: 1,
				UnitPrice: amountWithoutVat,
				AmountOC: amountWithoutVat,
				Amount: amountWithoutVat,
				DiscountRate: 0,
				DiscountAmountOC: 0,
				DiscountAmount: 0,
				AmountWithoutVATOC: amountWithoutVat,
				AmountWithoutVAT: amountWithoutVat,
				VATRateName: `${vatRate}%`,
				VATAmountOC: vatAmount,
				VATAmount: vatAmount,
			},
		],
		TaxRateInfo: [
			{
				VATRateName: `${vatRate}%`,
				AmountWithoutVATOC: amountWithoutVat,
				VATAmountOC: vatAmount,
			},
		],
	}
}
