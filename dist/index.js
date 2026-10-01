import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { activateRegistration, changePassword, forgotPassword, login, logout, me, register, resetPassword, showResetPasswordPage, } from './controllers/authController.js';
import { activateRequest, listActivationRequests, } from './controllers/adminController.js';
import { requestBookDemo } from './controllers/bookDemoController.js';
import { getHealth } from './controllers/healthController.js';
import { createDomesticPayment, getPaymentStatus, updatePaymentInvoice, } from './controllers/paymentController.js';
import { downloadOrderInvoice, getInvoiceStatus, getMisaInvoiceTemplates, issueOrderInvoice, publishOrderInvoice, previewOrderInvoice, sendOrderInvoiceEmail, } from './controllers/invoiceController.js';
import { confirmPayosWebhook, handleWebhook, } from './controllers/payosController.js';
import { capturePaypalPayment, createPaypalPayment, getPaypalConfig, getPaypalPaymentStatus, handlePaypalWebhook, } from './controllers/paypalController.js';
import { requireAuth } from './middleware/requireAuth.js';
import { requireAdmin } from './middleware/requireAdmin.js';
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewDir = __dirname.endsWith(`${path.sep}dist`) || __dirname.endsWith('/dist')
    ? path.resolve(__dirname, '../src/views')
    : path.resolve(__dirname, 'views');
app.set('view engine', 'ejs');
app.set('views', viewDir);
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
app.use(express.urlencoded({ extended: false }));
app.get('/health', getHealth);
app.post('/api/auth/register', register);
app.get('/api/auth/activate', activateRegistration);
app.post('/api/auth/login', login);
app.get('/api/auth/me', requireAuth, me);
app.post('/api/auth/forgot-password', forgotPassword);
app.get('/api/auth/reset-password', showResetPasswordPage);
app.post('/api/auth/reset-password', resetPassword);
app.post('/api/auth/change-password', requireAuth, changePassword);
app.post('/api/auth/logout', requireAuth, logout);
app.post('/api/book-demo/request', requestBookDemo);
app.get('/api/admin/activation-requests', requireAuth, requireAdmin, listActivationRequests);
app.post('/api/admin/activation-requests/:requestId/activate', requireAuth, requireAdmin, activateRequest);
app.post('/api/payments/payos/create', requireAuth, createDomesticPayment);
app.post('/api/payments/vnpay/create', requireAuth, createDomesticPayment);
app.patch('/api/payments/:orderCode/invoice', requireAuth, updatePaymentInvoice);
app.get('/api/payments/paypal/config', getPaypalConfig);
app.post('/api/payments/paypal/create', requireAuth, createPaypalPayment);
app.post('/api/payments/paypal/:paypalOrderId/capture', requireAuth, capturePaypalPayment);
app.get('/api/payments/paypal/status/:orderCode', requireAuth, getPaypalPaymentStatus);
app.get('/api/payments/:orderCode', requireAuth, getPaymentStatus);
app.get('/api/invoices/misa/templates', getMisaInvoiceTemplates);
app.get('/api/invoices/:orderCode', requireAuth, getInvoiceStatus);
app.post('/api/invoices/:orderCode/preview', requireAuth, previewOrderInvoice);
app.post('/api/invoices/:orderCode/publish', requireAuth, publishOrderInvoice);
app.post('/api/invoices/:orderCode/issue', requireAuth, issueOrderInvoice);
app.get('/api/invoices/:orderCode/download', requireAuth, downloadOrderInvoice);
app.post('/api/invoices/:orderCode/send-email', requireAuth, sendOrderInvoiceEmail);
app.post('/api/payos/webhook', handleWebhook);
app.post('/api/payos/confirm-webhook', confirmPayosWebhook);
app.post('/api/paypal/webhook', handlePaypalWebhook);
const errorHandler = (error, req, res, next) => {
    res.status(error.status || 500).json({
        error: error.message || 'Internal server error',
    });
};
app.use(errorHandler);
async function startServer() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
    await mongoose.connect(mongoUri, {
        dbName: process.env.MONGODB_DB || 'occ_website',
    });
    console.log('MongoDB connection successful');
    app.listen(config.port);
}
startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
