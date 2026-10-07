import { google } from 'googleapis'
import nodemailer from 'nodemailer'

const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    MAILING_SERVICE_REFRESH_TOKEN,
    SENDER_EMAIL_ADDRESS,
} = process.env

console.log('env', {
    hasClientId: Boolean(GOOGLE_CLIENT_ID),
    hasClientSecret: Boolean(GOOGLE_CLIENT_SECRET),
    hasRefreshToken: Boolean(MAILING_SERVICE_REFRESH_TOKEN),
    hasSender: Boolean(SENDER_EMAIL_ADDRESS),
})

const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
)

oauth2Client.setCredentials({
    refresh_token: MAILING_SERVICE_REFRESH_TOKEN,
})

console.time('getAccessToken')
const accessTokenResponse = await oauth2Client.getAccessToken()
console.timeEnd('getAccessToken')

const accessToken = accessTokenResponse?.token
console.log('hasAccessToken', Boolean(accessToken))

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
})

console.time('smtpVerify')
await transport.verify()
console.timeEnd('smtpVerify')

console.time('sendMail')
const info = await transport.sendMail({
    from: SENDER_EMAIL_ADDRESS,
    to: SENDER_EMAIL_ADDRESS,
    subject: 'OCC SMTP diagnostic',
    html: '<p>SMTP diagnostic from Railway.</p>',
})
console.timeEnd('sendMail')

console.log({
    messageId: Boolean(info.messageId),
    accepted: info.accepted?.length || 0,
    rejected: info.rejected?.length || 0,
})