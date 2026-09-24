import { createHttpError } from '../utils/httpError.js';
function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function readInvoiceString(invoice, key) {
    if (typeof invoice[key] !== 'string') {
        throw createHttpError(`invoice.${key} must be a string`);
    }
    return invoice[key].trim();
}
function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function isTaxCode(value) {
    return /^\d{10}(\d{3})?$/.test(value);
}
export function normalizeInvoice(value) {
    if (!isPlainObject(value)) {
        throw createHttpError('invoice is required');
    }
    if (typeof value.requested !== 'boolean') {
        throw createHttpError('invoice.requested must be a boolean');
    }
    if (!['individual', 'business'].includes(String(value.type))) {
        throw createHttpError('invoice.type must be individual or business');
    }
    const invoice = {
        provider: 'misa',
        requested: value.requested,
        type: value.type,
        status: value.requested ? 'REQUESTED' : 'NOT_REQUESTED',
        buyerName: readInvoiceString(value, 'buyerName'),
        buyerCompanyName: readInvoiceString(value, 'buyerCompanyName'),
        buyerTaxCode: readInvoiceString(value, 'buyerTaxCode'),
        buyerAddress: readInvoiceString(value, 'buyerAddress'),
        buyerEmail: readInvoiceString(value, 'buyerEmail'),
        buyerPhone: readInvoiceString(value, 'buyerPhone'),
        previewUrl: null,
        downloadUrl: null,
        invoiceNumber: null,
        issuedAt: null,
        error: null,
        updatedAt: new Date().toISOString(),
    };
    if (!invoice.requested)
        return invoice;
    if (invoice.type === 'individual') {
        if (!invoice.buyerName) {
            throw createHttpError('invoice.buyerName is required');
        }
        if (!invoice.buyerEmail) {
            throw createHttpError('invoice.buyerEmail is required');
        }
        if (!isEmail(invoice.buyerEmail)) {
            throw createHttpError('invoice.buyerEmail must be valid');
        }
        if (invoice.buyerTaxCode && !isTaxCode(invoice.buyerTaxCode)) {
            throw createHttpError('invoice.buyerTaxCode must have 10 or 13 digits');
        }
    }
    if (invoice.type === 'business') {
        if (!invoice.buyerCompanyName) {
            throw createHttpError('invoice.buyerCompanyName is required');
        }
        if (!invoice.buyerTaxCode) {
            throw createHttpError('invoice.buyerTaxCode is required');
        }
        if (!isTaxCode(invoice.buyerTaxCode)) {
            throw createHttpError('invoice.buyerTaxCode must have 10 or 13 digits');
        }
        if (!invoice.buyerAddress) {
            throw createHttpError('invoice.buyerAddress is required');
        }
        if (!invoice.buyerEmail) {
            throw createHttpError('invoice.buyerEmail is required');
        }
        if (!isEmail(invoice.buyerEmail)) {
            throw createHttpError('invoice.buyerEmail must be valid');
        }
        if (!invoice.buyerPhone) {
            throw createHttpError('invoice.buyerPhone is required');
        }
    }
    return invoice;
}
