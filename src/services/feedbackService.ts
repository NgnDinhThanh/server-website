import type {
	FeedbackFiles,
	FeedbackRequest,
	FeedbackResponse,
} from '../types.js'
import * as GoogleFeedbackStorageService from './googleFeedbackStorageService.js'

export async function requestFeedback(
	input: FeedbackRequest,
	files: FeedbackFiles
): Promise<FeedbackResponse> {
	const result = await GoogleFeedbackStorageService.saveFeedback(input, files)

	return {
		success: true,
		msg: 'Feedback submitted successfully.',
		errCls: 'success',
		feedbackId: result.feedbackId,
	}
}
