import { getAccount, saveAccount } from '../repositories/accountRepository.js'
import { createHttpError } from '../utils/httpError.js'
import type { Account, BuyerSnapshot, CheckoutUser } from '../types.js'

function normalizeCheckoutUser(value: unknown): CheckoutUser {
	const user =
		value && typeof value === 'object'
			? (value as Record<string, unknown>)
			: {}
	const id = String(user.id || '').trim()
	const email = String(user.email || '').trim()
	const name = String(user.name || '').trim()

	if (!id && !email) {
		throw createHttpError('user.id or user.email is required')
	}

	return {
		id,
		email,
		...(name ? { name } : {}),
	}
}

export function resolveCheckoutAccount(value: unknown): {
	account: Account
	buyerSnapshot: BuyerSnapshot
	checkoutUser: CheckoutUser
} {
	const checkoutUser = normalizeCheckoutUser(value)
	const accountId = checkoutUser.id || checkoutUser.email
	const now = new Date().toISOString()
	const existing = getAccount(accountId)
	const account = saveAccount({
		accountId,
		email: checkoutUser.email || existing?.email || '',
		name: checkoutUser.name || existing?.name,
		createdAt: existing?.createdAt || now,
		updatedAt: now,
	})

	return {
		account,
		checkoutUser,
		buyerSnapshot: {
			accountId: account.accountId,
			email: account.email,
			...(account.name ? { name: account.name } : {}),
		},
	}
}
