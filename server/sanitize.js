import { TIME_ZONES } from './time.js';

const SECTIONS = ['curtain', 'puzzle', 'age', 'birthday', 'polaroids', 'sketchbook', 'galaxy', 'chat'];
const str = (v, max = 400) => (typeof v === 'string' ? v.slice(0, max) : '');
const bool = (v, d = true) => (typeof v === 'boolean' ? v : d);
const list = (v, max = 40, len = 300) => (Array.isArray(v) ? v.map((x) => str(x, len)).filter((x) => x.trim()).slice(0, max) : []);
const int = (v, min, max, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };

/**
 * Keeps only known fields, trims lengths, and drops any photo URL that isn't one of ours.
 * The renderer escapes all text, but photo URLs go into src="" attributes, so they're whitelisted here.
 */
export function sanitizeConfig(input, photoPrefix) {
  const c = input && typeof input === 'object' ? input : {};
  const okUrl = (u) => typeof u === 'string' && u.startsWith(photoPrefix) && /^[A-Za-z0-9\-._~:/%]+$/.test(u) && u.length < 500 ? u : '';
  const g = (k) => (c[k] && typeof c[k] === 'object' ? c[k] : {});
  const show = {};
  SECTIONS.forEach((s) => { show[s] = bool(g('show')[s], s !== 'puzzle'); }); // gifts saved before the puzzle existed keep it off
  const sbPhotos = {};
  Object.entries(g('sketchbook').photos || {}).forEach(([k, v]) => { const i = parseInt(k, 10); const u = okUrl(v); if (i >= 0 && i < 24 && u) sbPhotos[i] = u; });
  const tz = TIME_ZONES.some((z) => z[0] === g('unlock').tz) ? g('unlock').tz : 'Asia/Kolkata';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(g('unlock').date || '') ? g('unlock').date : '';
  return {
    name: str(c.name, 60),
    photos: (Array.isArray(c.photos) ? c.photos : []).map(okUrl).filter(Boolean).slice(0, 80),
    show,
    unlock: { date, tz },
    curtain: { title: str(g('curtain').title, 60), subtitle: str(g('curtain').subtitle, 120), ticker: str(g('curtain').ticker, 40), label: str(g('curtain').label, 80), button: str(g('curtain').button, 40) },
    puzzle: { title: str(g('puzzle').title, 60), size: +g('puzzle').size === 4 ? 4 : 3, photo: okUrl(g('puzzle').photo), message: str(g('puzzle').message, 300), closing: str(g('puzzle').closing, 80) },
    age: { age: int(g('age').age, 0, 120, 25), above: str(g('age').above, 120), below: str(g('age').below, 160) },
    birthday: { date: str(g('birthday').date, 40), first: str(g('birthday').first, 30), second: str(g('birthday').second, 30), wish: str(g('birthday').wish, 600), footer: str(g('birthday').footer, 60) },
    polaroids: { title: str(g('polaroids').title, 80), flowers: bool(g('polaroids').flowers), butterflies: bool(g('polaroids').butterflies), count: int(g('polaroids').count, 1, 14, 7), items: list(g('polaroids').items, 30, 60) },
    sketchbook: { title: str(g('sketchbook').title, 60), pages: [4, 6, 8, 10].includes(+g('sketchbook').pages) ? +g('sketchbook').pages : 6, cover: okUrl(g('sketchbook').cover), photos: sbPhotos, items: list(g('sketchbook').items, 20, 160) },
    galaxy: { title: str(g('galaxy').title, 80), shooting: bool(g('galaxy').shooting), items: list(g('galaxy').items, 30, 30) },
    chat: { contact: str(g('chat').contact, 40), items: list(g('chat').items, 30, 300) },
  };
}

/** Every storage URL a config points at, so deleted photos can be cleaned up. */
export function photosIn(cfg) {
  return [...(cfg.photos || []), cfg.sketchbook?.cover, cfg.puzzle?.photo, ...Object.values(cfg.sketchbook?.photos || {})].filter(Boolean);
}
