export type BookDemoRequestBody = {
	fullName?: unknown
	email?: unknown
	company?: unknown
	country?: unknown
	role?: unknown
	workflow?: unknown
}

export type BookDemoRequest = {
	fullName: string
	email: string
	company: string
	country: string
	role: string
	workflow?: string
}

export type BookDemoResponse = {
	success: boolean
	msg: string
	errCls: 'success' | 'error'
}
