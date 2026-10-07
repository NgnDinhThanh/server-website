import { Schema, model, type Document } from 'mongoose'
import type { AiTokenBalance } from '../types.js'

export type AiTokenBalanceDocument = Document & AiTokenBalance

const aiTokenBalanceSchema = new Schema<AiTokenBalanceDocument>(
	{
		userId: { type: String, required: true, unique: true, index: true },
		availableTokens: { type: Number, required: true, default: 0 },
		updatedAt: { type: String, required: true },
	},
	{}
)

export const AiTokenBalanceModel = model<AiTokenBalanceDocument>(
	'AiTokenBalance',
	aiTokenBalanceSchema
)
