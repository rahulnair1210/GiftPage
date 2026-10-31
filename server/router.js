// One web-standard handler for every /api route. Used by api/index.js on Vercel and by dev-server.js locally.
import { config } from './config.js';
import { getStore } from './store/index.js';
import { HttpError, fail, json, newId, newKey, sha256, safeEqual, readJson, normalizeSlug, slugProblem, isEmail, cleanPhone } from './util.js';
import { sanitizeConfig, photosIn } from './sanitize.js';
import { unlockInfo } from './time.js';
import { paymentMode, createOrder, verifyCheckout, verifyWebhook } from './payments.js';
import { sendEmail, liveEmail } from './email.js';

const PENDING_HOLD_MS = 20 * 60_000; // a link name is held this long while someone is paying
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

// ---------- helpers ----------
async function ownGift(ctx, id) {
  const gift = await ctx.store.getGift(id);
  const key = ctx.request.headers.get('x-edit-key') || '';
  if (!gift || !key || !safeEqual(sha256(key), gift.editKeyHash)) fail(404, "We couldn't find that gift, or the edit link is incomplete.");
  return gift;
}
const giftUrl = (cfg, slug) => `${cfg.siteUrl}/g/${slug}`;
const editUrl = (cfg, id, key) => `${cfg.siteUrl}/create?id=${id}&key=${encodeURIComponent(key)}`;
function opensText(gift) {
  const u = unlockInfo(gift.config?.unlock);
  if (!u || u.serverAt <= Date.now()) return 'It can be opened right away.';
  return `It stays behind a countdown until 12:00 AM on ${u.long} (${u.zone}).`;
}
function ownerView(cfg, gift) {
  return {
    id: gift.id, status: gift.status, slug: gift.slug || null, url: gift.slug ? giftUrl(cfg, gift.slug) : null,
    config: gift.config, email: gift.email || '', phone: gift.phone || '', paidAt: gift.paidAt || null, updatedAt: gift.updatedAt,
  };
}
async function markPaid(ctx, gift, { orderId, paymentId }) {
  if (gift.status === 'paid') return gift;
  const now = Date.now();
  const u = unlockInfo(gift.config?.unlock);
  const opens = Math.max(now, u?.serverAt || 0);
  let slug = gift.pendingSlug || normalizeSlug(gift.config?.name) || gift.id.slice(0, 8);
  const patch = { status: 'paid', orderId, paymentId, paidAt: now, updatedAt: now, expiresAt: opens + ctx.cfg.keepDays * 86400_000, pendingSlug: null };
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await ctx.store.updateGift(gift.id, { ...patch, slug }); }
    catch (e) {
      if (e.code !== 'SLUG_TAKEN') throw e;
      slug = `${(gift.pendingSlug || 'gift').slice(0, 34)}-${Math.random().toString(36).slice(2, 6)}`; // someone beat them to it
    }
  }
  fail(500, 'Could not publish the gift. Please contact support.');
}
async function sendLiveEmail(ctx, gift, key) {
  if (!gift.email) return;
  const mail = liveEmail(ctx.cfg, { name: gift.config?.name, giftUrl: giftUrl(ctx.cfg, gift.slug), editUrl: editUrl(ctx.cfg, gift.id, key), opensText: opensText(gift) });
  await sendEmail(ctx.cfg, { to: gift.email, ...mail });
  await ctx.store.updateGift(gift.id, { emailedAt: Date.now() });
}
function bearer(ctx, secret) {
  const h = ctx.request.headers.get('authorization') || '';
  if (!secret || !safeEqual(h, `Bearer ${secret}`)) fail(401, 'Not allowed.');
}

// ---------- public config ----------
route('GET', 'health', async (ctx) => json({ ok: true, store: ctx.store.kind, payments: paymentMode(ctx.cfg) }));
route('GET', 'config', async (ctx) => json({
  brand: ctx.cfg.brand, priceInr: ctx.cfg.priceInr, currency: ctx.cfg.currency,
  payments: paymentMode(ctx.cfg), razorpayKeyId: paymentMode(ctx.cfg) === 'razorpay' ? ctx.cfg.razorpay.keyId : null,
  photoPrefix: ctx.store.photoPrefix, maxPhotos: ctx.cfg.limits.maxPhotos,
}));

