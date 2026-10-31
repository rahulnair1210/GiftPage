import { hmacHex, safeEqual, fail } from './util.js';

export function paymentMode(cfg) {
  if (cfg.razorpay.keyId && cfg.razorpay.keySecret) return 'razorpay';
  if (cfg.testPayments) return 'test';
  return 'off';
}

/** Creates a Razorpay order (amount in paise). https://razorpay.com/docs/api/orders/create/ */
export async function createOrder(cfg, { amountPaise, receipt, notes }) {
  const mode = paymentMode(cfg);
  if (mode === 'test') return { id: 'order_test_' + Math.random().toString(36).slice(2, 12), amount: amountPaise, currency: 'INR' };
  if (mode === 'off') fail(503, "Payments aren't set up yet. Add your Razorpay keys to the environment.");
  const res = await fetch(`${cfg.razorpay.apiBase}/v1/orders`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Basic ' + Buffer.from(`${cfg.razorpay.keyId}:${cfg.razorpay.keySecret}`).toString('base64'),
    },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    console.error('Razorpay order failed', res.status, data);
    fail(502, 'The payment provider did not accept the order. Please try again in a minute.');
  }
  return data;
}

/** Checkout success: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckout(cfg, { orderId, paymentId, signature }) {
  if (paymentMode(cfg) === 'test') return String(orderId).startsWith('order_test_');
  if (!orderId || !paymentId || !signature) return false;
  return safeEqual(hmacHex(cfg.razorpay.keySecret, `${orderId}|${paymentId}`), signature);
}

/** Webhook: signature = HMAC_SHA256(raw request body, webhook secret). */
export function verifyWebhook(cfg, rawBody, signature) {
  if (!cfg.razorpay.webhookSecret || !signature) return false;
  return safeEqual(hmacHex(cfg.razorpay.webhookSecret, rawBody), signature);
}
