// All settings come from environment variables. See .env.example.
const env = (k, d = '') => (process.env[k] ?? d).toString().trim();

// Keep only https://xxxx.supabase.co even if a longer address (e.g. .../rest/v1) was pasted.
function supabaseOrigin(raw) {
  if (!raw) return '';
  try { const u = new URL(raw.includes('://') ? raw : 'https://' + raw); return u.origin; } catch { return raw.replace(/\/+$/, ''); }
}

export function config() {
  const siteUrl = env('SITE_URL', 'http://localhost:3000').replace(/\/+$/, '');
  return {
    siteUrl,
    brand: env('BRAND_NAME', 'Giftpage'),
    priceInr: Math.max(1, parseInt(env('PRICE_INR', '299'), 10) || 299),
    currency: 'INR',
    keepDays: parseInt(env('KEEP_DAYS', '365'), 10) || 365,     // paid gifts stay online this long after opening
    draftDays: parseInt(env('DRAFT_DAYS', '30'), 10) || 30,     // unpaid drafts are deleted after this much inactivity
    testPayments: env('TEST_PAYMENTS') === 'true',              // fake checkout for local development ONLY
    razorpay: {
      keyId: env('RAZORPAY_KEY_ID'),
      keySecret: env('RAZORPAY_KEY_SECRET'),
      webhookSecret: env('RAZORPAY_WEBHOOK_SECRET'),
      apiBase: env('RAZORPAY_API_BASE', 'https://api.razorpay.com'),
    },
    supabase: {
      url: supabaseOrigin(env('SUPABASE_URL')),
      serviceKey: env('SUPABASE_SERVICE_ROLE_KEY'),
      bucket: env('SUPABASE_BUCKET', 'gift-photos'),
    },
    email: { resendKey: env('RESEND_API_KEY'), from: env('EMAIL_FROM'), replyTo: env('EMAIL_REPLY_TO') },
    adminToken: env('ADMIN_TOKEN'),
    cronSecret: env('CRON_SECRET'),
    dataDir: env('DATA_DIR', '.data'),
    limits: { maxPhotos: 80, maxUploadBytes: 2_500_000, maxConfigBytes: 300_000 },
  };
}
