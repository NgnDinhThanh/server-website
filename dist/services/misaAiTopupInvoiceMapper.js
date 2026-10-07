import { config } from '../config.js';
import { createHttpError } from '../utils/httpError.js';
import { resolveMisaInvoiceMoney } from './misaInvoiceMoney.js';
const CONSUMER_BUYER_NAME = 'Ban cho nguoi tieu dung';
function assertMisaConfig() {
    const missing = [
        config.misa.invoiceSeries ? '' : 'MISA_INVOICE_SERIES',
        config.misa.invTemplateNo ? '' : 'MISA_INV_TEMPLATE_NO',
        config.misa.paymentMethod ? '' : 'MISA_PAYMENT_METHOD',
    ].filter(Boolean);
    if (missing.length) {
        throw createHttpError(`Missing MISA invoice config: ${missing.join(', ')}`, 500);
    }
}
function resolveMisaTax(order) {
    const money = resolveMisaInvoiceMoney({
        amount: order.amount,
        currency: order.currency,
    });
    if (order.currency === 'USD') {
        return {
            ...money,
            amountWithoutVatOriginal: money.originalAmount,
            amountWithoutVatConverted: money.convertedAmount,
            vatAmountOriginal: 0,
            vatAmountConverted: 0,
            vatRateName: '0%',
        };
    }
    return {
        ...money,
        amountWithoutVatOriginal: money.originalAmount,
        amountWithoutVatConverted: money.convertedAmount,
        vatAmountOriginal: 0,
        vatAmountConverted: 0,
        vatRateName: 'KCT',
    };
}
function resolveConsumerBuyerLegalName(order) {
    const buyerLegalName = order.userSnapshot.name.trim();
    if (!buyerLegalName) {
        throw createHttpError('User account name is required for consumer invoice buyer legal name', 409);
    }
    return buyerLegalName;
}
export function createMisaAiTopupInvoicePayload(order) {
    assertMisaConfig();
    const invoice = order.invoice;
    const { currencyCode, exchangeRate, originalAmount, convertedAmount, amountWithoutVatOriginal, amountWithoutVatConverted, vatAmountOriginal, vatAmountConverted, vatRateName, optionUserDefined, } = resolveMisaTax(order);
    const isConsumerInvoice = invoice.buyerMode === 'consumer';
    const buyerLegalName = isConsumerInvoice
        ? resolveConsumerBuyerLegalName(order)
        : invoice.buyerMode === 'business'
            ? invoice.buyerCompanyName
            : invoice.buyerName;
    const buyerTaxCode = !isConsumerInvoice && invoice.buyerMode === 'business' ? invoice.buyerTaxCode : '';
    const buyerIdNumber = !isConsumerInvoice && invoice.buyerMode === 'individual'
        ? invoice.buyerIdNumber
        : '';
    const buyerFullName = isConsumerInvoice ? CONSUMER_BUYER_NAME : invoice.buyerName;
    const buyerAddress = isConsumerInvoice ? '' : invoice.buyerAddress;
    const buyerEmail = isConsumerInvoice ? '' : invoice.buyerEmail;
    const buyerPhone = isConsumerInvoice ? '' : invoice.buyerPhone;
    const itemName = `AI token top-up - ${order.tokenAmount} tokens`;
    return {
        RefID: `occ-ai-${order.orderCode}`,
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
                ItemName: itemName,
                ItemCode: 'occ-ai-token-topup',
                UnitName: 'package',
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
    };
}
