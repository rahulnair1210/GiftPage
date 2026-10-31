// Production store: Supabase Postgres (table `gifts`, `reports`) + Supabase Storage (public bucket).
// Only the server talks to Supabase, with the service-role key. Row level security stays on with no
// policies, so the public anon key can't read anything.
const toRow = (g) => {
  const r = {};
  const map = { id: 'id', editKeyHash: 'edit_key_hash', status: 'status', slug: 'slug', pendingSlug: 'pending_slug', config: 'config',
    email: 'email', phone: 'phone', amount: 'amount', currency: 'currency', orderId: 'order_id', paymentId: 'payment_id',
    photoPaths: 'photo_paths', disabledReason: 'disabled_reason' };
  const times = { unlockAt: 'unlock_at', paidAt: 'paid_at', emailedAt: 'emailed_at', expiresAt: 'expires_at', createdAt: 'created_at', updatedAt: 'updated_at' };
  for (const [k, c] of Object.entries(map)) if (k in g) r[c] = g[k];
  for (const [k, c] of Object.entries(times)) if (k in g) r[c] = g[k] == null ? null : new Date(g[k]).toISOString();
  return r;
};
const ms = (v) => (v ? new Date(v).getTime() : null);
const fromRow = (r) => r && ({
  id: r.id, editKeyHash: r.edit_key_hash, status: r.status, slug: r.slug, pendingSlug: r.pending_slug, config: r.config,
  email: r.email, phone: r.phone, amount: r.amount, currency: r.currency, orderId: r.order_id, paymentId: r.payment_id,
  photoPaths: r.photo_paths || [], disabledReason: r.disabled_reason,
  unlockAt: ms(r.unlock_at), paidAt: ms(r.paid_at), emailedAt: ms(r.emailed_at), expiresAt: ms(r.expires_at),
  createdAt: ms(r.created_at), updatedAt: ms(r.updated_at),
});

export async function createSupabaseStore(cfg) {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(cfg.supabase.url, cfg.supabase.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const bucket = cfg.supabase.bucket;
  const check = ({ data, error }) => { if (error) { const e = new Error(error.message); e.code = error.code; throw e; } return data; };

  return {
    kind: 'supabase',
    photoPrefix: `${cfg.supabase.url}/storage/v1/object/public/${bucket}/`,
    async createGift(rec) { return fromRow(check(await sb.from('gifts').insert(toRow(rec)).select().single())); },
    async getGift(id) { return fromRow(check(await sb.from('gifts').select('*').eq('id', id).maybeSingle())); },
    async getBySlug(slug) { return fromRow(check(await sb.from('gifts').select('*').eq('slug', slug).maybeSingle())); },
    async getByOrderId(orderId) { return fromRow(check(await sb.from('gifts').select('*').eq('order_id', orderId).maybeSingle())); },
    async updateGift(id, patch) {
      const res = await sb.from('gifts').update(toRow(patch)).eq('id', id).select().maybeSingle();
      if (res.error && res.error.code === '23505') { const e = new Error('slug taken'); e.code = 'SLUG_TAKEN'; throw e; }
      return fromRow(check(res));
    },
    async slugTaken(slug, exceptId, pendingSince) {
      const live = check(await sb.from('gifts').select('id').eq('slug', slug).neq('id', exceptId).limit(1));
      if (live.length) return true;
      const held = check(await sb.from('gifts').select('id').eq('pending_slug', slug).eq('status', 'pending')
        .gt('updated_at', new Date(pendingSince).toISOString()).neq('id', exceptId).limit(1));
      return held.length > 0;
    },
    async savePhoto(giftId, buf, ext) {
      const name = crypto.randomUUID().replace(/-/g, '').slice(0, 16) + '.' + ext;
      const p = `${giftId}/${name}`;
      check(await sb.storage.from(bucket).upload(p, buf, { contentType: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg', upsert: false, cacheControl: '31536000' }));
      return { url: `${cfg.supabase.url}/storage/v1/object/public/${bucket}/${p}`, path: p };
    },
    async deletePhotos(paths) { if (paths.length) check(await sb.storage.from(bucket).remove(paths)); },
    async deleteGift(id) {
      const files = check(await sb.storage.from(bucket).list(id, { limit: 1000 }));
      if (files.length) check(await sb.storage.from(bucket).remove(files.map((f) => `${id}/${f.name}`)));
      check(await sb.from('gifts').delete().eq('id', id));
    },
    async findExpired(now, draftCutoff) {
      const drafts = check(await sb.from('gifts').select('id').neq('status', 'paid').lt('updated_at', new Date(draftCutoff).toISOString()).limit(500));
      const paid = check(await sb.from('gifts').select('id').eq('status', 'paid').lt('expires_at', new Date(now).toISOString()).limit(500));
      return [...drafts, ...paid].map((r) => r.id);
    },
    async addReport(r) { check(await sb.from('reports').insert({ slug: r.slug, reason: r.reason, details: r.details, created_at: new Date(r.createdAt).toISOString() })); },
    /** Setup check for /api/health: plain-language reasons when the database or bucket isn't reachable. */
    async check() {
      const out = { database: 'ok', photos: 'ok' };
      const d = await sb.from('gifts').select('id').limit(1);
      if (d.error) out.database = /does not exist|relation/i.test(d.error.message) ? 'The gifts table is missing. Run supabase/schema.sql in the Supabase SQL Editor.'
        : /invalid api key|jwt|unauthorized|apikey/i.test(d.error.message) ? 'Supabase rejected the key. SUPABASE_SERVICE_ROLE_KEY must be the secret key (sb_secret_...), not the publishable one.'
        : d.error.message;
      const probe = `_health/${Date.now()}.txt`;
      const u = await sb.storage.from(bucket).upload(probe, Buffer.from('ok'), { contentType: 'text/plain', upsert: true });
      if (u.error) out.photos = /not found/i.test(u.error.message) ? `The "${bucket}" bucket is missing. Run supabase/schema.sql, or create a public bucket with that name.`
        : /row-level security|unauthorized|invalid/i.test(u.error.message) ? 'Supabase refused the upload. SUPABASE_SERVICE_ROLE_KEY must be the secret key (sb_secret_...), not the publishable one.'
        : u.error.message;
      else await sb.storage.from(bucket).remove([probe]);
      return out;
    },
    async listReports() { return check(await sb.from('reports').select('*').order('created_at', { ascending: false }).limit(200)); },
  };
}
