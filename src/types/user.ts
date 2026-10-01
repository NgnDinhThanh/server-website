export type UserRole = 0 | 1 | 2
export type UserPlan = 'Free' | 'Pro Designer' | 'Pro' | 'Premium'

export const USER_ROLE = {
	SUPER_ADMIN: 0,
	ADMIN: 1,
	CUSTOMER: 2,
} as const

export type AuthUserPayload = {
	id: string
	email: string
	name: string
	role: UserRole
	plan: UserPlan
	country?: string
	emailVerified: boolean
	subscriptionExpiresAt?: Date | null
	createdAt?: Date
	updatedAt?: Date
}

export type UserSnapshot = {
	id: string
	email: string
	name: string
	role: UserRole
	plan: UserPlan
	subscriptionExpiresAt?: Date | null
}
