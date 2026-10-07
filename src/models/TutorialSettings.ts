import { Schema, model, type Document } from 'mongoose'
import type { TutorialIntroVideo } from '../types.js'

export type TutorialSettingsDocument = Document & {
	key: string
	playlistId?: string
	introVideo?: TutorialIntroVideo | null
	lastSyncedAt?: Date | null
	createdAt: Date
	updatedAt: Date
}

const introVideoSchema = new Schema<TutorialIntroVideo>(
	{
		youtubeId: {
			type: String,
			required: true,
			trim: true,
		},
		title: {
			type: String,
			required: true,
			trim: true,
		},
		youtubeUrl: {
			type: String,
			required: true,
			trim: true,
		},
		embedUrl: {
			type: String,
			required: true,
			trim: true,
		},
		thumbnailUrl: {
			type: String,
			trim: true,
		},
		updatedAt: {
			type: String,
			trim: true,
		},
	},
	{ _id: false }
)

const tutorialSettingsSchema = new Schema<TutorialSettingsDocument>(
	{
		key: {
			type: String,
			required: true,
			unique: true,
			default: 'default',
			trim: true,
		},
		playlistId: {
			type: String,
			trim: true,
		},
		introVideo: {
			type: introVideoSchema,
			default: null,
		},
		lastSyncedAt: {
			type: Date,
			default: null,
		},
	},
	{ timestamps: true }
)

export const TutorialSettingsModel = model<TutorialSettingsDocument>(
	'TutorialSettings',
	tutorialSettingsSchema
)
