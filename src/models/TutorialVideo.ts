import { Schema, model, type Document } from 'mongoose'

export type TutorialVideoDocument = Document & {
	youtubeId: string
	title: string
	youtubeUrl: string
	embedUrl: string
	thumbnailUrl?: string
	category: string
	module: string
	order: number
	isActive: boolean
	syncedAt?: Date | null
	createdAt: Date
	updatedAt: Date
}

const tutorialVideoSchema = new Schema<TutorialVideoDocument>(
	{
		youtubeId: {
			type: String,
			required: true,
			unique: true,
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
		category: {
			type: String,
			default: 'Getting Started',
			trim: true,
		},
		module: {
			type: String,
			default: 'General',
			trim: true,
		},
		order: {
			type: Number,
			default: 0,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		syncedAt: {
			type: Date,
			default: null,
		},
	},
	{ timestamps: true }
)

tutorialVideoSchema.index({ isActive: 1, order: 1 })

export const TutorialVideoModel = model<TutorialVideoDocument>(
	'TutorialVideo',
	tutorialVideoSchema
)
