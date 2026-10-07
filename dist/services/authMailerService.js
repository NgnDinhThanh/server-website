import { google } from 'googleapis';
import nodemailer from 'nodemailer';
function maskEmail(value) {
    return (value || '').replace(/(^.).*(@.*$)/, '$1***$2');
}
function logMailStep(step, startedAt, extra) {
    console.log('[sendAuthMail]', step, {
        ms: Date.now() - startedAt,
        ...(extra || {}),
    });
}
function getMailTransport() {
    return process.env.EMAIL_DELIVERY_TRANSPORT === 'gmail_api'
        ? 'gmail_api'
        : 'smtp';
}
function sanitizeHeader(value) {
    return value.replace(/[\r\n]+/g, ' ').trim();
}
function encodeBase64Url(value) {
    return Buffer.from(value, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}
function createRawMessage(args) {
    const headers = [
        `From: ${sanitizeHeader(args.from)}`,
        `To: ${sanitizeHeader(args.to)}`,
        `Subject: ${sanitizeHeader(args.subject)}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ];
    return encodeBase64Url(`${headers.join('\r\n')}\r\n\r\n${args.html}`);
}
export async function sendAuthMail(args) {
    const startedAt = Date.now();
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MAILING_SERVICE_REFRESH_TOKEN, SENDER_EMAIL_ADDRESS, } = process.env;
    const transportType = getMailTransport();
    logMailStep('start', startedAt, {
        to: maskEmail(args.to),
        subject: args.subject,
        transport: transportType,
        hasClientId: Boolean(GOOGLE_CLIENT_ID),
        hasClientSecret: Boolean(GOOGLE_CLIENT_SECRET),
        hasRefreshToken: Boolean(MAILING_SERVICE_REFRESH_TOKEN),
        hasSender: Boolean(SENDER_EMAIL_ADDRESS),
    });
    if (!GOOGLE_CLIENT_ID ||
        !GOOGLE_CLIENT_SECRET ||
        !MAILING_SERVICE_REFRESH_TOKEN ||
        !SENDER_EMAIL_ADDRESS) {
        logMailStep('mocked missing env', startedAt);
        return { mocked: true };
    }
    logMailStep('before oauth client', startedAt);
    const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, 'https://developers.google.com/oauthplayground');
    oauth2Client.setCredentials({
        refresh_token: MAILING_SERVICE_REFRESH_TOKEN,
    });
    logMailStep('after oauth client', startedAt);
    logMailStep('before getAccessToken', startedAt);
    const accessTokenResponse = await oauth2Client.getAccessToken();
    const accessToken = accessTokenResponse?.token || undefined;
    logMailStep('after getAccessToken', startedAt, {
        hasAccessToken: Boolean(accessToken),
    });
    if (transportType === 'gmail_api') {
        logMailStep('before gmail api send', startedAt);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const result = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: createRawMessage({
                    from: SENDER_EMAIL_ADDRESS,
                    to: args.to,
                    subject: args.subject,
                    html: args.html,
                }),
            },
        });
        logMailStep('after gmail api send', startedAt, {
            messageId: Boolean(result.data.id),
        });
        return result.data;
    }
    logMailStep('before createTransport', startedAt);
    const transport = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            type: 'OAuth2',
            user: SENDER_EMAIL_ADDRESS,
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            refreshToken: MAILING_SERVICE_REFRESH_TOKEN,
            accessToken,
        },
    });
    logMailStep('after createTransport', startedAt);
    logMailStep('before sendMail', startedAt);
    const result = await transport.sendMail({
        from: SENDER_EMAIL_ADDRESS,
        to: args.to,
        subject: args.subject,
        html: args.html,
    });
    logMailStep('after sendMail', startedAt, {
        messageId: Boolean(result.messageId),
        accepted: result.accepted?.length || 0,
        rejected: result.rejected?.length || 0,
    });
    return result;
}
