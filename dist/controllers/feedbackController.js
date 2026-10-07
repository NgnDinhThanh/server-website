import multer from 'multer';
import { config } from '../config.js';
import * as FeedbackService from '../services/feedbackService.js';
import { validateFeedbackRequest } from '../validators/feedbackValidator.js';
export const uploadFeedbackFiles = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: Math.max(config.feedback.maxImageBytes, config.feedback.maxVideoBytes),
        files: 2,
    },
    fileFilter: (req, file, callback) => {
        if (file.fieldname === 'image' && file.mimetype.startsWith('image/')) {
            callback(null, true);
            return;
        }
        if (file.fieldname === 'video' && file.mimetype.startsWith('video/')) {
            callback(null, true);
            return;
        }
        callback(new Error('Unsupported feedback attachment type'));
    },
}).fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
]);
function readFeedbackFiles(req) {
    const files = req.files;
    return {
        image: files?.image?.[0],
        video: files?.video?.[0],
    };
}
export async function requestFeedback(req, res) {
    try {
        const files = readFeedbackFiles(req);
        const validation = validateFeedbackRequest(req.body || {}, files);
        if (!validation.ok) {
            return res.status(validation.status).json(validation.body);
        }
        const result = await FeedbackService.requestFeedback(validation.value, files);
        return res.status(200).json(result);
    }
    catch (error) {
        return res.status(200).json({
            success: false,
            msg: error instanceof Error ? error.message : 'Feedback request failed',
            errCls: 'error',
        });
    }
}
