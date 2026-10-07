import { config } from '../config.js'
import { saveAiTopupOrder } from '../repositories/aiTopupOrderRepository.js'
import { postMisa } from './misaHttpClient.js'
import { createMisaAiTopupInvoicePayload } from './misaAiTopupInvoiceMapper.js'
import { createHttpError } from '../utils/httpError.js'
import type {
	AiTopupOrder,
	InvoiceDeliveryStatus,
	MisaApiResponse,
	MisaInvoiceStatusResult,
	MisaPublishingPayload,
	MisaSendEmailPayload,
} from '../types.js'

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}
}

function readString(value: unknown): string | null {
	if (typeof value === 'string') return value.trim() ? value.trim() : null
	if (typeof value === 'number' || typeof value === 'boolean') return String(value)
	return null
}

function readBoolean(value: unknown): boolean | null {
	if (typeof value === 'boolean') return value
	if (typeof value === 'number') return value === 1
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase()
		if (['true', '1', 'yes'].includes(normalized)) return true
		if (['false', '0', 'no'].includes(normalized)) return false
	}
	return null
}

function isEmail(value: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function readHttpUrl(value: unknown): string | null {
	const url = readString(value)
	if (!url) return null
	return /^https?:\/\//i.test(url) ? url : null
}

function delay(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function parseMisaData(value: unknown): unknown {
	if (typeof value !== 'string') return value
	const trimmed = value.trim()
	if (!trimmed) return value
	try {
		return JSON.parse(trimmed)
	} catch {
		return value
	}
}

function asArray(value: unknown): unknown[] {
	const parsed = parseMisaData(value)
	return Array.isArray(parsed) ? parsed : []
}

function createMisaResponseError(response: MisaApiResponse<unknown>) {
	const responseRecord = asRecord(response)
	const message =
		response.ErrorMessage ||
		readString(responseRecord.descriptionErrorCode) ||
		response.ErrorCode ||
		readString(responseRecord.errorCode) ||
		'MISA AI top-up invoice request failed'

	return createHttpError(message, 502)
}

function unwrapMisaData<T>(response: MisaApiResponse<T>): T {
	const responseRecord = asRecord(response)
	if (
		response.Success === false ||
		responseRecord.success === false ||
		response.ErrorCode ||
		readString(responseRecord.errorCode)
	) {
		throw createMisaResponseError(response)
	}
	return (response.Data ?? responseRecord.data ?? response) as T
}

function misaPublishPath() {
	return config.misa.publishPath || '/invoice/publishing'
}

function isInvoiceCodeMode() {
	const explicitAuthorityMode = String(process.env.MISA_AUTHORITY_MODE || '').trim()
	if (explicitAuthorityMode) {
		return ['with_code', 'code', 'true', '1'].includes(
			explicitAuthorityMode.toLowerCase()
		)
	}
	return config.misa.invoiceSeries.charAt(1).toUpperCase() === 'C'
}

function isInvoiceCalculatingMachine() {
	return config.misa.invoiceSeries.charAt(4).toUpperCase() === 'M'
}

function defaultMisaPath(operation: 'status' | 'publishView' | 'sendEmail') {
	if (operation === 'status') {
		const params = new URLSearchParams({
			invoiceWithCode: String(isInvoiceCodeMode()),
			invoiceCalcu: String(isInvoiceCalculatingMachine()),
			inputType: '1',
		})
		return `/invoice/status?${params.toString()}`
	}
	if (operation === 'publishView') return '/invoice/publishview'
	return '/invoice/sendemail'
}

function misaOperationPath(operation: 'status' | 'publishView' | 'sendEmail') {
	const configured = {
		status: config.misa.statusPath,
		publishView: config.misa.publishViewPath,
		sendEmail: config.misa.sendEmailPath,
	}[operation]
	return configured || defaultMisaPath(operation)
}

function readParsedArray(record: Record<string, unknown>, keys: string[]) {
	for (const key of keys) {
		const parsed = asArray(record[key])
		if (parsed.length) return parsed
	}
	return []
}

function extractPublishResult(
	response: MisaApiResponse<Record<string, unknown>>,
	refId: string
) {
	const rawData = unwrapMisaData(response)
	const parsedData = parseMisaData(rawData)
	const firstData = Array.isArray(parsedData) ? parsedData[0] : parsedData
	const data = asRecord(firstData)
	const publishResults = readParsedArray(data, [
		'publishInvoiceResult',
		'PublishInvoiceResult',
		'Data',
		'data',
	])
	const firstResult = asRecord(publishResults[0])
	const result = Object.keys(firstResult).length ? firstResult : data
	const errorCode = readString(result.ErrorCode) || readString(result.errorCode)
	if (errorCode) {
		throw createHttpError(`MISA AI top-up invoice failed: ${errorCode}`, 502)
	}

	return {
		refId,
		transactionId:
			readString(result.TransactionID) ||
			readString(result.TransactionId) ||
			readString(result.TransactionUUID),
		invoiceId:
			readString(result.InvoiceID) ||
			readString(result.InvoiceId) ||
			readString(result.InvID),
		invoiceNumber:
			readString(result.InvNo) ||
			readString(result.InvoiceNumber) ||
			readString(result.InvoiceNo),
		issuedAt:
			readString(result.InvDate) ||
			readString(result.IssuedDate) ||
			readString(result.IssuedAt),
		rawStatus:
			readString(result.PublishStatus) ||
			readString(result.Status) ||
			readString(result.status),
	}
}

function readStatusCode(status: Record<string, unknown>) {
	return (
		readString(status.PublishStatus) ||
		readString(status.StatusCode) ||
		readString(status.StatusName) ||
		readString(status.statusName) ||
		readString(status.PublishStatusName) ||
		readString(status.Status) ||
		readString(status.status)
	)
}

function isPublishedStatus(status: Record<string, unknown>) {
	const statusCode = readStatusCode(status)
	const normalized = String(statusCode || '').toLowerCase()
	return (
		statusCode === '1' ||
		normalized === 'success' ||
		normalized.includes('published') ||
		normalized.includes('phat hanh') ||
		normalized.includes('phát hành') ||
		normalized.includes('thanh cong') ||
		normalized.includes('thành công')
	)
}

function isFailedStatus(status: Record<string, unknown>) {
	const statusCode = readStatusCode(status)
	return (
		Boolean(readString(status.ErrorCode) || readString(status.errorCode)) ||
		statusCode === '-1' ||
		String(statusCode || '').toLowerCase() === 'failed'
	)
}

function isInvoiceReadyForEmail(order: AiTopupOrder) {
	if (!isInvoiceCodeMode()) return false
	return Boolean(order.invoice.misa.taxAuthorityCode)
}

function markPendingInvoiceEmailsSent(order: AiTopupOrder) {
	const sentAt = new Date().toISOString()
	let changed = false

	if (order.invoice.accountDeliveryStatus === 'PENDING') {
		order.invoice.accountDeliveryStatus = 'SENT'
		order.invoice.accountEmailSentAt = order.invoice.accountEmailSentAt || sentAt
		order.invoice.accountEmailError = null
		changed = true
	}

	if (order.invoice.deliveryStatus === 'PENDING') {
		order.invoice.deliveryStatus = 'SENT'
		order.invoice.emailSentAt = order.invoice.emailSentAt || sentAt
		order.invoice.emailError = null
		changed = true
	}

	if (changed) order.invoice.updatedAt = sentAt
}

function resolveMisaEmailDeliveryStatus(
	sendEmailResult: Record<string, unknown>
): InvoiceDeliveryStatus {
	const status =
		readString(sendEmailResult.SendEmailStatus) ||
		readString(sendEmailResult.Status) ||
		readString(sendEmailResult.status)

	if (status === '3') return 'SENT'
	if (status === '2') return 'FAILED'
	return 'PENDING'
}

function applyInvoiceEmailDeliveryStatus(
	order: AiTopupOrder,
	receiverEmail: string,
	deliveryStatus: InvoiceDeliveryStatus,
	options?: { deliveryTarget?: 'customer_extra' | 'account' }
) {
	const now = new Date().toISOString()
	order.invoice.updatedAt = now

	if (options?.deliveryTarget === 'account') {
		order.invoice.accountDeliveryEmail = receiverEmail
		order.invoice.accountDeliveryStatus = deliveryStatus
		order.invoice.accountEmailError = null
		if (deliveryStatus === 'SENT') {
			order.invoice.accountEmailSentAt = order.invoice.accountEmailSentAt || now
		}
		return
	}

	order.invoice.deliveryEmail = receiverEmail
	order.invoice.emailDeliveryRequested = true
	order.invoice.deliveryStatus = deliveryStatus
	order.invoice.emailError = null
	if (deliveryStatus === 'SENT') {
		order.invoice.emailSentAt = order.invoice.emailSentAt || now
	}
}

function logAiTopupInvoiceState(order: AiTopupOrder, event: string, error?: unknown) {
	console.info('OCC AI top-up invoice state', {
		event,
		orderCode: order.orderCode,
		userId: order.userId,
		invoiceStatus: order.invoice.status,
		misaRefId: order.invoice.misa.refId,
		misaTransactionId: order.invoice.misa.transactionId,
		invoiceNumber: order.invoice.invoiceNumber,
		invoiceSeries: order.invoice.misa.invoiceSeries,
		error: error instanceof Error ? error.message : error ? String(error) : null,
	})
}

export async function prepareAiTopupInvoice(order: AiTopupOrder) {
	if (order.status !== 'CREDITED' && order.status !== 'PAID') {
		return order
	}
	if (order.invoice.status === 'PUBLISHING' || order.invoice.status === 'PUBLISHED') {
		return order
	}

	order.invoice.status = 'PUBLISHING'
	order.invoice.error = null
	order.invoice.updatedAt = new Date().toISOString()
	await saveAiTopupOrder(order)
	logAiTopupInvoiceState(order, 'publish-started')

	const payload = createMisaAiTopupInvoicePayload(order)
	const publishPayload: MisaPublishingPayload = {
		SignType: config.misa.signType,
		InvoiceData: [payload],
	}

	try {
		const response = await postMisa<MisaApiResponse<Record<string, unknown>>>(
			misaPublishPath(),
			publishPayload
		)
		const result = extractPublishResult(response, payload.RefID)
		order.invoice.status = 'PUBLISHING'
		order.invoice.invoiceNumber = result.invoiceNumber
		order.invoice.issuedAt = result.issuedAt || new Date().toISOString()
		order.invoice.misa.refId = result.refId
		order.invoice.misa.transactionId = result.transactionId
		order.invoice.misa.invoiceId = result.invoiceId
		order.invoice.misa.invoiceSeries = payload.InvSeries
		order.invoice.misa.rawStatus = result.rawStatus
		order.invoice.error = null
		order.invoice.updatedAt = new Date().toISOString()
		const savedOrder = await saveAiTopupOrder(order)
		logAiTopupInvoiceState(savedOrder, 'publish-result-received')
		return refreshAiTopupInvoice(savedOrder)
	} catch (error) {
		order.invoice.status = 'FAILED'
		order.invoice.error =
			error instanceof Error ? error.message : 'AI top-up invoice publish failed'
		order.invoice.updatedAt = new Date().toISOString()
		const savedOrder = await saveAiTopupOrder(order)
		logAiTopupInvoiceState(savedOrder, 'failed', error)
		return savedOrder
	}
}

async function syncAiTopupInvoiceStatus(order: AiTopupOrder) {
	const transactionId = order.invoice.misa.transactionId
	if (!transactionId) return order

	const response = await postMisa<MisaApiResponse<string | MisaInvoiceStatusResult[]>>(
		misaOperationPath('status'),
		[transactionId]
	)
	const statuses = asArray(unwrapMisaData(response))
	const status = asRecord(statuses[0])
	const errorCode = readString(status.ErrorCode) || readString(status.errorCode)
	if (errorCode) {
		throw createHttpError(`MISA AI top-up invoice status failed: ${errorCode}`, 502)
	}

	order.invoice.misa.publishStatus =
		readString(status.PublishStatus) ||
		readString(status.StatusCode) ||
		readString(status.StatusName) ||
		readString(status.PublishStatusName) ||
		order.invoice.misa.publishStatus
	order.invoice.misa.sendTaxStatus =
		readString(status.SendTaxStatus) || order.invoice.misa.sendTaxStatus
	order.invoice.misa.taxAuthorityCode =
		readString(status.InvoiceCode) ||
		readString(status.TaxAuthorityCode) ||
		readString(status.CodeOfTax) ||
		order.invoice.misa.taxAuthorityCode
	order.invoice.misa.rawStatus = JSON.stringify(status) || order.invoice.misa.rawStatus
	if (readBoolean(status.IsSentEmail) === true) {
		markPendingInvoiceEmailsSent(order)
	}
	order.invoice.updatedAt = new Date().toISOString()
	return saveAiTopupOrder(order)
}

async function pollAiTopupInvoiceStatus(order: AiTopupOrder) {
	let savedOrder = order

	for (let attempt = 1; attempt <= 3; attempt += 1) {
		savedOrder = await syncAiTopupInvoiceStatus(savedOrder)
		const status = asRecord(parseMisaData(savedOrder.invoice.misa.rawStatus))
		if (isFailedStatus(status)) {
			const errorCode =
				readString(status.ErrorCode) ||
				readString(status.errorCode) ||
				'MISA AI top-up invoice status failed'
			throw createHttpError(`MISA AI top-up invoice status failed: ${errorCode}`, 502)
		}
		if (isPublishedStatus(status)) return savedOrder
		if (attempt < 3) await delay(3000)
	}

	return savedOrder
}

async function loadAiTopupInvoiceView(order: AiTopupOrder) {
	const transactionId = order.invoice.misa.transactionId
	if (!transactionId) return order
	if (order.invoice.downloadUrl) return order

	const response = await postMisa<MisaApiResponse<string>>(
		misaOperationPath('publishView'),
		[transactionId]
	)
	const data = unwrapMisaData(response)
	const parsedData = parseMisaData(data)
	const publishViewItems = Array.isArray(parsedData)
		? parsedData
		: parsedData
			? [parsedData]
			: []
	const publishViewRecord = asRecord(publishViewItems[0])
	const publishViewUrl =
		readHttpUrl(publishViewItems[0]) ||
		readHttpUrl(publishViewRecord.Link) ||
		readHttpUrl(publishViewRecord.link) ||
		readHttpUrl(publishViewRecord.Url) ||
		readHttpUrl(publishViewRecord.URL)
	if (publishViewUrl) {
		order.invoice.downloadUrl = publishViewUrl
		order.invoice.status = 'PUBLISHED'
		order.invoice.error = null
		order.invoice.updatedAt = new Date().toISOString()
	}
	return saveAiTopupOrder(order)
}

async function sendPublishedAiTopupInvoiceEmail(
	order: AiTopupOrder,
	email: string,
	options?: { deliveryTarget?: 'customer_extra' | 'account' }
) {
	const transactionId = order.invoice.misa.transactionId
	const receiverEmail = email.trim()
	if (!transactionId || !receiverEmail) return order

	const payload: MisaSendEmailPayload = {
		SendEmailDatas: [
			{
				TransactionID: transactionId,
				ReceiverName:
					order.invoice.buyerName ||
					order.invoice.buyerCompanyName ||
					order.userSnapshot.name ||
					'',
				ReceiverEmail: receiverEmail,
				CCEmail: '',
				BCCEmail: null,
				ReplyEmail: '',
			},
		],
		IsInvoiceCode: isInvoiceCodeMode(),
		IsInvoiceCalculatingMachine: isInvoiceCalculatingMachine(),
	}
	const response = await postMisa<MisaApiResponse<string>>(
		misaOperationPath('sendEmail'),
		payload
	)
	const data = unwrapMisaData(response)
	const sendEmailResult = asRecord(asArray(data)[0])
	const errorCode =
		readString(sendEmailResult.ErrorCode) || readString(sendEmailResult.errorCode)
	const deliveryStatus = resolveMisaEmailDeliveryStatus(sendEmailResult)
	if (errorCode || deliveryStatus === 'FAILED') {
		throw createHttpError(
			`MISA AI top-up invoice email failed: ${errorCode || 'SendEmailStatus=2'}`,
			502
		)
	}

	applyInvoiceEmailDeliveryStatus(order, receiverEmail, deliveryStatus, options)
	return saveAiTopupOrder(order)
}

async function sendAccountAiTopupInvoiceEmailAfterPublish(order: AiTopupOrder) {
	if (!order.invoice.detailsProvided || order.invoice.status !== 'PUBLISHED') {
		return order
	}

	const accountEmail = String(order.userSnapshot.email || '').trim()
	if (!isEmail(accountEmail)) return order
	if (!isInvoiceReadyForEmail(order)) return order
	if (
		order.invoice.accountDeliveryEmail === accountEmail &&
		(order.invoice.accountDeliveryStatus === 'SENT' ||
			order.invoice.accountDeliveryStatus === 'PENDING')
	) {
		return order
	}

	order.invoice.accountDeliveryEmail = accountEmail
	order.invoice.accountDeliveryStatus = 'PENDING'
	order.invoice.accountEmailError = null
	order.invoice.updatedAt = new Date().toISOString()
	let savedOrder = await saveAiTopupOrder(order)

	try {
		savedOrder = await sendPublishedAiTopupInvoiceEmail(savedOrder, accountEmail, {
			deliveryTarget: 'account',
		})
		return savedOrder
	} catch (error) {
		savedOrder.invoice.accountDeliveryStatus = 'FAILED'
		savedOrder.invoice.accountEmailError =
			error instanceof Error ? error.message : 'MISA AI top-up invoice email failed'
		savedOrder.invoice.updatedAt = new Date().toISOString()
		return saveAiTopupOrder(savedOrder)
	}
}

async function completeAiTopupInvoice(order: AiTopupOrder) {
	let savedOrder = order

	try {
		savedOrder = await pollAiTopupInvoiceStatus(savedOrder)
	} catch (error) {
		savedOrder.invoice.error =
			error instanceof Error ? error.message : 'AI top-up invoice status sync failed'
		savedOrder.invoice.updatedAt = new Date().toISOString()
		savedOrder = await saveAiTopupOrder(savedOrder)
		logAiTopupInvoiceState(savedOrder, 'status-refresh-failed', error)
		return savedOrder
	}

	const latestStatus = asRecord(parseMisaData(savedOrder.invoice.misa.rawStatus))
	if (!isPublishedStatus(latestStatus)) {
		try {
			savedOrder.invoice.status = 'PUBLISHING'
			savedOrder = await loadAiTopupInvoiceView(savedOrder)
			if (savedOrder.invoice.status !== 'PUBLISHED') {
				savedOrder.invoice.status = 'PUBLISHING'
				savedOrder.invoice.error = null
				savedOrder.invoice.updatedAt = new Date().toISOString()
				return saveAiTopupOrder(savedOrder)
			}
		} catch {
			savedOrder.invoice.status = 'PUBLISHING'
			savedOrder.invoice.error = null
			savedOrder.invoice.updatedAt = new Date().toISOString()
			return saveAiTopupOrder(savedOrder)
		}
	}

	savedOrder.invoice.status = 'PUBLISHED'
	savedOrder.invoice.error = null
	savedOrder.invoice.updatedAt = new Date().toISOString()
	savedOrder = await saveAiTopupOrder(savedOrder)
	logAiTopupInvoiceState(savedOrder, 'published')

	try {
		savedOrder = await loadAiTopupInvoiceView(savedOrder)
	} catch (error) {
		savedOrder.invoice.error =
			error instanceof Error ? error.message : 'AI top-up invoice publish view failed'
		savedOrder.invoice.updatedAt = new Date().toISOString()
		savedOrder = await saveAiTopupOrder(savedOrder)
		logAiTopupInvoiceState(savedOrder, 'publish-view-failed', error)
	}

	return sendAccountAiTopupInvoiceEmailAfterPublish(savedOrder)
}

export async function refreshAiTopupInvoice(order: AiTopupOrder) {
	const hasPublishedTransaction = Boolean(order.invoice.misa.transactionId)
	const canRefresh =
		order.invoice.status === 'PUBLISHING' ||
		order.invoice.status === 'PUBLISHED'

	if (!hasPublishedTransaction || !canRefresh) return order
	if (order.invoice.status === 'PUBLISHED') {
		let savedOrder = order
		try {
			savedOrder = await syncAiTopupInvoiceStatus(savedOrder)
		} catch {
			// Keep the last published state stable if MISA status is temporarily unavailable.
		}
		try {
			savedOrder = await loadAiTopupInvoiceView(savedOrder)
		} catch {
			// Publish view can be unavailable immediately after publishing.
		}
		return sendAccountAiTopupInvoiceEmailAfterPublish(savedOrder)
	}

	return completeAiTopupInvoice(order)
}

export async function sendAiTopupInvoiceEmail(order: AiTopupOrder, email: string) {
	if (!order.invoice.detailsProvided) {
		throw createHttpError('Invoice email is only available for customer invoices', 409)
	}

	const receiverEmail = String(email || '').trim()
	if (!receiverEmail) throw createHttpError('Invoice email is required')
	if (!isEmail(receiverEmail)) throw createHttpError('Invoice email must be valid')

	const refreshedOrder = await refreshAiTopupInvoice(order)
	if (refreshedOrder.invoice.status !== 'PUBLISHED') {
		throw createHttpError(
			'Invoice email can only be sent after the invoice is published',
			409
		)
	}
	if (!refreshedOrder.invoice.misa.transactionId) {
		throw createHttpError('MISA invoice transaction id is missing', 500)
	}
	if (!isInvoiceReadyForEmail(refreshedOrder)) {
		throw createHttpError(
			'Invoice email can only be sent after MISA tax authority code is available',
			409
		)
	}

	return sendPublishedAiTopupInvoiceEmail(refreshedOrder, receiverEmail)
}
