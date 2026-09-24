import { config } from '../config.js'
import { getAccount } from '../repositories/accountRepository.js'
import { getPayment } from '../repositories/paymentRepository.js'
import type { Order } from '../types.js'

export function publicOrder(order: Order) {
	const invoice = order.invoice
	const account = getAccount(order.accountId)
	const payment = getPayment(order.paymentId)
	return {
		orderCode: order.orderCode,
		accountId: order.accountId,
		account: account
			? {
				accountId: account.accountId,
				email: account.email,
				name: account.name,
			}
			: null,
		buyerSnapshot: order.buyerSnapshot,
		provider: order.provider,
		planId: order.planId,
		planName: order.planName,
		months: order.months,
		amount: order.amount,
		currency: order.currency,
		description: order.description,
		status: order.status,
		paymentStatus: order.status,
		activationStatus: order.activationStatus,
		providerOrderId: order.providerOrderId,
		providerCaptureId: order.providerCaptureId,
		paymentId: order.paymentId,
		payment: payment
			? {
				paymentId: payment.paymentId,
				orderCode: payment.orderCode,
				provider: payment.provider,
				providerOrderId: payment.providerOrderId,
				providerCaptureId: payment.providerCaptureId,
				amount: payment.amount,
				currency: payment.currency,
				status: payment.status,
				checkoutUrl: payment.checkoutUrl,
				qrCode: payment.qrCode,
				bank: payment.bank,
				paidAt: payment.paidAt,
				amountPaid: payment.amountPaid,
				amountRemaining: payment.amountRemaining,
				createdAt: payment.createdAt,
				updatedAt: payment.updatedAt,
				expiresAt: payment.expiresAt,
			}
			: null,
		user: order.user,
		paymentLinkId: order.paymentLinkId,
		checkoutUrl: order.checkoutUrl,
		qrCode: order.qrCode,
		bank: order.bank,
		createdAt: order.createdAt,
		updatedAt: order.updatedAt,
		expiresAt: order.expiresAt,
		paidAt: order.paidAt,
		amountPaid: order.amountPaid,
		subscription: order.subscription ?? null,
		invoiceProvider: invoice?.provider,
		invoiceRequested: invoice?.requested,
		invoiceStatus: invoice?.status,
		invoicePreviewUrl: invoice?.previewUrl ?? null,
		invoiceDownloadUrl: invoice?.downloadUrl ?? null,
		invoiceNumber: invoice?.invoiceNumber ?? null,
		invoiceIssuedAt: invoice?.issuedAt ?? null,
		invoiceError: invoice?.error ?? null,
		reused: Boolean(order.reused),
		isForcedTestAmount: Boolean(config.forcedTestAmount),
	}
}
