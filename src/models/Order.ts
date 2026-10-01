import { Schema, model, type Document } from 'mongoose'
import type { Order } from '../types.js'

export type OrderDocument = Document & Order

const orderSchema = new Schema<OrderDocument>(
	{
		userId: { type: String, required: true, index: true },
		paymentId: { type: String, required: true, index: true },
		orderCode: { type: Number, required: true, unique: true, index: true },
		planId: { type: String, required: true },
		planName: { type: String, required: true },
		items: { type: [Schema.Types.Mixed as unknown as Record<string, unknown>], default: [] },
		months: { type: Number, required: true },
		amount: { type: Number, required: true },
		currency: { type: String, required: true },
		invoice: { type: Schema.Types.Mixed, required: true },
		checkoutSessionId: { type: String, index: true },
		description: { type: String, required: true },
		status: { type: String, required: true, index: true },
		activationStatus: { type: String, required: true, index: true },
		createdAt: { type: String, required: true },
		updatedAt: { type: String, required: true },
		expiresAt: { type: String, required: true },
		paidAt: { type: String },
		subscription: { type: Schema.Types.Mixed },
		reused: { type: Boolean, default: false },
		userSnapshot: { type: Schema.Types.Mixed, required: true },
	},
	{ strict: false }
)

export const OrderModel = model<OrderDocument>('Order', orderSchema)
