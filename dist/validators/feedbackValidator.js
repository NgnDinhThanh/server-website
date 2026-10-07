import { config } from '../config.js';
const emailRegex = /.+@.+\..+/;
const allowedTypes = new Set([
    'Bug / Issue',
    'Feature Suggestion',
    'Workflow Improvement',
    'Other',
    'Lỗi / Vấn đề',
    'Đề xuất tính năng',
    'Cải thiện quy trình',
    'Khác',
]);
function readString(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function error(msg) {
    return {
        ok: false,
        status: 200,
        body: { success: false, msg, errCls: 'error' },
    };
}
export function validateFeedbackRequest(body, files) {
    const fullName = readString(body.fullName);
    const phone = readString(body.phone);
    const email = readString(body.email).toLowerCase();
    const type = readString(body.type);
    const message = readString(body.message);
    const pageUrl = readString(body.pageUrl);
    const language = readString(body.language);
    if (!fullName || !phone || !type || !message) {
        return error('Please complete all required fields');
    }
    if (email && !emailRegex.test(email)) {
        return error('Please enter a valid email address');
    }
    if (!allowedTypes.has(type)) {
        return error('Please select a valid feedback type');
    }
    if (files.image) {
        if (!files.image.mimetype.startsWith('image/')) {
            return error('Image attachment must be an image file');
        }
        if (files.image.size > config.feedback.maxImageBytes) {
            return error('Image attachment is too large');
        }
    }
    if (files.video) {
        if (!files.video.mimetype.startsWith('video/')) {
            return error('Video attachment must be a video file');
        }
        if (files.video.size > config.feedback.maxVideoBytes) {
            return error('Video attachment is too large');
        }
    }
    return {
        ok: true,
        value: {
            fullName,
            phone,
            type,
            message,
            ...(email ? { email } : {}),
            ...(pageUrl ? { pageUrl } : {}),
            ...(language ? { language } : {}),
        },
    };
}
