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

The invoice path uses MISA meInvoice test environment directly. There is no invoice mock mode.

Required MISA keys before invoice preview/issue work can be connected:

- `INVOICE_PROVIDER=misa`
- `MISA_ENV=test`
- `MISA_BASE_URL`
- `MISA_INTEGRATION_BASE_URL`
- `MISA_APP_ID`
- `MISA_TAX_CODE`
- `MISA_USERNAME`
- `MISA_PASSWORD`
- `MISA_COMPANY_TAX_CODE`
- `MISA_INVOICE_SERIES`
- `MISA_INVOICE_NAME`
- `MISA_PAYMENT_METHOD`
- `MISA_VAT_RATE`
- `MISA_ENABLE_PREVIEW`
- `MISA_ENABLE_REAL_ISSUE`

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
- `POST /api/payos/webhook`
- `POST /api/payos/confirm-webhook`
- `POST /api/paypal/webhook`

This server stores orders in memory only. Restarting the process clears them.

## TypeScript

Server source is written in TypeScript under `src`.

- Development: `npm run dev`
- Build: `npm run build`
- Run built server: `npm start`
