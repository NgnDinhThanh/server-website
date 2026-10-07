import { Schema, model } from 'mongoose';
const aiTokenLedgerSchema = new Schema({
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
}, {});
export const AiTokenLedgerModel = model('AiTokenLedger', aiTokenLedgerSchema);
