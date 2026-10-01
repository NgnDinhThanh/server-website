import { Schema, model, type Document } from 'mongoose'
import type { UserPlan, UserRole } from '../types.js'

export type UserDocument = Document & {
	name: string
	email: string
	passwordHash: string
	role: UserRole
	plan: UserPlan
	subscriptionExpiresAt?: Date | null
	country?: string
	emailVerified: boolean
	accessToken?: string
	createdAt: Date
	updatedAt: Date
}

const userSchema = new Schema<UserDocument>(
	{
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
	},
	{ timestamps: true }
)

export const UserModel = model<UserDocument>('User', userSchema)
