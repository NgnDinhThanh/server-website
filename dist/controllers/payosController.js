import { config } from '../config.js';
import { applyWebhookPaymentUpdate } from '../services/paymentService.js';
import { confirmWebhook, verifyWebhook } from '../services/payosService.js';
export async function handleWebhook(req, res) {
    try {
        const webhookData = await verifyWebhook(req.body);
        const data = webhookData?.data ?? webhookData;
        applyWebhookPaymentUpdate(data);
        res.json({ ok: true });
    }
    catch (error) {
        console.error('payOS webhook verification failed', error);
        res.status(400).json({ ok: false, error: 'Invalid webhook signature' });
    }
}
export async function confirmPayosWebhook(req, res, next) {
    try {
        const webhookUrl = req.body.webhookUrl ||
            `${config.publicBaseUrl.replace(/\/$/, '')}/api/payos/webhook`;
        const result = await confirmWebhook(webhookUrl);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
}
