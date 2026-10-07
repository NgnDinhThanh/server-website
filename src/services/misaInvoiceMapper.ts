import { config } from '../config.js'
import { createHttpError } from '../utils/httpError.js'
import {
	convertMisaAmountToVnd,
	resolveMisaInvoiceMoney,
	roundMisaCurrencyAmount,
} from './misaInvoiceMoney.js'
import type { MisaInvoicePayload, Order } from '../types.js'

const CONSUMER_BUYER_NAME = 'Bán cho người tiêu dùng'

function assertMisaConfig() {
	const missing = [
		config.misa.invoiceSeries ? '' : 'MISA_INVOICE_SERIES',
		config.misa.invTemplateNo ? '' : 'MISA_INV_TEMPLATE_NO',
		config.misa.paymentMethod ? '' : 'MISA_PAYMENT_METHOD',
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

function resolveMisaTax(order: Order) {
	const item = order.items[0]
	const money = resolveMisaInvoiceMoney({
		amount: order.amount,
		currency: order.currency,
	})

	if (!item || item.taxCategory === 'NON_TAXABLE') {
		return {
			...money,
			amountWithoutVatOriginal: money.originalAmount,
			amountWithoutVatConverted: money.convertedAmount,
			vatAmountOriginal: 0,
			vatAmountConverted: 0,
			vatRateName: 'KCT',
		}
	}

	if (item.taxCategory === 'VAT_ZERO') {
		return {
			...money,
			amountWithoutVatOriginal: money.originalAmount,
			amountWithoutVatConverted: money.convertedAmount,
			vatAmountOriginal: 0,
			vatAmountConverted: 0,
			vatRateName: '0%',
		}
	}

	const vatRate =
		typeof item.taxRate === 'number' && Number.isFinite(item.taxRate)
			? item.taxRate
			: readVatRate()
	const amountWithoutVatOriginal = roundMisaCurrencyAmount(
		money.originalAmount / (1 + vatRate / 100),
		order.currency
	)
	const vatAmountOriginal = roundMisaCurrencyAmount(
		money.originalAmount - amountWithoutVatOriginal,
		order.currency
	)
	const amountWithoutVatConverted = convertMisaAmountToVnd(
		amountWithoutVatOriginal,
		order.currency
	)
	const vatAmountConverted = convertMisaAmountToVnd(
		vatAmountOriginal,
		order.currency
	)

	return {
		...money,
		amountWithoutVatOriginal,
		amountWithoutVatConverted,
		vatAmountOriginal,
		vatAmountConverted,
		vatRateName: `${vatRate}%`,
	}
}

function resolveConsumerBuyerLegalName(order: Order) {
	const buyerLegalName = order.userSnapshot.name.trim()
	if (!buyerLegalName) {
		throw createHttpError(
			'User account name is required for consumer invoice buyer legal name',
			409
		)
	}
	return buyerLegalName
}

export function createMisaInvoicePayload(order: Order): MisaInvoicePayload {
	assertMisaConfig()

	const invoice = order.invoice
	const {
		currencyCode,
		exchangeRate,
		originalAmount,
		convertedAmount,
		amountWithoutVatOriginal,
		amountWithoutVatConverted,
		vatAmountOriginal,
		vatAmountConverted,
		vatRateName,
		optionUserDefined,
	} = resolveMisaTax(order)
	const isConsumerInvoice = invoice.buyerMode === 'consumer'
	const buyerLegalName =
		isConsumerInvoice
			? resolveConsumerBuyerLegalName(order)
			: invoice.buyerMode === 'business'
			? invoice.buyerCompanyName
			: invoice.buyerName
	const buyerTaxCode =
		!isConsumerInvoice && invoice.buyerMode === 'business' ? invoice.buyerTaxCode : ''
	const buyerIdNumber =
		!isConsumerInvoice && invoice.buyerMode === 'individual'
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
		CurrencyCode: currencyCode,
		ExchangeRate: exchangeRate,
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
		TotalSaleAmountOC: amountWithoutVatOriginal,
		TotalSaleAmount: amountWithoutVatConverted,
		TotalAmountWithoutVATOC: amountWithoutVatOriginal,
		TotalAmountWithoutVAT: amountWithoutVatConverted,
		DiscountRate: 0,
		TotalVATAmountOC: vatAmountOriginal,
		TotalVATAmount: vatAmountConverted,
		TotalAmountOC: originalAmount,
		TotalAmount: convertedAmount,
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
				UnitPrice: amountWithoutVatOriginal,
				AmountOC: amountWithoutVatOriginal,
				Amount: amountWithoutVatConverted,
				DiscountRate: 0,
				DiscountAmountOC: 0,
				DiscountAmount: 0,
				AmountWithoutVATOC: amountWithoutVatOriginal,
				AmountWithoutVAT: amountWithoutVatConverted,
				VATRateName: vatRateName,
				VATAmountOC: vatAmountOriginal,
				VATAmount: vatAmountConverted,
			},
		],
		TaxRateInfo: [
			{
				VATRateName: vatRateName,
				AmountWithoutVATOC: amountWithoutVatOriginal,
				VATAmountOC: vatAmountOriginal,
			},
		],
		OptionUserDefined: optionUserDefined,
	}
}