// ---------- drafts ----------
route('POST', 'gifts', async (ctx) => {
  const body = await readJson(ctx.request, ctx.cfg.limits.maxConfigBytes);
  const id = newId(), key = newKey(), now = Date.now();
  const cfg = sanitizeConfig(body.config, ctx.store.photoPrefix);
  await ctx.store.createGift({ id, editKeyHash: sha256(key), status: 'draft', slug: null, pendingSlug: null, config: cfg, unlockAt: unlockInfo(cfg.unlock)?.serverAt ?? null,
    email: null, phone: null, amount: null, currency: 'INR', orderId: null, paymentId: null, photoPaths: [], paidAt: null, emailedAt: null, expiresAt: null, createdAt: now, updatedAt: now, disabledReason: null });
  return json({ id, key }, 201);
});
route('GET', 'gifts/:id', async (ctx, p) => json({ gift: ownerView(ctx.cfg, await ownGift(ctx, p.id)) }));
route('PUT', 'gifts/:id', async (ctx, p) => {
  const gift = await ownGift(ctx, p.id);
  if (gift.status === 'disabled') fail(403, 'This gift was taken down and can no longer be edited.');
  const body = await readJson(ctx.request, ctx.cfg.limits.maxConfigBytes);
  const cfg = sanitizeConfig(body.config, ctx.store.photoPrefix);
  const now = Date.now();
  const patch = { config: cfg, unlockAt: unlockInfo(cfg.unlock)?.serverAt ?? null, updatedAt: now };
  if (gift.status === 'paid') { const u = unlockInfo(cfg.unlock); patch.expiresAt = Math.max(gift.paidAt || now, u?.serverAt || 0) + ctx.cfg.keepDays * 86400_000; }
  // photos that were removed from the gift get deleted from storage
  // (uploads get a 10-minute grace period so an autosave that raced an upload can't delete the new photo)
  const used = new Set(photosIn(cfg).map((u) => u.slice(ctx.store.photoPrefix.length)));
  const isOrphan = (e) => !used.has(e.p) && now - e.t > 10 * 60_000;
  const orphans = (gift.photoPaths || []).filter(isOrphan).map((e) => e.p);
  if (orphans.length) { await ctx.store.deletePhotos(orphans); patch.photoPaths = gift.photoPaths.filter((e) => !isOrphan(e)); }
  await ctx.store.updateGift(gift.id, patch);
  return json({ ok: true, updatedAt: now, removedPhotos: orphans.length });
});
route('DELETE', 'gifts/:id', async (ctx, p) => {
  const gift = await ownGift(ctx, p.id);
  await ctx.store.deleteGift(gift.id);
  return json({ ok: true });
});

// ---------- photos ----------
route('POST', 'gifts/:id/photos', async (ctx, p) => {
  const gift = await ownGift(ctx, p.id);
  const type = (ctx.request.headers.get('content-type') || '').split(';')[0].trim();
  const ext = IMAGE_TYPES[type];
  if (!ext) fail(415, 'Upload a JPEG, PNG or WebP image.');
  if ((gift.photoPaths || []).length >= ctx.cfg.limits.maxPhotos) fail(409, `A gift can hold up to ${ctx.cfg.limits.maxPhotos} photos. Remove some to add more.`);
  const buf = Buffer.from(await ctx.request.arrayBuffer());
  if (!buf.length) fail(400, 'The photo was empty.');
  if (buf.length > ctx.cfg.limits.maxUploadBytes) fail(413, 'That photo is too large. Try a smaller one.');
  const saved = await ctx.store.savePhoto(gift.id, buf, ext);
  await ctx.store.updateGift(gift.id, { photoPaths: [...(gift.photoPaths || []), { p: saved.path, t: Date.now() }], updatedAt: Date.now() });
  return json({ url: saved.url }, 201);
});

