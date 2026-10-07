import { config } from '../config.js';
export function roundMisaCurrencyAmount(value, currency) {
    return currency === 'USD' ? Number(value.toFixed(2)) : Math.round(value);
}
export function resolveMisaInvoiceMoney({ amount, currency, }) {
    const originalAmount = roundMisaCurrencyAmount(amount, currency);
    const exchangeRate = currency === 'USD' ? config.usdToVndRate : 1;
    const convertedAmount = currency === 'USD'
        ? Math.round(originalAmount * exchangeRate)
        : originalAmount;
    const originalDigits = currency === 'USD' ? '2' : '0';
    return {
        currencyCode: currency,
        exchangeRate,
        originalAmount,
        convertedAmount,
        optionUserDefined: {
            MainCurrency: 'VND',
            AmountDecimalDigits: '0',
            AmountOCDecimalDigits: originalDigits,
            UnitPriceOCDecimalDigits: originalDigits,
            UnitPriceDecimalDigits: '0',
            QuantityDecimalDigits: '0',
            ExchangRateDecimalDigits: currency === 'USD' ? '0' : '0',
        },
    };
}
export function convertMisaAmountToVnd(amount, currency) {
    return currency === 'USD'
        ? Math.round(amount * config.usdToVndRate)
        : Math.round(amount);
}
