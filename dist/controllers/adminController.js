import { activateSubscriptionRequest, listPendingActivationRequests, } from '../services/activationRequestService.js';
import { getAuthenticatedUserSnapshot } from '../utils/authenticatedRequest.js';
export async function listActivationRequests(req, res, next) {
    try {
        res.json({ requests: await listPendingActivationRequests() });
    }
    catch (error) {
        next(error);
    }
}
export async function activateRequest(req, res, next) {
    try {
        const result = await activateSubscriptionRequest({
            requestId: String(req.params.requestId || ''),
            adminUser: getAuthenticatedUserSnapshot(req),
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
}
