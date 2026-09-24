import type { Account } from '../types.js'

const accounts = new Map<string, Account>()

export function getAccount(accountId: string): Account | undefined {
	return accounts.get(accountId)
}

export function saveAccount(account: Account): Account {
	accounts.set(account.accountId, account)
	return account
}

export function listAccounts(): Account[] {
	return Array.from(accounts.values())
}
