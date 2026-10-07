import { config } from '../config.js'
import {
	TutorialSettingsModel,
	type TutorialSettingsDocument,
} from '../models/TutorialSettings.js'
import {
	TutorialVideoModel,
	type TutorialVideoDocument,
} from '../models/TutorialVideo.js'
import type {
	TutorialIntroVideo,
	TutorialResponse,
	TutorialVideoSnapshot,
} from '../types.js'
import { syncYoutubeTutorials } from './youtubeTutorialSyncService.js'

function toIsoString(value?: Date | null) {
	return value ? value.toISOString() : undefined
}

function toVideoSnapshot(video: TutorialVideoDocument): TutorialVideoSnapshot {
	return {
		youtubeId: video.youtubeId,
		title: video.title,
		youtubeUrl: video.youtubeUrl,
		embedUrl: video.embedUrl,
		thumbnailUrl: video.thumbnailUrl,
		category: video.category,
		module: video.module,
		order: video.order,
		isActive: video.isActive,
		syncedAt: toIsoString(video.syncedAt),
	}
}

function normalizeIntroVideo(
	settings: TutorialSettingsDocument | null
): TutorialIntroVideo | null {
	return settings?.introVideo || null
}

async function readTutorialsFromDb(): Promise<TutorialResponse> {
	const [settings, videos] = await Promise.all([
		TutorialSettingsModel.findOne({ key: 'default' }),
		TutorialVideoModel.find({ isActive: true }).sort({ order: 1, title: 1 }),
	])

	return {
		success: true,
		introVideo: normalizeIntroVideo(settings),
		videos: videos.map(toVideoSnapshot),
		updatedAt: toIsoString(settings?.lastSyncedAt),
	}
}

export async function getTutorials(): Promise<TutorialResponse> {
	const existing = await readTutorialsFromDb()

	if (existing.videos.length > 0) {
		return existing
	}

	if (config.tutorial.youtubeApiKey && config.tutorial.playlistId) {
		await syncYoutubeTutorials()
		return readTutorialsFromDb()
	}

	return {
		...existing,
		msg: 'Tutorial videos have not been synced yet',
	}
}

export async function syncTutorials(): Promise<TutorialResponse> {
	await syncYoutubeTutorials()
	return readTutorialsFromDb()
}
