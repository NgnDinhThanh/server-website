import { google } from 'googleapis';
import nodemailer from 'nodemailer';
export async function sendAuthMail(args) {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MAILING_SERVICE_REFRESH_TOKEN, SENDER_EMAIL_ADDRESS, } = process.env;
    if (!GOOGLE_CLIENT_ID ||
        !GOOGLE_CLIENT_SECRET ||
        !MAILING_SERVICE_REFRESH_TOKEN ||
        !SENDER_EMAIL_ADDRESS) {
        return { mocked: true };
    }
    const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, 'https://developers.google.com/oauthplayground');
    oauth2Client.setCredentials({
        refresh_token: MAILING_SERVICE_REFRESH_TOKEN,
    });
    const accessTokenResponse = await oauth2Client.getAccessToken();
    const accessToken = accessTokenResponse?.token || undefined;
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
    return transport.sendMail({
        from: SENDER_EMAIL_ADDRESS,
        to: args.to,
        subject: args.subject,
        html: args.html,
    });
}
