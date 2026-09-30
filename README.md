# OCC payOS Test Server

Small Express server for testing the domestic payment flow with payOS.

## Setup

```powershell
cd D:\WorkSpace\dev-fuji\website_occ\server
npm install
Copy-Item .env.example .env
npm run dev
```

Fill `.env` with keys from your payOS payment channel.

For webhook testing, expose this server with a public URL such as ngrok or Cloudflare Tunnel, then set `PUBLIC_BASE_URL`.

## MISA invoice configuration

The invoice path uses the MISA meInvoice integration API. There is no invoice mock mode.

Required MISA keys before invoice preview/issue work can be connected:

- `MISA_API_BASE_URL`
- `MISA_CLIENT_ID`
- `MISA_CLIENT_SECRET`
- `MISA_TAX_CODE`
- `MISA_USERNAME`
- `MISA_PASSWORD`
- `MISA_INVOICE_SERIES`
- `MISA_INV_TEMPLATE_NO`
- `MISA_SIGN_TYPE`
- `MISA_PAYMENT_METHOD`
- `MISA_VAT_RATE`

`MISA_ACCESS_TOKEN` is optional. If it is empty, the server requests a token from `POST /invoice/token` by using `ClientID`, `ClientSecret`, tax code, username, and password.

Default integration paths are:

- preview: `POST /invoice/unpublishview`
- publish with HSM `SignType=2`: `POST /invoice/publishing`
- status: `POST /invoice/status?invoiceWithCode=<true|false>&invoiceCalcu=false&inputType=1`
- published view: `POST /invoice/publishview`
- email: `POST /invoice/sendemail`
- download: `POST /invoice/Download`

Only set `MISA_PUBLISH_PATH`, `MISA_STATUS_PATH`, `MISA_PUBLISH_VIEW_PATH`, or `MISA_SEND_EMAIL_PATH` when intentionally switching to another MISA API family.

## Endpoints

- `GET /health`
- `POST /api/payments/payos/create`
- `POST /api/payments/vnpay/create` alias for current FE wording
- `GET /api/payments/paypal/config`
- `POST /api/payments/paypal/create`
- `POST /api/payments/paypal/:paypalOrderId/capture`
- `GET /api/payments/paypal/status/:orderCode`
- `GET /api/payments/:orderCode`
- `GET /api/invoices/:orderCode`
- `POST /api/invoices/:orderCode/preview`
- `POST /api/invoices/:orderCode/issue`
- `POST /api/invoices/:orderCode/publish`
- `GET /api/invoices/:orderCode/download`
- `POST /api/payos/webhook`
- `POST /api/payos/confirm-webhook`
- `POST /api/paypal/webhook`

This server stores orders in memory only. Restarting the process clears them.

## TypeScript

Server source is written in TypeScript under `src`.

- Development: `npm run dev`
- Build: `npm run build`
- Run built server: `npm start`
