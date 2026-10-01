import type { BookDemoRequest, BookDemoResponse } from '../types.js'
import { renderEmailTemplate } from '../utils/emailTemplate.js'
import { sendAuthMail } from './authMailerService.js'

const placeholderYoutubeUrl = 'https://www.youtube.com/@oneclickcabinet'

export async function requestBookDemo(
	input: BookDemoRequest
): Promise<BookDemoResponse> {
	const html = await renderEmailTemplate('book_demo_request', {
		...input,
		workflow: input.workflow || '',
		youtubeUrl: placeholderYoutubeUrl,
	})

	await sendAuthMail({
		to: input.email,
		subject: 'Your OneClick demo request',
		html,
	})

	return {
		success: true,
		msg: 'Demo request submitted. Please check your email.',
		errCls: 'success',
	}
}
