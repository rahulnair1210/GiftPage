// End-to-end check of the API against a running server (local test mode by default).
//   npm run dev            (in one terminal, with TEST_PAYMENTS=true)
//   npm test               (in another)
// Against a deployed site that uses real Razorpay, the payment steps are skipped.
const base = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
let passed = 0, failed = 0;
const ok = (cond, label, extra) => { if (cond) { passed++; console.log('  ✓', label); } else { failed++; console.log('  ✗', label, extra ?? ''); } };
async function call(method, path, { key, body, raw, type } = {}) {
  const headers = {};
  if (key) headers['x-edit-key'] = key;
  if (body !== undefined && !raw) headers['content-type'] = 'application/json';
  if (type) headers['content-type'] = type;
  const r = await fetch(`${base}/api/${path}`, { method, headers, body: raw ? body : body !== undefined ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
const iso = (days) => { const d = new Date(Date.now() + days * 864e5); return d.toISOString().slice(0, 10); };
// a valid 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

console.log(`\nTesting ${base}\n`);
const health = await call('GET', 'health');
ok(health.status === 200, `server is up (store: ${health.data.store}, payments: ${health.data.payments})`);
const testMode = health.data.payments === 'test';

const created = await call('POST', 'gifts', { body: { config: { name: 'Smoke Test', unlock: { date: iso(3), tz: 'Asia/Kolkata' } } } });
ok(created.status === 201 && created.data.id && created.data.key, 'creates a draft with a private edit key');
const { id, key } = created.data;

ok((await call('GET', `gifts/${id}`, { key: 'wrong' })).status === 404, 'refuses the wrong edit key');

const up = await call('POST', `gifts/${id}/photos`, { key, raw: true, body: PNG, type: 'image/png' });
ok(up.status === 201 && up.data.url, 'uploads a photo');
ok((await call('POST', `gifts/${id}/photos`, { key, raw: true, body: Buffer.from('hello'), type: 'text/plain' })).status === 415, 'rejects non-images');

const cfg = { name: 'Smoke Test', photos: [up.data.url, 'javascript:alert(1)', 'https://evil.example/x.jpg'], unlock: { date: iso(3), tz: 'Asia/Kolkata' },
  chat: { contact: 'Sweet {name}', items: ['hi', '', 'happy birthday'] } };
ok((await call('PUT', `gifts/${id}`, { key, body: { config: cfg } })).status === 200, 'autosave works');
const got = await call('GET', `gifts/${id}`, { key });
ok(got.data.gift.config.photos.length === 1 && got.data.gift.config.photos[0] === up.data.url, 'keeps our photo URL, drops unsafe ones');
ok(got.data.gift.config.chat.items.length === 2, 'drops empty list items');

const slug = `smoke-${Date.now().toString(36)}`;
const avail = await call('GET', `slugs/${slug}?gift=${id}`);
ok(avail.data.available === true, 'link name is available');
ok((await call('GET', 'slugs/ad')).data.available === false, 'rejects too-short link names');
ok((await call('POST', `gifts/${id}/checkout`, { key, body: { slug, email: 'not-an-email' } })).status === 400, 'checkout requires a valid email');

if (testMode) {
  const co = await call('POST', `gifts/${id}/checkout`, { key, body: { slug, email: 'buyer@example.com', phone: '+91 98765 43210' } });
  ok(co.status === 200 && co.data.orderId, 'checkout creates an order');
  const other = await call('POST', 'gifts', { body: { config: { name: 'Other' } } });
  const held = await call('GET', `slugs/${slug}?gift=${other.data.id}`);
  ok(held.data.available === false, 'link name is held while the first buyer pays');
  ok((await call('POST', `gifts/${id}/verify`, { key, body: { orderId: 'order_fake', paymentId: 'x', signature: 'y' } })).status === 400, 'rejects a payment for a different order');
  const v = await call('POST', `gifts/${id}/verify`, { key, body: { orderId: co.data.orderId, paymentId: 'pay_test_1', signature: 'test' } });
  ok(v.status === 200 && v.data.url.endsWith(`/g/${slug}`), `publishes at ${v.data.url}`);

  const locked = await call('GET', `view/${slug}`);
  ok(locked.data.locked === true, 'gift is locked before the date');
  ok(!('photos' in locked.data.gift) && !('chat' in locked.data.gift), 'locked response contains no photos or messages');

  ok((await call('PUT', `gifts/${id}`, { key, body: { config: { ...cfg, unlock: { date: iso(-1), tz: 'Asia/Kolkata' } } } })).status === 200, 'can edit after publishing');
  const open = await call('GET', `view/${slug}`);
  ok(open.data.locked === false && open.data.gift.photos?.length === 1 && open.data.gift.chat.items.length === 2, 'opens with photos and messages once the date has started');

  const co2 = await call('POST', `gifts/${other.data.id}/checkout`, { key: other.data.key, body: { slug, email: 'b@example.com' } });
  ok(co2.status === 409, 'a published link name cannot be taken by someone else');
  await call('DELETE', `gifts/${other.data.id}`, { key: other.data.key });

  ok((await call('POST', 'report', { body: { slug, reason: 'Something else', details: 'smoke test' } })).status === 200, 'visitors can report a gift');
} else {
  console.log('  – payment steps skipped (real payments are configured)');
}

ok((await call('GET', 'cron/cleanup')).status === 401, 'clean-up job refuses requests without the secret');
ok((await call('DELETE', `gifts/${id}`, { key })).status === 200, 'owner can delete the gift');
ok((await call('GET', `view/${slug}`)).status === 404, 'deleted gift is gone');

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
