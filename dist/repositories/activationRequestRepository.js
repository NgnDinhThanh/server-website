import { ActivationRequestModel } from '../models/ActivationRequest.js';
export async function getActivationRequest(requestId) {
    return ((await ActivationRequestModel.findOne({ requestId }).lean()) ||
        undefined);
}
export async function getActivationRequestByOrderCode(orderCode) {
    return ((await ActivationRequestModel.findOne({
        orderCode: Number(orderCode),
    }).lean()) || undefined);
}
export async function saveActivationRequest(request) {
    const saved = await ActivationRequestModel.findOneAndUpdate({ requestId: request.requestId }, request, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
    return (saved || request);
}
export async function listActivationRequests() {
    return (await ActivationRequestModel.find().lean());
}
