import { Schema, model } from 'mongoose';
const aiTokenBalanceSchema = new Schema({
    userId: { type: String, required: true, unique: true, index: true },
    availableTokens: { type: Number, required: true, default: 0 },
    updatedAt: { type: String, required: true },
}, {});
export const AiTokenBalanceModel = model('AiTokenBalance', aiTokenBalanceSchema);
