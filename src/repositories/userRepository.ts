import { UserModel, type UserDocument } from '../models/User.js'
import { USER_ROLE, type UserPlan, type UserRole } from '../types.js'

const USER_PLANS: UserPlan[] = ['Free', 'Pro Designer', 'Pro', 'Premium']

function isUserPlan(value: unknown): value is UserPlan {
	return typeof value === 'string' && USER_PLANS.includes(value as UserPlan)
}

function isUserRole(value: unknown): value is UserRole {
	return value === 0 || value === 1 || value === 2
}

export function normalizeUserDocument(user: UserDocument) {
	const legacyRole = user.role as unknown
	if (!isUserRole(legacyRole)) {
		user.plan = isUserPlan(legacyRole) ? legacyRole : user.plan || 'Free'
		user.role = USER_ROLE.CUSTOMER
	}
	if (!isUserPlan(user.plan)) {
		user.plan = 'Free'
	}
	if (typeof user.subscriptionExpiresAt === 'undefined') {
		user.subscriptionExpiresAt = null
	}
	return user
}

export function findUserByEmail(email: string) {
	return UserModel.findOne({ email: email.toLowerCase() })
}

export function findUserById(id: string) {
	return UserModel.findById(id)
}

export function createUser(input: {
	name: string
	email: string
	passwordHash: string
	country?: string
}) {
	return UserModel.create({
		...input,
		email: input.email.toLowerCase(),
		role: USER_ROLE.CUSTOMER,
		plan: 'Free',
		subscriptionExpiresAt: null,
		emailVerified: true,
	})
}

export function saveUser(user: UserDocument) {
	return user.save()
}
