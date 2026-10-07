import { config } from '../config.js';
import { applyWebhookPaymentUpdate } from '../services/paymentService.js';
import { applyAiTopupPayosWebhookPaymentUpdate } from '../services/aiTopupPaymentService.js';
import { confirmWebhook, verifyWebhook } from '../services/payosService.js';
export async function handleWebhook(req, res) {
    try {
        const webhookData = await verifyWebhook(req.body);
        const data = webhookData?.data ?? webhookData;
        const subscriptionOrder = await applyWebhookPaymentUpdate(data);
        if (!subscriptionOrder) {
            await applyAiTopupPayosWebhookPaymentUpdate(data);
        }
        res.json({ ok: true });
    }
    catch (error) {
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
