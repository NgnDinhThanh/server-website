import { Schema, model, type Document } from 'mongoose'
import type { AiTopupPaymentRecord } from '../types.js'

export type AiTopupPaymentDocument = Document & AiTopupPaymentRecord

const aiTopupPaymentSchema = new Schema<AiTopupPaymentDocument>(
	{
		paymentId: { type: String, required: true, unique: true, index: true },
		orderCode: { type: Number, required: true, index: true },
		provider: { type: String, required: true, index: true },
		providerOrderId: { type: String, index: true },
		providerCaptureId: { type: String, index: true },
		amount: { type: Number, required: true },
		currency: { type: String, required: true },
		status: { type: String, required: true, index: true },
		checkoutUrl: { type: String },
		qrCode: { type: String },
		bank: { type: Schema.Types.Mixed, default: {} },
		description: { type: String, required: true },
		createdAt: { type: String, required: true },
		updatedAt: { type: String, required: true },
		expiresAt: { type: String, required: true },
		paidAt: { type: String },
		amountPaid: { type: Number },
		amountRemaining: { type: Number },
		rawProviderData: { type: Schema.Types.Mixed },
		rawProviderStatus: { type: Schema.Types.Mixed },
		webhook: { type: Schema.Types.Mixed },
	},
	{}
)

export const AiTopupPaymentModel = model<AiTopupPaymentDocument>(
	'AiTopupPayment',
	aiTopupPaymentSchema
)