// ---------- link names ----------
route('GET', 'slugs/:slug', async (ctx, p) => {
  const slug = normalizeSlug(decodeURIComponent(p.slug));
  const problem = slugProblem(slug);
  if (problem) return json({ slug, available: false, reason: problem });
  const except = new URL(ctx.request.url).searchParams.get('gift') || '';
  const taken = await ctx.store.slugTaken(slug, except, Date.now() - PENDING_HOLD_MS);
  return json({ slug, available: !taken, reason: taken ? 'That link is already taken. Try adding a number or a word.' : null });
});

// ---------- checkout ----------
route('POST', 'gifts/:id/checkout', async (ctx, p) => {
  const gift = await ownGift(ctx, p.id);
  if (gift.status === 'paid') return json({ alreadyPaid: true, url: giftUrl(ctx.cfg, gift.slug) });
  if (gift.status === 'disabled') fail(403, 'This gift was taken down.');
  const body = await readJson(ctx.request, 5000);
  const slug = normalizeSlug(body.slug);
  const problem = slugProblem(slug);
  if (problem) fail(400, problem, { field: 'slug' });
  if (!isEmail(body.email)) fail(400, 'Enter a valid email address so we can send you the links.', { field: 'email' });
  if (await ctx.store.slugTaken(slug, gift.id, Date.now() - PENDING_HOLD_MS)) fail(409, 'That link is already taken. Try another.', { field: 'slug' });
  const amountPaise = ctx.cfg.priceInr * 100;
  const order = await createOrder(ctx.cfg, { amountPaise, receipt: gift.id.slice(0, 36), notes: { gift_id: gift.id, slug } });
  await ctx.store.updateGift(gift.id, { status: 'pending', pendingSlug: slug, email: body.email.trim(), phone: cleanPhone(body.phone), amount: amountPaise, orderId: order.id, updatedAt: Date.now() });
  return json({
    mode: paymentMode(ctx.cfg), orderId: order.id, amount: amountPaise, currency: 'INR', keyId: ctx.cfg.razorpay.keyId || null,
    name: ctx.cfg.brand, description: `Birthday gift page for ${gift.config?.name || 'someone special'}`, slug,
    prefill: { email: body.email.trim(), contact: cleanPhone(body.phone) },
  });
});
route('POST', 'gifts/:id/verify', async (ctx, p) => {
  let gift = await ownGift(ctx, p.id);
  const body = await readJson(ctx.request, 5000);
  if (gift.status !== 'paid') {
    if (!gift.orderId || body.orderId !== gift.orderId) fail(400, "That payment doesn't match this gift.");
    if (!verifyCheckout(ctx.cfg, body)) fail(400, "We couldn't confirm that payment. If money was taken, it will be matched automatically within a few minutes, or contact us.");
    gift = await markPaid(ctx, gift, { orderId: body.orderId, paymentId: body.paymentId || 'test' });
  }
  if (!gift.emailedAt) await sendLiveEmail(ctx, gift, ctx.request.headers.get('x-edit-key'));
  return json({ url: giftUrl(ctx.cfg, gift.slug), slug: gift.slug });
});
route('POST', 'gifts/:id/email', async (ctx, p) => {
  const gift = await ownGift(ctx, p.id);
  if (gift.status !== 'paid') fail(400, 'The gift is not published yet.');
  if (gift.emailedAt && Date.now() - gift.emailedAt < 120_000) fail(429, 'We just sent that email. Check your inbox and spam folder.');
  await sendLiveEmail(ctx, gift, ctx.request.headers.get('x-edit-key'));
  return json({ ok: true });
});

