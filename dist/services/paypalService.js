import { config } from '../config.js';
import { createHttpError } from '../utils/httpError.js';
let accessTokenCache = null;
function assertPaypalEnv() {
    const missing = [
        ['PAYPAL_CLIENT_ID', config.paypal.clientId],
        ['PAYPAL_CLIENT_SECRET', config.paypal.clientSecret],
    ].filter(([, value]) => !value);
    if (missing.length) {
        throw createHttpError(`Missing PayPal env: ${missing.map(([key]) => key).join(', ')}`, 500);
    }
}
function paypalUrl(path) {
    return `${config.paypal.apiBase.replace(/\/$/, '')}${path}`;
}
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function isAbortError(error) {
    return error instanceof Error && error.name === 'AbortError';
}
function getErrorCode(error) {
    const cause = error?.cause;
    return cause?.code || error?.code || '';
}
function isTransientPaypalError(error) {
    if (isAbortError(error))
        return true;
    const code = getErrorCode(error);
    if (code === 'UND_ERR_CONNECT_TIMEOUT' ||
        code === 'UND_ERR_HEADERS_TIMEOUT' ||
        code === 'UND_ERR_BODY_TIMEOUT' ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT') {
        return true;
    }
    const status = error?.status;
    return Boolean(status && [408, 429, 500, 502, 503, 504].includes(status));
}
function describePaypalError(error) {
    if (error instanceof Error) {
        const code = getErrorCode(error);
        return code ? `${error.message} (${code})` : error.message;
    }
    return String(error);
}
async function fetchWithTimeout(url, init, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal,
        });
    }
    finally {
        clearTimeout(timeout);
    }
}
async function runPaypalRequestWithRetry(label, request, retries = config.paypal.requestRetries) {
    let attempt = 0;
    while (true) {
        try {
            return await request();
        }
        catch (error) {
            const retryable = isTransientPaypalError(error);
            if (!retryable || attempt >= retries) {
                throw error;
            }
            attempt += 1;
            const delayMs = 500 * attempt;
            console.warn(`PayPal ${label} failed; retrying ${attempt}/${retries} in ${delayMs}ms: ${describePaypalError(error)}`);
            await wait(delayMs);
        }
    }
}
async function parsePaypalResponse(response) {
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    if (!response.ok) {
        const message = body?.message ||
            body?.error_description ||
            body?.details?.[0]?.description ||
            `PayPal request failed with ${response.status}`;
        throw createHttpError(message, response.status);
    }
    return body;
}
export async function getPaypalAccessToken() {
    assertPaypalEnv();
    if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) {
        return accessTokenCache.token;
    }
    const credentials = Buffer.from(`${config.paypal.clientId}:${config.paypal.clientSecret}`).toString('base64');
    const response = await runPaypalRequestWithRetry('access token request', () => fetchWithTimeout(paypalUrl('/v1/oauth2/token'), {
        method: 'POST',
        headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    }, config.paypal.requestTimeoutMs));
    const body = await parsePaypalResponse(response);
    const token = String(body.access_token || '');
    const expiresIn = Number(body.expires_in || 0);
    if (!token) {
        throw createHttpError('PayPal did not return an access token', 502);
    }
    accessTokenCache = {
        token,
        expiresAt: Date.now() + Math.max(expiresIn - 60, 60) * 1000,
    };
    return token;
}
export async function paypalRequest(path, init = {}) {
    const token = await getPaypalAccessToken();
    const { timeoutMs, retries, ...requestInit } = init;
    const response = await runPaypalRequestWithRetry(`${path} request`, () => fetchWithTimeout(paypalUrl(path), {
        ...requestInit,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(requestInit.headers || {}),
        },
    }, timeoutMs || config.paypal.requestTimeoutMs), retries);
    return parsePaypalResponse(response);
}
export async function createPaypalOrder({ orderCode, amountValue, currency, description, planName, months, }) {
    return paypalRequest('/v2/checkout/orders', {
        method: 'POST',
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [
                {
                    reference_id: String(orderCode),
                    custom_id: String(orderCode),
                    invoice_id: `OCC-${orderCode}`,
                    description,
                    amount: {
                        currency_code: currency,
                        value: amountValue,
                        breakdown: {
                            item_total: {
                                currency_code: currency,
                                value: amountValue,
                            },
                        },
                    },
                    items: [
                        {
                            name: `${planName} subscription`,
                            quantity: String(months),
                            unit_amount: {
                                currency_code: currency,
                                value: (Number(amountValue) / months).toFixed(2),
                            },
                        },
                    ],
                },
            ],
        }),
    });
}
export async function capturePaypalOrder(paypalOrderId) {
    return paypalRequest(`/v2/checkout/orders/${paypalOrderId}/capture`, {
        method: 'POST',
        body: '{}',
    });
}
export async function getPaypalOrder(paypalOrderId) {
    return paypalRequest(`/v2/checkout/orders/${paypalOrderId}`);
}
export async function verifyPaypalWebhook({ headers, event, }) {
    if (!config.paypal.webhookId) {
        throw createHttpError('Missing PayPal env: PAYPAL_WEBHOOK_ID', 500);
    }
    const verificationPayload = {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: config.paypal.webhookId,
        webhook_event: event,
    };
    const missingHeaders = [
        'paypal-auth-algo',
        'paypal-cert-url',
        'paypal-transmission-id',
        'paypal-transmission-sig',
        'paypal-transmission-time',
    ].filter(key => !headers[key]);
    if (missingHeaders.length) {
        console.warn('PayPal webhook is missing signature headers', {
            eventType: event.event_type,
            eventId: event.id,
            missingHeaders,
        });
    }
    const verification = await paypalRequest('/v1/notifications/verify-webhook-signature', {
        method: 'POST',
        body: JSON.stringify(verificationPayload),
    });
    const verificationStatus = String(verification.verification_status || '');
    console.info('PayPal webhook verification result', {
        eventType: event.event_type,
        eventId: event.id,
        resourceId: event.resource?.id,
        webhookId: config.paypal.webhookId,
        verificationStatus,
    });
    return verificationStatus === 'SUCCESS';
}
export function isTransientPaypalRequestError(error) {
    return isTransientPaypalError(error);
}
export function getPaypalRequestErrorMessage(error) {
    return describePaypalError(error);
}
