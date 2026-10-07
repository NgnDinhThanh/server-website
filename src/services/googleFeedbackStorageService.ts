import { Readable } from 'node:stream'
import { google } from 'googleapis'
import { config } from '../config.js'
import type {
	FeedbackFiles,
	FeedbackRequest,
	FeedbackStorageResult,
} from '../types.js'

const folderMimeType = 'application/vnd.google-apps.folder'
const feedbackSheetHeaders = [
	'Feedback ID',
	'Ngay gui',
	'Ho ten',
	'SDT/Zalo',
	'Email',
	'Loai gop y',
	'Noi dung gop y',
	'Link anh',
	'Link video',
	'Link folder Drive',
]

function assertGoogleFeedbackConfig() {
	const hasOAuthConfig = Boolean(
		config.feedback.googleOAuthClientId &&
			config.feedback.googleOAuthClientSecret &&
			config.feedback.googleOAuthRefreshToken
	)
	const hasServiceAccountConfig = Boolean(
		config.feedback.googleServiceAccountEmail && config.feedback.googlePrivateKey
	)
	const missing = [
		['GOOGLE_FEEDBACK_SHEET_ID', config.feedback.googleSheetId],
		['GOOGLE_FEEDBACK_DRIVE_FOLDER_ID', config.feedback.googleDriveFolderId],
	]
		.filter(([, value]) => !value)
		.map(([key]) => key)

	if (!hasOAuthConfig && !hasServiceAccountConfig) {
		missing.push(
			'GOOGLE_OAUTH_CLIENT_ID',
			'GOOGLE_OAUTH_CLIENT_SECRET',
			'GOOGLE_OAUTH_REFRESH_TOKEN'
		)
	}

	if (missing.length) {
		throw new Error(`Missing Google feedback config: ${missing.join(', ')}`)
	}
}

function getGoogleAuth() {
	assertGoogleFeedbackConfig()
	if (
		config.feedback.googleOAuthClientId &&
		config.feedback.googleOAuthClientSecret &&
		config.feedback.googleOAuthRefreshToken
	) {
		const oauth2Client = new google.auth.OAuth2(
			config.feedback.googleOAuthClientId,
			config.feedback.googleOAuthClientSecret,
			config.feedback.googleOAuthRedirectUri
		)
		oauth2Client.setCredentials({
			refresh_token: config.feedback.googleOAuthRefreshToken,
		})
		return oauth2Client
	}

	return new google.auth.JWT({
		email: config.feedback.googleServiceAccountEmail,
		key: config.feedback.googlePrivateKey,
		scopes: [
			'https://www.googleapis.com/auth/drive',
			'https://www.googleapis.com/auth/spreadsheets',
		],
	})
}

function getVietnamDateParts(date: Date) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Ho_Chi_Minh',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	}).formatToParts(date)
	const read = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find(part => part.type === type)?.value || ''

	return {
		year: read('year'),
		month: read('month'),
		day: read('day'),
		hour: read('hour'),
		minute: read('minute'),
		second: read('second'),
	}
}

function formatDateFolder(date: Date) {
	const parts = getVietnamDateParts(date)
	return [parts.year, parts.month, parts.day].join('_')
}

function formatFeedbackId(date: Date) {
	const parts = getVietnamDateParts(date)
	const datePart = [parts.year, parts.month, parts.day].join('')
	const timePart = [parts.hour, parts.minute, parts.second].join('')
	const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase()
	return `FB-${datePart}-${timePart}-${randomPart}`
}

