import * as GoogleFeedbackStorageService from './googleFeedbackStorageService.js';
export async function requestFeedback(input, files) {
    const result = await GoogleFeedbackStorageService.saveFeedback(input, files);
    return {
        success: true,
        msg: 'Feedback submitted successfully.',
        errCls: 'success',
        feedbackId: result.feedbackId,
    };
}
