import { Schema, model, type Document } from 'mongoose'
import type { SubscriptionSnapshot } from '../types.js'

export type SubscriptionDocument = Document & SubscriptionSnapshot

const subscriptionSchema = new Schema<SubscriptionDocument>(
	{
		userId: { type: String, required: true, unique: true, index: true },
		planId: { type: String, required: true },
		planName: { type: String, required: true },
		status: { type: String, required: true, index: true },
		startsAt: { type: String, required: true },
		expiresAt: { type: String, required: true, index: true },
		previousPlanId: { type: String, default: null },
		previousExpiresAt: { type: String, default: null },
		renewalType: { type: String, required: true },
		appliedMonths: { type: Number, required: true },
		appliedOrderCode: { type: Number, required: true, index: true },
		appliedAt: { type: String, required: true },
	},
	{}
)

export const SubscriptionModel = model<SubscriptionDocument>(
	'Subscription',
	subscriptionSchema
)
