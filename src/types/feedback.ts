export type FeedbackRequestBody = {
	fullName?: unknown
	phone?: unknown
	email?: unknown
	type?: unknown
	message?: unknown
	pageUrl?: unknown
	language?: unknown
}

export type FeedbackRequest = {
	fullName: string
	phone: string
	email?: string
	type: string
	message: string
	pageUrl?: string
	language?: string
}

export type FeedbackFile = {
	fieldname: string
	originalname: string
	mimetype: string
	size: number
	buffer: Buffer
}

export type FeedbackFiles = {
	image?: FeedbackFile
	video?: FeedbackFile
}

export type FeedbackStorageResult = {
	feedbackId: string
	submittedAt: Date
	imageUrl?: string
	videoUrl?: string
	driveFolderUrl?: string
}

export type FeedbackResponse = {
	success: boolean
	msg: string
	errCls: 'success' | 'error'
	feedbackId?: string
}
