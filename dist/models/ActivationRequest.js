import { Schema, model } from 'mongoose';
const activationRequestSchema = new Schema({
    requestId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    user: { type: Schema.Types.Mixed, required: true },
    orderCode: { type: Number, required: true, unique: true, index: true },
    paymentId: { type: String, required: true, index: true },
    planId: { type: String, required: true },
    planName: { type: String, required: true },
    months: { type: Number, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    paymentProvider: { type: String, required: true },
    status: { type: String, required: true, index: true },
    renewalType: { type: String, required: true },
    previousPlanId: { type: String, default: null },
    previousExpiresAt: { type: String, default: null },
    requestedAt: { type: String, required: true },
    activatedAt: { type: String, default: null },
    activatedByUserId: { type: String, default: null },
}, {});
export const ActivationRequestModel = model('ActivationRequest', activationRequestSchema);
