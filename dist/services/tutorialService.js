import { config } from '../config.js';
import { TutorialSettingsModel, } from '../models/TutorialSettings.js';
import { TutorialVideoModel, } from '../models/TutorialVideo.js';
import { syncYoutubeTutorials } from './youtubeTutorialSyncService.js';
function toIsoString(value) {
    return value ? value.toISOString() : undefined;
}
function toVideoSnapshot(video) {
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
    };
}
function normalizeIntroVideo(settings) {
    return settings?.introVideo || null;
}
async function readTutorialsFromDb() {
    const [settings, videos] = await Promise.all([
        TutorialSettingsModel.findOne({ key: 'default' }),
        TutorialVideoModel.find({ isActive: true }).sort({ order: 1, title: 1 }),
    ]);
    return {
        success: true,
        introVideo: normalizeIntroVideo(settings),
        videos: videos.map(toVideoSnapshot),
        updatedAt: toIsoString(settings?.lastSyncedAt),
    };
}
export async function getTutorials() {
    const existing = await readTutorialsFromDb();
    if (existing.videos.length > 0) {
        return existing;
    }
    if (config.tutorial.youtubeApiKey && config.tutorial.playlistId) {
        await syncYoutubeTutorials();
        return readTutorialsFromDb();
    }
    return {
        ...existing,
        msg: 'Tutorial videos have not been synced yet',
    };
}
export async function syncTutorials() {
    await syncYoutubeTutorials();
    return readTutorialsFromDb();
}
