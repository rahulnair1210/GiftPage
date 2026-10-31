// File-based store for local development: .data/db.json + .data/uploads/<giftId>/<file>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function createLocalStore(cfg) {
  const dir = path.resolve(cfg.dataDir);
  const uploads = path.join(dir, 'uploads');
  const dbFile = path.join(dir, 'db.json');
  fs.mkdirSync(uploads, { recursive: true });
  const load = () => { try { return JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch { return { gifts: {}, reports: [] }; } };
  const save = (db) => { fs.writeFileSync(dbFile + '.tmp', JSON.stringify(db, null, 1)); fs.renameSync(dbFile + '.tmp', dbFile); };
  const all = () => Object.values(load().gifts);
  const prefix = `${cfg.siteUrl}/uploads/`;

  return {
    kind: 'local',
    photoPrefix: prefix,
    uploadsDir: uploads,
    async createGift(rec) { const db = load(); db.gifts[rec.id] = rec; save(db); return rec; },
    async getGift(id) { return load().gifts[id] || null; },
    async getBySlug(slug) { return all().find((g) => g.slug === slug) || null; },
    async getByOrderId(orderId) { return all().find((g) => g.orderId === orderId) || null; },
    async updateGift(id, patch) {
      const db = load(); const g = db.gifts[id]; if (!g) return null;
      if (patch.slug && Object.values(db.gifts).some((x) => x.id !== id && x.slug === patch.slug)) { const e = new Error('slug taken'); e.code = 'SLUG_TAKEN'; throw e; }
      Object.assign(g, patch); save(db); return g;
    },
    async slugTaken(slug, exceptId, pendingSince) {
      return all().some((g) => g.id !== exceptId && (g.slug === slug || (g.pendingSlug === slug && g.status === 'pending' && g.updatedAt > pendingSince)));
    },
    async savePhoto(giftId, buf, ext) {
      const name = crypto.randomBytes(9).toString('base64url') + '.' + ext;
      fs.mkdirSync(path.join(uploads, giftId), { recursive: true });
      fs.writeFileSync(path.join(uploads, giftId, name), buf);
      return { url: prefix + giftId + '/' + name, path: giftId + '/' + name };
    },
    async deletePhotos(paths) { for (const p of paths) { try { fs.unlinkSync(path.join(uploads, p)); } catch {} } },
    async deleteGift(id) {
      const db = load(); delete db.gifts[id]; save(db);
      fs.rmSync(path.join(uploads, id), { recursive: true, force: true });
    },
    async findExpired(now, draftCutoff) {
      return all().filter((g) => (g.status !== 'paid' && g.updatedAt < draftCutoff) || (g.status === 'paid' && g.expiresAt && g.expiresAt < now)).map((g) => g.id);
    },
    async addReport(r) { const db = load(); db.reports.push(r); save(db); },
    async check() { return { database: 'ok (local files)', photos: 'ok (local files)' }; },
    async listReports() { return load().reports.slice(-200).reverse(); },
  };
}
