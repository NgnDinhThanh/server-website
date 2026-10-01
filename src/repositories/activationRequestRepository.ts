import type { SubscriptionActivationRequest } from '../types.js'
import { ActivationRequestModel } from '../models/ActivationRequest.js'

export async function getActivationRequest(requestId: string) {
	return ((await ActivationRequestModel.findOne({ requestId }).lean()) ||
		undefined) as SubscriptionActivationRequest | undefined
}

export async function getActivationRequestByOrderCode(orderCode: number | string) {
	return ((await ActivationRequestModel.findOne({
		orderCode: Number(orderCode),
	}).lean()) || undefined) as SubscriptionActivationRequest | undefined
}

export async function saveActivationRequest(
	request: SubscriptionActivationRequest
) {
	const saved = await ActivationRequestModel.findOneAndUpdate(
		{ requestId: request.requestId },
		request,
		{ new: true, upsert: true, setDefaultsOnInsert: true }
	).lean()
	return (saved || request) as SubscriptionActivationRequest
}

export async function listActivationRequests() {
	return (await ActivationRequestModel.find().lean()) as SubscriptionActivationRequest[]
}
