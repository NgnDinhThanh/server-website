import { AiTokenBalanceModel } from '../models/AiTokenBalance.js';
import { AiTokenLedgerModel } from '../models/AiTokenLedger.js';
export async function getAiTokenBalance(userId) {
    return ((await AiTokenBalanceModel.findOne({ userId }).lean()) ||
        undefined);
}
export async function saveAiTokenBalance(balance) {
    const saved = await AiTokenBalanceModel.findOneAndUpdate({ userId: balance.userId }, balance, { upsert: true, new: true, setDefaultsOnInsert: true, lean: true });
    return (saved || balance);
}
export async function getAiTokenLedgerEntry(entryId) {
    return ((await AiTokenLedgerModel.findOne({ entryId }).lean()) ||
        undefined);
}
export async function saveAiTokenLedgerEntry(entry) {
    const saved = await AiTokenLedgerModel.findOneAndUpdate({ entryId: entry.entryId }, entry, { upsert: true, new: true, setDefaultsOnInsert: true, lean: true });
    return (saved || entry);
}
export async function listAiTokenLedgerEntries(userId) {
    return (await AiTokenLedgerModel.find({ userId })
        .sort({ createdAt: -1 })
        .lean());
}
