import { Schema, model } from 'mongoose';
const introVideoSchema = new Schema({
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
}, { _id: false });
const tutorialSettingsSchema = new Schema({
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
}, { timestamps: true });
export const TutorialSettingsModel = model('TutorialSettings', tutorialSettingsSchema);
