import { PayOS } from '@payos/node';
let payosClient = null;
function assertPayosEnv() {
    const missing = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'].filter(key => !process.env[key]);
    if (missing.length) {
        const error = new Error(`Missing payOS env: ${missing.join(', ')}`);
        error.status = 500;
        throw error;
    }
}
function getPayos() {
    assertPayosEnv();
    if (!payosClient) {
        payosClient = new PayOS({
            clientId: process.env.PAYOS_CLIENT_ID,
            apiKey: process.env.PAYOS_API_KEY,
            checksumKey: process.env.PAYOS_CHECKSUM_KEY,
        });
    }
    return payosClient;
}
export function normalizePaymentLink(result) {
    return result?.data ?? result;
}
export async function createPaymentRequest(paymentRequest) {
    return normalizePaymentLink(await getPayos().paymentRequests.create(paymentRequest));
}
export async function getPaymentRequest(orderCode) {
    return normalizePaymentLink(await getPayos().paymentRequests.get(orderCode));
}
export async function verifyWebhook(payload) {
    return getPayos().webhooks.verify(payload);
}
export async function confirmWebhook(webhookUrl) {
    return normalizePaymentLink(await getPayos().webhooks.confirm(webhookUrl));
}
