import { Schema, model } from 'mongoose';
const subscriptionEventSchema = new Schema({
    eventId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    orderCode: { type: Number, required: true, unique: true, index: true },
    paymentId: { type: String },
    type: { type: String, required: true },
    previousPlanId: { type: String, default: null },
    previousExpiresAt: { type: String, default: null },
    newPlanId: { type: String, required: true },
    newExpiresAt: { type: String, required: true },
    appliedMonths: { type: Number, required: true },
    appliedAt: { type: String, required: true },
}, {});
export const SubscriptionEventModel = model('SubscriptionEvent', subscriptionEventSchema);
