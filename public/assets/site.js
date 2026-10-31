/* ===== Your business details: edit these once, every page picks them up. ===== */
window.SITE = {
  brand: 'Giftpage',                                   // keep in sync with BRAND_NAME in your environment
  email: 'hello@yourdomain.in',
  phone: '+91 00000 00000',
  legalName: '[Your full legal name or registered business name]',
  address: '[Your address, City, State, PIN, India]',
  jurisdiction: '[Your city], India',
  updated: '20 October 2026',
};
/* ============================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-site]').forEach((el) => { const v = SITE[el.dataset.site]; if (v) el.textContent = v; });
  document.querySelectorAll('a[data-site-mail]').forEach((a) => { a.href = 'mailto:' + SITE.email; a.textContent = SITE.email; });
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  const prices = document.querySelectorAll('[data-price]');
  if (prices.length) fetch('/api/config').then((r) => r.json()).then((c) => prices.forEach((el) => { el.textContent = '₹' + c.priceInr; })).catch(() => {});
});