function formatSubmittedAt(date: Date) {
	const parts = getVietnamDateParts(date)
	return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

function sanitizeDriveName(value: string) {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[\\/:*?"<>|#%{}~&]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 80)
}

function escapeDriveQueryValue(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function escapeSheetName(value: string) {
	return `'${value.replace(/'/g, "''")}'`
}

function getFeedbackSheetRange(range: string) {
	return `${escapeSheetName(config.feedback.googleSheetName)}!${range}`
}

function buildFeedbackText(
	input: FeedbackRequest,
	feedbackId: string,
	submittedAt: Date
) {
	return [
		`Feedback ID: ${feedbackId}`,
		`Ngay gui: ${formatSubmittedAt(submittedAt)} GMT+7`,
		`Ho ten: ${input.fullName}`,
		`SDT/Zalo: ${input.phone}`,
		`Email: ${input.email || ''}`,
		`Loai gop y: ${input.type}`,
		`Nguon: ${input.pageUrl || ''}`,
		`Ngon ngu: ${input.language || ''}`,
		'',
		'Noi dung:',
		input.message,
	].join('\n')
}

async function findOrCreateFolder(
	drive: ReturnType<typeof google.drive>,
	name: string,
	parentId: string
) {
	const response = await drive.files.list({
		q: [
			`'${escapeDriveQueryValue(parentId)}' in parents`,
			`name = '${escapeDriveQueryValue(name)}'`,
			`mimeType = '${folderMimeType}'`,
			'trashed = false',
		].join(' and '),
		fields: 'files(id, webViewLink)',
		spaces: 'drive',
		supportsAllDrives: true,
		includeItemsFromAllDrives: true,
	})

	const existing = response.data.files?.[0]
	if (existing?.id) {
		return existing
	}

	const created = await drive.files.create({
		requestBody: {
			name,
			mimeType: folderMimeType,
			parents: [parentId],
		},
		fields: 'id, webViewLink',
		supportsAllDrives: true,
	})

	if (!created.data.id) {
		throw new Error(`Failed to create Drive folder: ${name}`)
	}

	return created.data
}

async function uploadTextFile(
	drive: ReturnType<typeof google.drive>,
	parentId: string,
	name: string,
	content: string
) {
	await drive.files.create({
		requestBody: {
			name,
			parents: [parentId],
			mimeType: 'text/plain',
		},
		media: {
			mimeType: 'text/plain',
			body: Readable.from(Buffer.from(content, 'utf8')),
		},
		fields: 'id, webViewLink',
		supportsAllDrives: true,
	})
}

async function uploadFeedbackFile(
	drive: ReturnType<typeof google.drive>,
	parentId: string,
	prefix: string,
	file: NonNullable<FeedbackFiles['image']>
) {
	const name = `${prefix}-${sanitizeDriveName(file.originalname) || 'attachment'}`
	const uploaded = await drive.files.create({
		requestBody: {
			name,
			parents: [parentId],
			mimeType: file.mimetype,
		},
		media: {
			mimeType: file.mimetype,
			body: Readable.from(file.buffer),
		},
		fields: 'id, webViewLink',
		supportsAllDrives: true,
	})

	if (!uploaded.data.webViewLink) {
		throw new Error(`Failed to upload Drive file: ${name}`)
	}

	return uploaded.data.webViewLink
}

async function appendFeedbackSheetRow(
	sheets: ReturnType<typeof google.sheets>,
	input: FeedbackRequest,
	result: FeedbackStorageResult
) {
	await ensureFeedbackSheetHeader(sheets)
	await sheets.spreadsheets.values.append({
		spreadsheetId: config.feedback.googleSheetId,
		range: getFeedbackSheetRange('A:J'),
		valueInputOption: 'USER_ENTERED',
		insertDataOption: 'INSERT_ROWS',
		requestBody: {
			values: [
				[
					result.feedbackId,
					formatSubmittedAt(result.submittedAt),
					input.fullName,
					input.phone,
					input.email || '',
					input.type,
					input.message,
					result.imageUrl || '',
					result.videoUrl || '',
					result.driveFolderUrl || '',
				],
			],
		},
	})
}

async function ensureFeedbackSheetHeader(sheets: ReturnType<typeof google.sheets>) {
	const response = await sheets.spreadsheets.values.get({
		spreadsheetId: config.feedback.googleSheetId,
		range: getFeedbackSheetRange('A1:J1'),
	})
	const firstRow = response.data.values?.[0] || []
	const hasHeader = feedbackSheetHeaders.every(
		(header, index) => firstRow[index] === header
	)

	if (hasHeader) {
		return
	}

	await sheets.spreadsheets.values.update({
		spreadsheetId: config.feedback.googleSheetId,
		range: getFeedbackSheetRange('A1:J1'),
		valueInputOption: 'USER_ENTERED',
		requestBody: {
			values: [feedbackSheetHeaders],
		},
	})
}

export async function saveFeedback(
	input: FeedbackRequest,
	files: FeedbackFiles
): Promise<FeedbackStorageResult> {
	const submittedAt = new Date()
	const feedbackId = formatFeedbackId(submittedAt)
	const auth = getGoogleAuth()
	const drive = google.drive({ version: 'v3', auth })
	const sheets = google.sheets({ version: 'v4', auth })
	const result: FeedbackStorageResult = {
		feedbackId,
		submittedAt,
	}

	if (files.image || files.video) {
		const dateFolder = await findOrCreateFolder(
			drive,
			formatDateFolder(submittedAt),
			config.feedback.googleDriveFolderId
		)
		const customerName = sanitizeDriveName(input.fullName) || 'Khach hang'
		const feedbackFolder = await findOrCreateFolder(
			drive,
			`${feedbackId} - ${customerName}`,
			dateFolder.id || config.feedback.googleDriveFolderId
		)

		if (!feedbackFolder.id) {
			throw new Error('Failed to prepare feedback Drive folder')
		}

		result.driveFolderUrl = feedbackFolder.webViewLink || ''
		await uploadTextFile(
			drive,
			feedbackFolder.id,
			'feedback.txt',
			buildFeedbackText(input, feedbackId, submittedAt)
		)

		if (files.image) {
			result.imageUrl = await uploadFeedbackFile(
				drive,
				feedbackFolder.id,
				'image',
				files.image
			)
		}
		if (files.video) {
			result.videoUrl = await uploadFeedbackFile(
				drive,
				feedbackFolder.id,
				'video',
				files.video
			)
		}
	}

	await appendFeedbackSheetRow(sheets, input, result)
	return result
}
