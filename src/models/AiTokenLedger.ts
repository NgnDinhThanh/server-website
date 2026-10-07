import { Schema, model, type Document } from 'mongoose'
import type { AiTokenLedgerEntry } from '../types.js'

export type AiTokenLedgerDocument = Document & AiTokenLedgerEntry

const aiTokenLedgerSchema = new Schema<AiTokenLedgerDocument>(
	{
		entryId: { type: String, required: true, unique: true, index: true },
		userId: { type: String, required: true, index: true },
		orderCode: { type: Number, index: true },
		paymentId: { type: String, index: true },
		type: { type: String, required: true, index: true },
		tokenDelta: { type: Number, required: true },
		balanceAfter: { type: Number, required: true },
		amount: { type: Number },
		currency: { type: String },
		unitPricePerToken: { type: Number },
		description: { type: String, required: true },
		createdAt: { type: String, required: true },
	},
	{}
)

export const AiTokenLedgerModel = model<AiTokenLedgerDocument>(
	'AiTokenLedger',
	aiTokenLedgerSchema
)
