import { Schema, model } from 'mongoose';
const tutorialVideoSchema = new Schema({
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
}, { timestamps: true });
tutorialVideoSchema.index({ isActive: 1, order: 1 });
export const TutorialVideoModel = model('TutorialVideo', tutorialVideoSchema);
