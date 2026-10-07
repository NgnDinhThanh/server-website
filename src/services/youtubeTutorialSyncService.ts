import { config } from '../config.js'
import { TutorialSettingsModel } from '../models/TutorialSettings.js'
import { TutorialVideoModel } from '../models/TutorialVideo.js'
import type { TutorialIntroVideo } from '../types.js'

type YouTubeThumbnail = {
	url?: string
}

type YouTubeSnippet = {
	title?: string
	thumbnails?: {
		default?: YouTubeThumbnail
		medium?: YouTubeThumbnail
		high?: YouTubeThumbnail
		standard?: YouTubeThumbnail
		maxres?: YouTubeThumbnail
	}
	resourceId?: {
		videoId?: string
	}
}

type YouTubePlaylistResponse = {
	nextPageToken?: string
	items?: {
		snippet?: YouTubeSnippet
		contentDetails?: {
			videoId?: string
		}
	}[]
	error?: {
		message?: string
	}
}

type YouTubeVideoResponse = {
	items?: {
		id?: string
		snippet?: YouTubeSnippet
	}[]
	error?: {
		message?: string
	}
}

const youtubeApiBase = 'https://www.googleapis.com/youtube/v3'
const defaultCategory = 'Getting Started'
const defaultModule = 'General'

function buildYoutubeUrl(videoId: string) {
	return `https://www.youtube.com/watch?v=${videoId}`
}

function buildEmbedUrl(videoId: string) {
	return `https://www.youtube.com/embed/${videoId}`
}

function getThumbnailUrl(thumbnails?: YouTubeSnippet['thumbnails']) {
	return (
		thumbnails?.maxres?.url ||
		thumbnails?.standard?.url ||
		thumbnails?.high?.url ||
		thumbnails?.medium?.url ||
		thumbnails?.default?.url
	)
}

async function fetchYoutubeJson<T>(url: string): Promise<T> {
	const response = await fetch(url)
	const body = (await response.json().catch(() => null)) as
		| (T & { error?: { message?: string } })
		| null

	if (!response.ok) {
		throw new Error(
			body?.error?.message || `YouTube API failed with ${response.status}`
		)
	}
	if (!body) {
		throw new Error('Empty YouTube API response')
	}

	return body
}

async function fetchIntroVideo(videoId: string): Promise<TutorialIntroVideo | null> {
	const params = new URLSearchParams({
		part: 'snippet',
		id: videoId,
		key: config.tutorial.youtubeApiKey,
	})
	const data = await fetchYoutubeJson<YouTubeVideoResponse>(
		`${youtubeApiBase}/videos?${params.toString()}`
	)
	const item = data.items?.[0]
	const title = item?.snippet?.title

	if (!item?.id || !title) {
		return null
	}

	return {
		youtubeId: item.id,
		title,
		youtubeUrl: buildYoutubeUrl(item.id),
		embedUrl: buildEmbedUrl(item.id),
		thumbnailUrl: getThumbnailUrl(item.snippet?.thumbnails),
		updatedAt: new Date().toISOString(),
	}
}

function assertYoutubeConfig() {
	if (!config.tutorial.youtubeApiKey) {
		throw new Error('Missing YOUTUBE_API_KEY in server environment')
	}
	if (!config.tutorial.playlistId) {
		throw new Error('Missing YOUTUBE_TUTORIAL_PLAYLIST_ID in server environment')
	}
}

export async function syncYoutubeTutorials() {
	assertYoutubeConfig()

	const now = new Date()
	const seenYoutubeIds = new Set<string>()
	let pageToken = ''
	let order = 1
	let firstPlaylistIntro: TutorialIntroVideo | null = null

	do {
		const params = new URLSearchParams({
			part: 'snippet,contentDetails',
			playlistId: config.tutorial.playlistId,
			maxResults: '50',
			key: config.tutorial.youtubeApiKey,
		})

		if (pageToken) {
			params.set('pageToken', pageToken)
		}

		const data = await fetchYoutubeJson<YouTubePlaylistResponse>(
			`${youtubeApiBase}/playlistItems?${params.toString()}`
		)

		for (const item of data.items || []) {
			const videoId =
				item.contentDetails?.videoId || item.snippet?.resourceId?.videoId
			const title = item.snippet?.title

			if (
				!videoId ||
				!title ||
				title === 'Private video' ||
				title === 'Deleted video'
			) {
				continue
			}

			seenYoutubeIds.add(videoId)

			const videoSnapshot = {
				youtubeId: videoId,
				title,
				youtubeUrl: buildYoutubeUrl(videoId),
				embedUrl: buildEmbedUrl(videoId),
				thumbnailUrl: getThumbnailUrl(item.snippet?.thumbnails),
				order,
				isActive: true,
				syncedAt: now,
			}

			if (!firstPlaylistIntro) {
				firstPlaylistIntro = {
					youtubeId: videoId,
					title,
					youtubeUrl: videoSnapshot.youtubeUrl,
					embedUrl: videoSnapshot.embedUrl,
					thumbnailUrl: videoSnapshot.thumbnailUrl,
					updatedAt: now.toISOString(),
				}
			}

			await TutorialVideoModel.findOneAndUpdate(
				{ youtubeId: videoId },
				{
					$set: videoSnapshot,
					$setOnInsert: {
						category: defaultCategory,
						module: defaultModule,
					},
				},
				{ upsert: true, new: true }
			)

			order += 1
		}

		pageToken = data.nextPageToken || ''
	} while (pageToken)

	await TutorialVideoModel.updateMany(
		{ youtubeId: { $nin: Array.from(seenYoutubeIds) } },
		{ $set: { isActive: false } }
	)

	const introVideo = config.tutorial.introVideoId
		? await fetchIntroVideo(config.tutorial.introVideoId)
		: firstPlaylistIntro

	await TutorialSettingsModel.findOneAndUpdate(
		{ key: 'default' },
		{
			$set: {
				playlistId: config.tutorial.playlistId,
				introVideo,
				lastSyncedAt: now,
			},
		},
		{ upsert: true, new: true }
	)
}
