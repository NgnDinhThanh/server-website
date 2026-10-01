import { Schema, model } from 'mongoose';
const userSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },
    role: {
        type: Schema.Types.Mixed,
        default: 2,
    },
    plan: {
        type: String,
        enum: ['Free', 'Pro Designer', 'Pro', 'Premium'],
        default: 'Free',
    },
    subscriptionExpiresAt: {
        type: Date,
        default: null,
    },
    country: {
        type: String,
        trim: true,
    },
    emailVerified: {
        type: Boolean,
        default: true,
    },
    accessToken: {
        type: String,
    },
}, { timestamps: true });
export const UserModel = model('User', userSchema);