// Razorpay webhook: catches payments where the buyer closed the tab before we could confirm in the browser.
route('POST', 'webhooks/razorpay', async (ctx) => {
  const raw = await ctx.request.text();
  if (!verifyWebhook(ctx.cfg, raw, ctx.request.headers.get('x-razorpay-signature'))) fail(400, 'Bad signature.');
  const evt = JSON.parse(raw);
  if (evt.event === 'payment.captured' || evt.event === 'order.paid') {
    const pay = evt.payload?.payment?.entity || {};
    const orderId = pay.order_id || evt.payload?.order?.entity?.id;
    const gift = orderId && (await ctx.store.getByOrderId(orderId));
    if (gift && gift.status !== 'paid' && gift.status !== 'disabled') {
      if (gift.amount && pay.amount && pay.amount < gift.amount) { console.error('Underpaid order', orderId); return json({ ok: true }); }
      await markPaid(ctx, gift, { orderId, paymentId: pay.id || 'webhook' });
    }
  }
  return json({ ok: true });
});

// ---------- the public gift ----------
route('GET', 'view/:slug', async (ctx, p) => {
  const gift = await ctx.store.getBySlug(normalizeSlug(decodeURIComponent(p.slug)));
  if (!gift || gift.status === 'draft' || gift.status === 'pending') return json({ error: 'not_found' }, 404);
  if (gift.status === 'disabled') return json({ error: 'removed' }, 410);
  const now = Date.now();
  const c = gift.config || {};
  const u = unlockInfo(c.unlock);
  const pub = u ? { date: u.date, local: u.local, at: u.at, long: u.long, short: u.short, zone: u.zone } : null;
  if (u && now < u.serverAt) {
    // Locked: only what the countdown screen needs. No photos, no messages.
    return json({ locked: true, serverNow: now, gift: { name: c.name, unlock: pub, curtain: c.curtain, show: { curtain: true }, complete: false } });
  }
  return json({ locked: false, serverNow: now, gift: { ...c, unlock: pub, complete: true } });
});
route('POST', 'report', async (ctx) => {
  const body = await readJson(ctx.request, 4000);
  const slug = normalizeSlug(body.slug);
  if (!slug) fail(400, 'Missing gift link.');
  await ctx.store.addReport({ slug, reason: String(body.reason || '').slice(0, 60), details: String(body.details || '').slice(0, 1000), createdAt: Date.now() });
  return json({ ok: true });
});

// ---------- operations ----------
route('GET', 'cron/cleanup', async (ctx) => {
  bearer(ctx, ctx.cfg.cronSecret);
  const now = Date.now();
  const ids = await ctx.store.findExpired(now, now - ctx.cfg.draftDays * 86400_000);
  for (const id of ids) await ctx.store.deleteGift(id);
  return json({ deleted: ids.length });
});
route('GET', 'admin/reports', async (ctx) => { bearer(ctx, ctx.cfg.adminToken); return json({ reports: await ctx.store.listReports() }); });
route('POST', 'admin/disable', async (ctx) => {
  bearer(ctx, ctx.cfg.adminToken);
  const body = await readJson(ctx.request, 2000);
  const gift = await ctx.store.getBySlug(normalizeSlug(body.slug));
  if (!gift) fail(404, 'No gift with that link.');
  await ctx.store.updateGift(gift.id, { status: body.enable ? 'paid' : 'disabled', disabledReason: body.enable ? null : String(body.reason || 'Removed').slice(0, 200), updatedAt: Date.now() });
  return json({ ok: true, status: body.enable ? 'paid' : 'disabled' });
});

// ---------- entry point ----------
export async function handle(request) {
  try {
    const url = new URL(request.url);
    const path = (url.searchParams.get('path') ?? url.pathname.replace(/^\/api\/?/, '')).replace(/^\/+|\/+$/g, '');
    const cfg = config();
    if (process.env.VERCEL && !(cfg.supabase.url && cfg.supabase.serviceKey)) fail(503, 'Storage is not set up. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    const store = await getStore(cfg);
    const ctx = { request, cfg, store };
    for (const r of routes) {
      const m = path.match(r.re);
      if (m && r.method === request.method) return await r.fn(ctx, m.groups || {});
    }
    return json({ error: 'Not found' }, 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
    console.error(e);
    return json({ error: 'Something went wrong on our side. Please try again.' }, 500);
  }
}
