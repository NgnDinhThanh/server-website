import { createHttpError } from '../utils/httpError.js';
import { config } from '../config.js';
import { saveOrder } from '../repositories/orderRepository.js';
import { createMisaInvoicePayload } from './misaInvoiceMapper.js';
import { getMisa, postMisa } from './misaHttpClient.js';
const CONSUMER_BUYER_NAME = 'Bán cho người tiêu dùng';
function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function readInvoiceString(invoice, key) {
    if (invoice[key] === undefined || invoice[key] === null)
        return '';
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
function isPersonalTaxOrCitizenId(value) {
    return /^(\d{9}|\d{10}|\d{12}|\d{13})$/.test(value);
}
function isPhone(value) {
    return /^\+?[0-9][0-9\s().-]{7,18}$/.test(value);
}
function normalizeBuyerMode(value) {
    const buyerMode = String(value || '').trim().toLowerCase();
    if (buyerMode === 'consumer')
        return 'consumer';
    if (buyerMode === 'individual')
        return 'individual';
    if (buyerMode === 'business')
        return 'business';
    return null;
}
function normalizeAuthorityMode() {
    const authorityMode = String(config.misa.authorityMode || '').trim().toLowerCase();
    if (['with_code', 'with-tax-authority-code', 'code', 'true', '1'].includes(authorityMode)) {
        return 'WITH_TAX_AUTHORITY_CODE';
    }
    return 'WITHOUT_TAX_AUTHORITY_CODE';
}
function resolveInvoiceMode(value) {
    const explicitBuyerMode = normalizeBuyerMode(value.buyerMode);
    const detailsProvided = typeof value.detailsProvided === 'boolean'
        ? value.detailsProvided
        : typeof value.requested === 'boolean'
            ? value.requested
            : explicitBuyerMode
                ? explicitBuyerMode !== 'consumer'
                : false;
    const buyerMode = explicitBuyerMode ||
        (!detailsProvided
            ? 'consumer'
            : String(value.type) === 'business'
                ? 'business'
                : 'individual');
    const type = buyerMode === 'business' ? 'business' : 'individual';
    return {
        buyerMode,
        type,
        detailsProvided: buyerMode !== 'consumer' && detailsProvided,
    };
}
export function normalizeInvoice(value) {
    if (!isPlainObject(value)) {
        throw createHttpError('invoice is required');
    }
    const normalizedMode = resolveInvoiceMode(value);
    if (normalizedMode.buyerMode !== 'consumer' &&
        !['individual', 'business'].includes(String(value.type || normalizedMode.type))) {
        throw createHttpError('invoice.type must be individual or business');
    }
    const invoice = {
        provider: 'misa',
        required: true,
        detailsProvided: normalizedMode.detailsProvided,
        buyerMode: normalizedMode.buyerMode,
        visibility: normalizedMode.detailsProvided
            ? 'customer_visible'
            : 'seller_internal',
        authorityMode: normalizeAuthorityMode(),
        requested: normalizedMode.detailsProvided,
        type: normalizedMode.type,
        status: normalizedMode.detailsProvided ? 'REQUESTED' : 'NOT_REQUESTED',
        buyerName: readInvoiceString(value, 'buyerName'),
        buyerCompanyName: readInvoiceString(value, 'buyerCompanyName'),
        buyerTaxCode: readInvoiceString(value, 'buyerTaxCode'),
        buyerIdNumber: typeof value.buyerIdNumber === 'string'
            ? value.buyerIdNumber.trim()
            : value.type === 'individual' && typeof value.buyerTaxCode === 'string'
                ? value.buyerTaxCode.trim()
                : '',
        buyerAddress: readInvoiceString(value, 'buyerAddress'),
        buyerEmail: readInvoiceString(value, 'buyerEmail'),
        buyerPhone: readInvoiceString(value, 'buyerPhone'),
        deliveryEmail: typeof value.deliveryEmail === 'string'
            ? value.deliveryEmail.trim()
            : typeof value.buyerEmail === 'string'
                ? value.buyerEmail.trim()
                : '',
        emailDeliveryRequested: typeof value.emailDeliveryRequested === 'boolean'
            ? value.emailDeliveryRequested
            : Boolean(typeof value.buyerEmail === 'string' && value.buyerEmail.trim()),
        deliveryStatus: 'NOT_REQUESTED',
        emailSentAt: null,
        emailError: null,
        accountDeliveryEmail: '',
        accountDeliveryStatus: 'NOT_REQUESTED',
        accountEmailSentAt: null,
        accountEmailError: null,
        previewUrl: null,
        downloadUrl: null,
        invoiceNumber: null,
        issuedAt: null,
        misa: {
            refId: null,
            transactionId: null,
            invoiceId: null,
            invoiceSeries: null,
            publishStatus: null,
            sendTaxStatus: null,
            taxAuthorityCode: null,
            rawStatus: null,
        },
        error: null,
        updatedAt: new Date().toISOString(),
    };
    if (!invoice.detailsProvided)
        return invoice;
    if (invoice.buyerMode === 'individual') {
        if (!invoice.buyerName) {
            throw createHttpError('invoice.buyerName is required');
        }
        if (!invoice.buyerIdNumber) {
            throw createHttpError('invoice.buyerIdNumber is required');
        }
        if (!isPersonalTaxOrCitizenId(invoice.buyerIdNumber)) {
            throw createHttpError('invoice.buyerIdNumber must be a valid citizen id or equivalent id');
        }
        if (invoice.buyerEmail && !isEmail(invoice.buyerEmail)) {
            throw createHttpError('invoice.buyerEmail must be valid');
        }
        if (invoice.buyerPhone && !isPhone(invoice.buyerPhone)) {
            throw createHttpError('invoice.buyerPhone must be valid');
        }
        if (invoice.emailDeliveryRequested && !invoice.deliveryEmail) {
            throw createHttpError('invoice.deliveryEmail is required');
        }
        if (invoice.deliveryEmail && !isEmail(invoice.deliveryEmail)) {
            throw createHttpError('invoice.deliveryEmail must be valid');
        }
    }
    if (invoice.buyerMode === 'business') {
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
        if (!invoice.buyerEmail && !invoice.buyerPhone) {
            throw createHttpError('invoice.buyerEmail or invoice.buyerPhone is required');
        }
        if (invoice.buyerEmail && !isEmail(invoice.buyerEmail)) {
            throw createHttpError('invoice.buyerEmail must be valid');
        }
        if (invoice.buyerPhone && !isPhone(invoice.buyerPhone)) {
            throw createHttpError('invoice.buyerPhone must be valid');
        }
        if (invoice.emailDeliveryRequested && !invoice.deliveryEmail) {
            throw createHttpError('invoice.deliveryEmail is required');
        }
        if (invoice.deliveryEmail && !isEmail(invoice.deliveryEmail)) {
            throw createHttpError('invoice.deliveryEmail must be valid');
        }
    }
    return invoice;
}
function assertPaidInvoiceOrder(order) {
    if (order.status !== 'PAID') {
        throw createHttpError('Invoice can only be processed after payment is paid');
    }
    if (!order.invoice.detailsProvided) {
        throw createHttpError('Invoice was not requested for this order');
    }
}
function assertPaidOrder(order) {
    if (order.status !== 'PAID') {
        throw createHttpError('Invoice can only be processed after payment is paid');
    }
}
function applyConsumerInvoiceDefaults(order) {
    if (order.invoice.detailsProvided)
        return;
    order.invoice.required = true;
    order.invoice.detailsProvided = false;
    order.invoice.buyerMode = 'consumer';
    order.invoice.visibility = 'seller_internal';
    order.invoice.type = 'individual';
    order.invoice.requested = false;
    order.invoice.buyerName = CONSUMER_BUYER_NAME;
    order.invoice.buyerCompanyName = '';
    order.invoice.buyerTaxCode = '';
    order.invoice.buyerIdNumber = '';
    order.invoice.buyerAddress = '';
    order.invoice.buyerEmail = '';
    order.invoice.buyerPhone = '';
    order.invoice.deliveryEmail = '';
    order.invoice.emailDeliveryRequested = false;
    order.invoice.deliveryStatus = 'NOT_REQUESTED';
    order.invoice.emailSentAt = null;
    order.invoice.emailError = null;
    order.invoice.accountDeliveryEmail = '';
    order.invoice.accountDeliveryStatus = 'NOT_REQUESTED';
    order.invoice.accountEmailSentAt = null;
    order.invoice.accountEmailError = null;
}
function logInvoiceState(order, event, error) {
    console.info('OCC invoice state', {
        event,
        orderCode: order.orderCode,
        userId: order.userId,
        buyerMode: order.invoice.buyerMode,
        detailsProvided: order.invoice.detailsProvided,
        invoiceStatus: order.invoice.status,
        misaRefId: order.invoice.misa.refId,
        misaTransactionId: order.invoice.misa.transactionId,
        invoiceNumber: order.invoice.invoiceNumber,
        invoiceSeries: order.invoice.misa.invoiceSeries,
        issuedAt: order.invoice.issuedAt,
        taxAuthorityCode: order.invoice.misa.taxAuthorityCode,
        error: error instanceof Error ? error.message : error ? String(error) : null,
    });
}
function invoiceStateSnapshot(order) {
    return JSON.stringify({
        status: order.invoice.status,
        publishStatus: order.invoice.misa.publishStatus,
        sendTaxStatus: order.invoice.misa.sendTaxStatus,
        taxAuthorityCode: order.invoice.misa.taxAuthorityCode,
        downloadUrl: order.invoice.downloadUrl,
        accountDeliveryStatus: order.invoice.accountDeliveryStatus,
        deliveryStatus: order.invoice.deliveryStatus,
        accountEmailSentAt: order.invoice.accountEmailSentAt,
        emailSentAt: order.invoice.emailSentAt,
        error: order.invoice.error,
    });
}
function hasPendingInvoiceEmailDelivery(order) {
    return (order.invoice.accountDeliveryStatus === 'PENDING' ||
        order.invoice.deliveryStatus === 'PENDING');
}
function needsPublishedInvoiceStatusRefresh(order) {
    if (hasPendingInvoiceEmailDelivery(order))
        return true;
    return Boolean(order.invoice.detailsProvided &&
        isInvoiceCodeMode() &&
        !order.invoice.misa.taxAuthorityCode);
}
function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}
function parseMisaData(value) {
    if (typeof value !== 'string')
        return value;
    const trimmed = value.trim();
    if (!trimmed)
        return value;
    try {
        return JSON.parse(trimmed);
    }
    catch {
        return value;
    }
}
function asArray(value) {
    const parsed = parseMisaData(value);
    return Array.isArray(parsed) ? parsed : [];
}
function readParsedArray(record, keys) {
    for (const key of keys) {
        const parsed = asArray(record[key]);
        if (parsed.length)
            return parsed;
    }
    return [];
}
function readString(value) {
    if (typeof value === 'string')
        return value.trim() ? value.trim() : null;
    if (typeof value === 'number' || typeof value === 'boolean')
        return String(value);
    return null;
}
function readHttpUrl(value) {
    const url = readString(value);
    if (!url)
        return null;
    return /^https?:\/\//i.test(url) ? url : null;
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function stringifyError(value) {
    if (!value)
        return null;
    if (typeof value === 'string')
        return value;
    try {
        return JSON.stringify(value);
    }
    catch {
        return String(value);
    }
}
function createMisaResponseError(response) {
    const responseRecord = asRecord(response);
    const errors = stringifyError(response.Errors || responseRecord.errors);
    const message = response.ErrorMessage ||
        readString(responseRecord.descriptionErrorCode) ||
        response.ErrorCode ||
        readString(responseRecord.errorCode) ||
        (errors && errors !== '[]' ? errors : null) ||
        'MISA invoice request failed';
    return createHttpError(message, 502);
}
function unwrapMisaData(response) {
    const responseRecord = asRecord(response);
    if (response.Success === false ||
        responseRecord.success === false ||
        response.ErrorCode ||
        readString(responseRecord.errorCode)) {
        throw createMisaResponseError(response);
    }
    return (response.Data ?? responseRecord.data ?? response);
}
function isInvoiceCodeMode() {
    const explicitAuthorityMode = String(process.env.MISA_AUTHORITY_MODE || '').trim();
    if (explicitAuthorityMode) {
        return ['with_code', 'code', 'true', '1'].includes(explicitAuthorityMode.toLowerCase());
    }
    return config.misa.invoiceSeries.charAt(1).toUpperCase() === 'C';
}
function isInvoiceCalculatingMachine() {
    return config.misa.invoiceSeries.charAt(4).toUpperCase() === 'M';
}
function isInvoiceCodeForEmail() {
    return isInvoiceCodeMode();
}
function defaultMisaPath(operation) {
    if (operation === 'publish')
        return '/invoice/publishing';
    if (operation === 'status') {
        const params = new URLSearchParams({
            invoiceWithCode: String(isInvoiceCodeMode()),
            invoiceCalcu: String(isInvoiceCalculatingMachine()),
            inputType: '1',
        });
        return `/invoice/status?${params.toString()}`;
    }
    if (operation === 'publishView')
        return '/invoice/publishview';
    return '/invoice/sendemail';
}
function defaultMisaDownloadPath() {
    const params = new URLSearchParams({
        downloadDataType: 'Pdf',
        invoiceWithCode: String(isInvoiceCodeMode()),
        invoiceCalcu: String(isInvoiceCalculatingMachine()),
    });
    return `/invoice/Download?${params.toString()}`;
}
function misaOperationPath(operation) {
    const configured = {
        publish: config.misa.publishPath,
        status: config.misa.statusPath,
        publishView: config.misa.publishViewPath,
        sendEmail: config.misa.sendEmailPath,
    }[operation];
    return configured || defaultMisaPath(operation);
}
function extractPreviewResult(response, payload) {
    const data = unwrapMisaData(response);
    const previewUrl = readString(data);
    if (!previewUrl) {
        throw createHttpError('MISA preview URL was not returned', 502);
    }
    return {
        refId: payload.RefID,
        previewUrl,
        rawStatus: null,
    };
}
function extractPublishResult(response, payload) {
    const rawData = unwrapMisaData(response);
    const parsedData = parseMisaData(rawData);
    const firstData = Array.isArray(parsedData) ? parsedData[0] : parsedData;
    const data = asRecord(firstData);
    const publishResults = readParsedArray(data, [
        'publishInvoiceResult',
        'PublishInvoiceResult',
        'Data',
        'data',
    ]);
    const firstResult = asRecord(publishResults[0]);
    const result = Object.keys(firstResult).length ? firstResult : data;
    const errorCode = readString(result.ErrorCode) || readString(result.errorCode);
    if (errorCode) {
        throw createHttpError(`MISA invoice issue failed: ${errorCode}`, 502);
    }
    return {
        refId: payload.RefID,
        transactionId: readString(result.TransactionID) ||
            readString(result.TransactionId) ||
            readString(result.TransactionUUID),
        invoiceId: readString(result.InvoiceID) ||
            readString(result.InvoiceId) ||
            readString(result.InvID),
        invoiceNumber: readString(result.InvNo) ||
            readString(result.InvoiceNumber) ||
            readString(result.InvoiceNo) ||
            readString(result.InvoiceNumber),
        issuedAt: readString(result.InvDate) ||
            readString(result.IssuedDate) ||
            readString(result.IssuedAt),
        downloadUrl: readString(result.DownloadUrl) ||
            readString(result.DownloadURL) ||
            readString(result.LinkView),
        rawStatus: readString(result.PublishStatus) ||
            readString(result.Status) ||
            readString(result.status),
    };
}
function readStatusCode(status) {
    return (readString(status.PublishStatus) ||
        readString(status.StatusCode) ||
        readString(status.StatusName) ||
        readString(status.statusName) ||
        readString(status.PublishStatusName) ||
        readString(status.Status) ||
        readString(status.status));
}
function isPublishedStatus(status) {
    const statusCode = readStatusCode(status);
    const normalized = String(statusCode || '').toLowerCase();
    return (statusCode === '1' ||
        normalized === 'success' ||
        normalized.includes('published') ||
        normalized.includes('phat hanh') ||
        normalized.includes('phát hành') ||
        normalized.includes('thanh cong') ||
        normalized.includes('thành công'));
}
function isFailedStatus(status) {
    const statusCode = readStatusCode(status);
    return (Boolean(readString(status.ErrorCode) || readString(status.errorCode)) ||
        statusCode === '-1' ||
        String(statusCode || '').toLowerCase() === 'failed');
}
function readBoolean(value) {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes'].includes(normalized))
            return true;
        if (['false', '0', 'no'].includes(normalized))
            return false;
    }
    return null;
}
function markPendingInvoiceEmailsSent(order) {
    const sentAt = new Date().toISOString();
    let changed = false;
    if (order.invoice.accountDeliveryStatus === 'PENDING') {
        order.invoice.accountDeliveryStatus = 'SENT';
        order.invoice.accountEmailSentAt = order.invoice.accountEmailSentAt || sentAt;
        order.invoice.accountEmailError = null;
        changed = true;
    }
    if (order.invoice.deliveryStatus === 'PENDING') {
        order.invoice.deliveryStatus = 'SENT';
        order.invoice.emailSentAt = order.invoice.emailSentAt || sentAt;
        order.invoice.emailError = null;
        changed = true;
    }
    if (changed) {
        order.invoice.updatedAt = sentAt;
    }
}
function isInvoiceReadyForEmail(order) {
    if (!isInvoiceCodeMode())
        return false;
    return Boolean(order.invoice.misa.taxAuthorityCode);
}
function resolveMisaEmailDeliveryStatus(sendEmailResult) {
    const status = readString(sendEmailResult.SendEmailStatus) ||
        readString(sendEmailResult.Status) ||
        readString(sendEmailResult.status);
    if (status === '3')
        return 'SENT';
    if (status === '2')
        return 'FAILED';
    return 'PENDING';
}
function applyInvoiceEmailDeliveryStatus(order, receiverEmail, deliveryStatus, options) {
    const now = new Date().toISOString();
    order.invoice.updatedAt = now;
    if (options?.deliveryTarget === 'account') {
        order.invoice.accountDeliveryEmail = receiverEmail;
        order.invoice.accountDeliveryStatus = deliveryStatus;
        order.invoice.accountEmailError = null;
        if (deliveryStatus === 'SENT') {
            order.invoice.accountEmailSentAt = order.invoice.accountEmailSentAt || now;
        }
        return;
    }
    order.invoice.deliveryEmail = receiverEmail;
    order.invoice.emailDeliveryRequested = true;
    order.invoice.deliveryStatus = deliveryStatus;
    order.invoice.emailError = null;
    if (deliveryStatus === 'SENT') {
        order.invoice.emailSentAt = order.invoice.emailSentAt || now;
    }
}
async function syncPublishedInvoiceStatus(order) {
    const transactionId = order.invoice.misa.transactionId;
    if (!transactionId)
        return order;
    const beforeState = invoiceStateSnapshot(order);
    const statusPath = misaOperationPath('status');
    const response = await postMisa(statusPath, [transactionId]);
    const statuses = asArray(unwrapMisaData(response));
    const status = asRecord(statuses[0]);
    const errorCode = readString(status.ErrorCode) || readString(status.errorCode);
    if (errorCode) {
        throw createHttpError(`MISA invoice status failed: ${errorCode}`, 502);
    }
    order.invoice.misa.publishStatus =
        readString(status.PublishStatus) ||
            readString(status.StatusCode) ||
            readString(status.StatusName) ||
            readString(status.PublishStatusName) ||
            order.invoice.misa.publishStatus;
    order.invoice.misa.sendTaxStatus =
        readString(status.SendTaxStatus) || order.invoice.misa.sendTaxStatus;
    order.invoice.misa.taxAuthorityCode =
        readString(status.InvoiceCode) ||
            readString(status.TaxAuthorityCode) ||
            readString(status.CodeOfTax) ||
            order.invoice.misa.taxAuthorityCode;
    order.invoice.misa.rawStatus =
        JSON.stringify(status) || order.invoice.misa.rawStatus;
    if (readBoolean(status.IsSentEmail) === true) {
        markPendingInvoiceEmailsSent(order);
    }
    const savedOrder = await saveOrder(order);
    if (invoiceStateSnapshot(savedOrder) !== beforeState) {
        logInvoiceState(savedOrder, 'status-refreshed');
    }
    return savedOrder;
}
async function pollPublishedInvoiceStatus(order) {
    let savedOrder = order;
    let lastStatus = {};
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        savedOrder = await syncPublishedInvoiceStatus(savedOrder);
        lastStatus = asRecord(parseMisaData(savedOrder.invoice.misa.rawStatus));
        if (isFailedStatus(lastStatus)) {
            const errorCode = readString(lastStatus.ErrorCode) ||
                readString(lastStatus.errorCode) ||
                'MISA invoice status failed';
            throw createHttpError(`MISA invoice status failed: ${errorCode}`, 502);
        }
        if (isPublishedStatus(lastStatus))
            return savedOrder;
        if (attempt < 3)
            await delay(3000);
    }
    return savedOrder;
}
async function loadPublishedInvoiceView(order) {
    const transactionId = order.invoice.misa.transactionId;
    if (!transactionId)
        return order;
    if (order.invoice.downloadUrl)
        return order;
    const beforeState = invoiceStateSnapshot(order);
    const response = await postMisa(misaOperationPath('publishView'), [transactionId]);
    const data = unwrapMisaData(response);
    const parsedData = parseMisaData(data);
    const publishViewItems = Array.isArray(parsedData)
        ? parsedData
        : parsedData
            ? [parsedData]
            : [];
    const publishViewRecord = asRecord(publishViewItems[0]);
    const publishViewUrl = readHttpUrl(publishViewItems[0]) ||
        readHttpUrl(publishViewRecord.Link) ||
        readHttpUrl(publishViewRecord.link) ||
        readHttpUrl(publishViewRecord.Url) ||
        readHttpUrl(publishViewRecord.URL);
    if (publishViewUrl) {
        order.invoice.downloadUrl = publishViewUrl;
        order.invoice.status = 'PUBLISHED';
        order.invoice.error = null;
        order.invoice.updatedAt = new Date().toISOString();
    }
    const savedOrder = await saveOrder(order);
    if (invoiceStateSnapshot(savedOrder) !== beforeState) {
        logInvoiceState(savedOrder, 'publish-view-refreshed');
    }
    return savedOrder;
}
async function sendPublishedInvoiceEmail(order, email, options) {
    const transactionId = order.invoice.misa.transactionId;
    const receiverEmail = email?.trim() || order.invoice.deliveryEmail;
    if (!transactionId || !receiverEmail)
        return order;
    const payload = {
        SendEmailDatas: [
            {
                TransactionID: transactionId,
                ReceiverName: order.invoice.buyerName || order.invoice.buyerCompanyName || order.userSnapshot.name || '',
                ReceiverEmail: receiverEmail,
                CCEmail: '',
                BCCEmail: null,
                ReplyEmail: '',
            },
        ],
        IsInvoiceCode: isInvoiceCodeForEmail(),
        IsInvoiceCalculatingMachine: isInvoiceCalculatingMachine(),
    };
    const sendEmailPath = misaOperationPath('sendEmail');
    const response = await postMisa(sendEmailPath, payload);
    const data = unwrapMisaData(response);
    const sendEmailResult = asRecord(asArray(data)[0]);
    const errorCode = readString(sendEmailResult.ErrorCode) || readString(sendEmailResult.errorCode);
    const deliveryStatus = resolveMisaEmailDeliveryStatus(sendEmailResult);
    if (errorCode || deliveryStatus === 'FAILED') {
        throw createHttpError(`MISA invoice email failed: ${errorCode || 'SendEmailStatus=2'}`, 502);
    }
    applyInvoiceEmailDeliveryStatus(order, receiverEmail, deliveryStatus, options);
    return await saveOrder(order);
}
async function sendAccountInvoiceEmailAfterPublish(order) {
    if (!order.invoice.detailsProvided || order.invoice.status !== 'PUBLISHED') {
        return order;
    }
    const accountEmail = String(order.userSnapshot.email || '').trim();
    if (!isEmail(accountEmail))
        return order;
    if (!isInvoiceReadyForEmail(order))
        return order;
    if (order.invoice.accountDeliveryEmail === accountEmail &&
        (order.invoice.accountDeliveryStatus === 'SENT' ||
            order.invoice.accountDeliveryStatus === 'PENDING')) {
        return order;
    }
    order.invoice.accountDeliveryEmail = accountEmail;
    order.invoice.accountDeliveryStatus = 'PENDING';
    order.invoice.accountEmailError = null;
    order.invoice.updatedAt = new Date().toISOString();
    let savedOrder = await saveOrder(order);
    try {
        savedOrder = await sendPublishedInvoiceEmail(savedOrder, accountEmail, {
            deliveryTarget: 'account',
        });
        return savedOrder;
    }
    catch (error) {
        savedOrder.invoice.accountDeliveryStatus = 'FAILED';
        savedOrder.invoice.accountEmailError =
            error instanceof Error ? error.message : 'MISA invoice email failed';
        savedOrder.invoice.updatedAt = new Date().toISOString();
        savedOrder = await saveOrder(savedOrder);
        return savedOrder;
    }
}
export async function sendInvoiceEmail(order, email) {
    assertPaidOrder(order);
    if (!order.invoice.detailsProvided) {
        throw createHttpError('Invoice email is only available for customer invoices', 409);
    }
    const receiverEmail = String(email || '').trim();
    if (!receiverEmail) {
        throw createHttpError('Invoice email is required');
    }
    if (!isEmail(receiverEmail)) {
        throw createHttpError('Invoice email must be valid');
    }
    const refreshedOrder = await refreshPublishedInvoice(order);
    if (refreshedOrder.invoice.status !== 'PUBLISHED') {
        throw createHttpError('Invoice email can only be sent after the invoice is published', 409);
    }
    if (!refreshedOrder.invoice.misa.transactionId) {
        throw createHttpError('MISA invoice transaction id is missing', 500);
    }
    if (!isInvoiceReadyForEmail(refreshedOrder)) {
        throw createHttpError('Invoice email can only be sent after MISA tax authority code is available', 409);
    }
    return sendPublishedInvoiceEmail(refreshedOrder, receiverEmail);
}
async function completePublishedInvoice(order) {
    let savedOrder = order;
    try {
        savedOrder = await pollPublishedInvoiceStatus(savedOrder);
    }
    catch (error) {
        savedOrder.invoice.error =
            error instanceof Error ? error.message : 'Invoice status sync failed';
        savedOrder.invoice.updatedAt = new Date().toISOString();
        savedOrder = await saveOrder(savedOrder);
        logInvoiceState(savedOrder, 'status-refresh-failed', error);
        return savedOrder;
    }
    const latestStatus = asRecord(parseMisaData(savedOrder.invoice.misa.rawStatus));
    if (!isPublishedStatus(latestStatus)) {
        try {
            savedOrder.invoice.status = 'PUBLISHING';
            savedOrder = await loadPublishedInvoiceView(savedOrder);
            if (savedOrder.invoice.status !== 'PUBLISHED') {
                savedOrder.invoice.status = 'PUBLISHING';
                savedOrder.invoice.error = null;
                savedOrder.invoice.updatedAt = new Date().toISOString();
                return await saveOrder(savedOrder);
            }
        }
        catch {
            // publishview is only available after MISA finishes processing.
            savedOrder.invoice.status = 'PUBLISHING';
            savedOrder.invoice.error = null;
            savedOrder.invoice.updatedAt = new Date().toISOString();
            return await saveOrder(savedOrder);
        }
    }
    savedOrder.invoice.status = 'PUBLISHED';
    savedOrder.invoice.error = null;
    savedOrder.invoice.updatedAt = new Date().toISOString();
    savedOrder = await saveOrder(savedOrder);
    logInvoiceState(savedOrder, 'published');
    try {
        savedOrder = await loadPublishedInvoiceView(savedOrder);
    }
    catch (error) {
        savedOrder.invoice.error =
            error instanceof Error ? error.message : 'Invoice publish view failed';
        savedOrder.invoice.updatedAt = new Date().toISOString();
        savedOrder = await saveOrder(savedOrder);
        logInvoiceState(savedOrder, 'publish-view-failed', error);
    }
    savedOrder = await sendAccountInvoiceEmailAfterPublish(savedOrder);
    return savedOrder;
}
export async function refreshPublishedInvoice(order) {
    const hasPublishedTransaction = Boolean(order.invoice.misa.transactionId);
    const canRefresh = order.invoice.status === 'PUBLISHING' ||
        order.invoice.status === 'PUBLISHED';
    if (!hasPublishedTransaction || !canRefresh)
        return order;
    if (order.invoice.status === 'PUBLISHED') {
        let savedOrder = order;
        if (needsPublishedInvoiceStatusRefresh(savedOrder)) {
            savedOrder = await syncPublishedInvoiceStatus(savedOrder);
        }
        try {
            savedOrder = await loadPublishedInvoiceView(savedOrder);
        }
        catch (error) {
            if (!savedOrder.invoice.downloadUrl) {
                savedOrder.invoice.error =
                    error instanceof Error ? error.message : 'Invoice publish view failed';
                savedOrder.invoice.updatedAt = new Date().toISOString();
                savedOrder = await saveOrder(savedOrder);
                logInvoiceState(savedOrder, 'publish-view-failed', error);
            }
        }
        return sendAccountInvoiceEmailAfterPublish(savedOrder);
    }
    return completePublishedInvoice(order);
}
const extractIssueResult = extractPublishResult;
async function markInvoiceFailed(order, error) {
    order.invoice.status = 'FAILED';
    order.invoice.error = error instanceof Error ? error.message : 'Invoice request failed';
    order.invoice.updatedAt = new Date().toISOString();
    const savedOrder = await saveOrder(order);
    logInvoiceState(savedOrder, 'failed', error);
    return savedOrder;
}
async function markInvoicePreviewFailed(order, error, fallbackStatus) {
    order.invoice.status = fallbackStatus;
    order.invoice.error =
        error instanceof Error ? error.message : 'Invoice preview request failed';
    order.invoice.updatedAt = new Date().toISOString();
    return await saveOrder(order);
}
function readQueryString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
export async function listMisaInvoiceTemplates(query) {
    const params = new URLSearchParams();
    const invoiceWithCode = readQueryString(query.invoiceWithCode);
    const ticket = readQueryString(query.ticket);
    const year = readQueryString(query.year);
    const haveTempOld = readQueryString(query.haveTempOld);
    if (invoiceWithCode)
        params.set('invoiceWithCode', invoiceWithCode);
    if (ticket)
        params.set('ticket', ticket);
    if (year)
        params.set('year', year);
    if (haveTempOld)
        params.set('haveTempOld', haveTempOld);
    const path = `/invoice/templates${params.size ? `?${params.toString()}` : ''}`;
    const response = await getMisa(path);
    const templates = unwrapMisaData(response);
    const templateItems = Array.isArray(templates) ? templates : asArray(templates);
    return {
        count: templateItems.length,
        templates: templateItems
            .map(template => asRecord(template))
            .map(template => ({
            IPTemplateID: template.IPTemplateID,
            TemplateName: template.TemplateName || template.InvTemplateName,
            InvSeries: template.InvSeries,
            InvTemplateNo: template.InvTemplateNo,
            Inactive: template.Inactive,
            IsInheritFromOldTemplate: template.IsInheritFromOldTemplate,
            IsSendSummary: template.IsSendSummary,
            IsPetrol: template.IsPetrol,
            IsMoreVATRate: template.IsMoreVATRate,
        }))
    };
}
export async function previewInvoice(order, options = {}) {
    assertPaidOrder(order);
    const payload = createMisaInvoicePayload(order);
    try {
        const response = await postMisa('/invoice/unpublishview', payload);
        const result = extractPreviewResult(response, payload);
        order.invoice.status = options.status || 'PREVIEW_READY';
        order.invoice.previewUrl = options.exposePreviewUrl === false ? null : result.previewUrl;
        order.invoice.misa.refId = result.refId;
        order.invoice.misa.invoiceSeries = payload.InvSeries;
        order.invoice.misa.rawStatus = result.rawStatus;
        order.invoice.error = null;
        order.invoice.updatedAt = new Date().toISOString();
        return await saveOrder(order);
    }
    catch (error) {
        return await markInvoicePreviewFailed(order, error, options.status || order.invoice.status || 'REQUESTED');
    }
}
export async function preparePaidInvoice(order) {
    assertPaidOrder(order);
    if (order.invoice.status === 'PUBLISHED') {
        return refreshPublishedInvoice(order);
    }
    if (order.invoice.status === 'PUBLISHING') {
        return refreshPublishedInvoice(order);
    }
    if (order.invoice.detailsProvided) {
        if (order.invoice.status === 'REQUESTED' || order.invoice.status === 'PREVIEW_READY') {
            return publishInvoice(order);
        }
        return order;
    }
    if (order.invoice.status === 'NOT_REQUESTED') {
        applyConsumerInvoiceDefaults(order);
        return publishPaidInvoice(order);
    }
    return order;
}
async function publishPaidInvoice(order) {
    if (order.invoice.status === 'PUBLISHED') {
        return refreshPublishedInvoice(order);
    }
    order.invoice.status = 'PUBLISHING';
    order.invoice.error = null;
    order.invoice.updatedAt = new Date().toISOString();
    await saveOrder(order);
    logInvoiceState(order, 'publish-started');
    const payload = createMisaInvoicePayload(order);
    const publishPayload = {
        SignType: config.misa.signType,
        InvoiceData: [payload],
    };
    try {
        const response = await postMisa(misaOperationPath('publish'), publishPayload);
        const result = extractPublishResult(response, payload);
        order.invoice.status = 'PUBLISHING';
        order.invoice.invoiceNumber = result.invoiceNumber;
        order.invoice.issuedAt = result.issuedAt || new Date().toISOString();
        order.invoice.downloadUrl = result.downloadUrl;
        order.invoice.misa.refId = result.refId;
        order.invoice.misa.transactionId = result.transactionId;
        order.invoice.misa.invoiceId = result.invoiceId;
        order.invoice.misa.invoiceSeries = payload.InvSeries;
        order.invoice.misa.rawStatus = result.rawStatus;
        order.invoice.error = null;
        order.invoice.emailError = null;
        order.invoice.updatedAt = new Date().toISOString();
        const savedOrder = await saveOrder(order);
        logInvoiceState(savedOrder, 'publish-result-received');
        return refreshPublishedInvoice(savedOrder);
    }
    catch (error) {
        return await markInvoiceFailed(order, error);
    }
}
export async function publishInvoice(order) {
    assertPaidInvoiceOrder(order);
    return publishPaidInvoice(order);
}
export const issueInvoice = publishInvoice;
export async function downloadInvoice(order) {
    order = await refreshPublishedInvoice(order);
    if (order.invoice.status !== 'PUBLISHED') {
        throw createHttpError('Invoice is still being processed by MISA. Please try again after signing and tax authority processing are complete.', 409);
    }
    if (!order.invoice.misa.transactionId) {
        throw createHttpError('MISA invoice transaction id is missing', 500);
    }
    const response = await postMisa(defaultMisaDownloadPath(), [order.invoice.misa.transactionId]);
    const files = unwrapMisaData(response);
    const fileItems = Array.isArray(files) ? files : asArray(files);
    const file = asRecord(fileItems[0]);
    const base64 = readString(file?.FileData) || readString(file?.Data);
    if (!base64) {
        throw createHttpError('MISA invoice PDF was not returned', 502);
    }
    return {
        buffer: Buffer.from(base64, 'base64'),
        fileName: readString(file?.FileName) || `occ-invoice-${order.orderCode}.pdf`,
        mimeType: readString(file?.MimeType) || 'application/pdf',
    };
}
