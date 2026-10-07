import { Schema, model, type Document } from 'mongoose'
import type { AiTopupOrder } from '../types.js'

export type AiTopupOrderDocument = Document & AiTopupOrder

const aiTopupOrderSchema = new Schema<AiTopupOrderDocument>(
	{
		userId: { type: String, required: true, index: true },
		paymentId: { type: String, required: true, index: true },
		orderCode: { type: Number, required: true, unique: true, index: true },
		amount: { type: Number, required: true },
		currency: { type: String, required: true, index: true },
		unitPricePerToken: { type: Number, required: true },
		tokenAmount: { type: Number, required: true },
		invoice: { type: Schema.Types.Mixed, required: true },
		checkoutSessionId: { type: String, index: true },
		description: { type: String, required: true },
		status: { type: String, required: true, index: true },
		creditStatus: { type: String, required: true, index: true },
		createdAt: { type: String, required: true },
		updatedAt: { type: String, required: true },
		expiresAt: { type: String, required: true },
		paidAt: { type: String },
		creditedAt: { type: String },
		paymentReceiptEmailStatus: { type: String },
		paymentReceiptEmailSentAt: { type: String },
		paymentReceiptEmailError: { type: String },
		reused: { type: Boolean, default: false },
		userSnapshot: { type: Schema.Types.Mixed, required: true },
	},
	{}
)

export const AiTopupOrderModel = model<AiTopupOrderDocument>(
	'AiTopupOrder',
	aiTopupOrderSchema
)
