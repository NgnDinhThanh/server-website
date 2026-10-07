export type TutorialVideoSnapshot = {
	youtubeId: string
	title: string
	youtubeUrl: string
	embedUrl: string
	thumbnailUrl?: string
	category: string
	module: string
	order: number
	isActive: boolean
	syncedAt?: string
}

export type TutorialIntroVideo = {
	youtubeId: string
	title: string
	youtubeUrl: string
	embedUrl: string
	thumbnailUrl?: string
	updatedAt?: string
}

export type TutorialResponse = {
	success: boolean
	introVideo: TutorialIntroVideo | null
	videos: TutorialVideoSnapshot[]
	updatedAt?: string
	msg?: string
}
