import { AiTokenBalanceModel } from '../models/AiTokenBalance.js'
import { AiTokenLedgerModel } from '../models/AiTokenLedger.js'
import type { AiTokenBalance, AiTokenLedgerEntry } from '../types.js'

export async function getAiTokenBalance(
	userId: string
): Promise<AiTokenBalance | undefined> {
	return ((await AiTokenBalanceModel.findOne({ userId }).lean()) ||
		undefined) as AiTokenBalance | undefined
}

export async function saveAiTokenBalance(
	balance: AiTokenBalance
): Promise<AiTokenBalance> {
	const saved = await AiTokenBalanceModel.findOneAndUpdate(
		{ userId: balance.userId },
		balance,
		{ upsert: true, new: true, setDefaultsOnInsert: true, lean: true }
	)
	return (saved || balance) as AiTokenBalance
}

export async function getAiTokenLedgerEntry(
	entryId: string
): Promise<AiTokenLedgerEntry | undefined> {
	return ((await AiTokenLedgerModel.findOne({ entryId }).lean()) ||
		undefined) as AiTokenLedgerEntry | undefined
}

export async function saveAiTokenLedgerEntry(
	entry: AiTokenLedgerEntry
): Promise<AiTokenLedgerEntry> {
	const saved = await AiTokenLedgerModel.findOneAndUpdate(
		{ entryId: entry.entryId },
		entry,
		{ upsert: true, new: true, setDefaultsOnInsert: true, lean: true }
	)
	return (saved || entry) as AiTokenLedgerEntry
}

export async function listAiTokenLedgerEntries(
	userId: string
): Promise<AiTokenLedgerEntry[]> {
	return (await AiTokenLedgerModel.find({ userId })
		.sort({ createdAt: -1 })
		.lean()) as AiTokenLedgerEntry[]
}
