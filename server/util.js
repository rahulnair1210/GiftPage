import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}
export const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const newId = () => crypto.randomUUID();
export const newKey = () => crypto.randomBytes(24).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const hmacHex = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const RESERVED = new Set(['admin', 'api', 'create', 'demo', 'g', 'legal', 'login', 'pricing', 'help', 'support', 'about', 'terms', 'privacy', 'www', 'app']);
export function normalizeSlug(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
export function slugProblem(slug) {
  if (slug.length < 3) return 'Use at least 3 letters or numbers.';
  if (RESERVED.has(slug)) return 'That name is reserved. Try another.';
  return null;
}

export async function readJson(request, maxBytes) {
  const text = await request.text();
  if (maxBytes && text.length > maxBytes) fail(413, 'That is too much data to save at once.');
  if (!text) return {};
  try { return JSON.parse(text); } catch { fail(400, 'The request body is not valid JSON.'); }
}

export const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length < 200;
export const cleanPhone = (s) => String(s || '').replace(/[^\d+]/g, '').slice(0, 16);
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
