import { config } from '../config.js'
import { saveAiTopupOrder } from '../repositories/aiTopupOrderRepository.js'
import { renderEmailTemplate } from '../utils/emailTemplate.js'
import { sendAuthMail } from './authMailerService.js'
import type { AiTopupOrder } from '../types.js'

function isEmail(value: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function formatMoney(amount: number, currency: string) {
	return new Intl.NumberFormat(currency === 'VND' ? 'vi-VN' : 'en-US', {
		style: 'currency',
		currency,
		maximumFractionDigits: currency === 'VND' ? 0 : 2,
	}).format(amount)
}

export async function sendAiTopupPaymentReceiptEmail(order: AiTopupOrder) {
	const accountEmail = String(order.userSnapshot.email || '').trim()
	if (!isEmail(accountEmail)) return order
	if (
		order.paymentReceiptEmailStatus === 'SENT' ||
		order.paymentReceiptEmailStatus === 'PENDING'
	) {
		return order
	}

	order.paymentReceiptEmailStatus = 'PENDING'
	order.paymentReceiptEmailError = null
	order.updatedAt = new Date().toISOString()
	let savedOrder = await saveAiTopupOrder(order)

	try {
		const html = await renderEmailTemplate('auth_action', {
			title: 'OneClick AI top-up received',
			message: `We received your AI token top-up payment of ${formatMoney(
				savedOrder.amount,
				savedOrder.currency
			)}. ${savedOrder.tokenAmount.toLocaleString('en-US')} tokens have been credited to your account.`,
			buttonText: 'Open OneClick',
			url: config.frontendUrl,
		})

		await sendAuthMail({
			to: accountEmail,
			subject: 'Your OneClick AI tokens have been credited',
			html,
		})

		savedOrder.paymentReceiptEmailStatus = 'SENT'
		savedOrder.paymentReceiptEmailSentAt = new Date().toISOString()
		savedOrder.paymentReceiptEmailError = null
		savedOrder.updatedAt = savedOrder.paymentReceiptEmailSentAt
		return saveAiTopupOrder(savedOrder)
	} catch (error) {
		savedOrder.paymentReceiptEmailStatus = 'FAILED'
		savedOrder.paymentReceiptEmailError =
			error instanceof Error ? error.message : 'AI top-up receipt email failed'
		savedOrder.updatedAt = new Date().toISOString()
		return saveAiTopupOrder(savedOrder)
	}
}
