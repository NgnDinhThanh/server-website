import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { getHealth } from './controllers/healthController.js';
import { createDomesticPayment, getPaymentStatus, } from './controllers/paymentController.js';
import { downloadOrderInvoice, getInvoiceStatus, getMisaInvoiceTemplates, issueOrderInvoice, publishOrderInvoice, previewOrderInvoice, sendOrderInvoiceEmail, } from './controllers/invoiceController.js';
import { confirmPayosWebhook, handleWebhook, } from './controllers/payosController.js';
import { capturePaypalPayment, createPaypalPayment, getPaypalConfig, getPaypalPaymentStatus, handlePaypalWebhook, } from './controllers/paypalController.js';
const app = express();
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || config.frontendOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
}));
app.use(express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
        ;
        req.rawBody = buf.toString('utf8');
    },
}));
app.get('/health', getHealth);
app.post('/api/payments/payos/create', createDomesticPayment);
app.post('/api/payments/vnpay/create', createDomesticPayment);
app.get('/api/payments/paypal/config', getPaypalConfig);
app.post('/api/payments/paypal/create', createPaypalPayment);
app.post('/api/payments/paypal/:paypalOrderId/capture', capturePaypalPayment);
app.get('/api/payments/paypal/status/:orderCode', getPaypalPaymentStatus);
app.get('/api/payments/:orderCode', getPaymentStatus);
app.get('/api/invoices/misa/templates', getMisaInvoiceTemplates);
app.get('/api/invoices/:orderCode', getInvoiceStatus);
app.post('/api/invoices/:orderCode/preview', previewOrderInvoice);
app.post('/api/invoices/:orderCode/publish', publishOrderInvoice);
app.post('/api/invoices/:orderCode/issue', issueOrderInvoice);
app.get('/api/invoices/:orderCode/download', downloadOrderInvoice);
app.post('/api/invoices/:orderCode/send-email', sendOrderInvoiceEmail);
app.post('/api/payos/webhook', handleWebhook);
app.post('/api/payos/confirm-webhook', confirmPayosWebhook);
app.post('/api/paypal/webhook', handlePaypalWebhook);
const errorHandler = (error, req, res, next) => {
    res.status(error.status || 500).json({
        error: error.message || 'Internal server error',
    });
};
app.use(errorHandler);
app.listen(config.port);
