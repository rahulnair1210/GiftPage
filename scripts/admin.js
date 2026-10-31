// Moderation from your terminal.
//   SITE_URL=https://yourdomain.in ADMIN_TOKEN=... npm run admin -- reports
//   ... npm run admin -- disable <link-name> "reason"
//   ... npm run admin -- enable <link-name>
const [cmd, slug, ...rest] = process.argv.slice(2);
const base = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const token = process.env.ADMIN_TOKEN;
if (!token) { console.error('Set ADMIN_TOKEN (and SITE_URL for your live site).'); process.exit(1); }
const call = async (path, body) => {
  const r = await fetch(`${base}/api/${path}`, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { console.error(r.status, data.error || data); process.exit(1); }
  return data;
};
if (cmd === 'reports') {
  const { reports } = await call('admin/reports');
  if (!reports.length) console.log('No reports.');
  for (const r of reports) console.log(`${new Date(r.createdAt || r.created_at).toLocaleString()}  /g/${r.slug}  ${r.reason}${r.details ? '  — ' + r.details : ''}`);
} else if (cmd === 'disable' && slug) {
  console.log(await call('admin/disable', { slug, reason: rest.join(' ') || 'Removed after a report' }));
} else if (cmd === 'enable' && slug) {
  console.log(await call('admin/disable', { slug, enable: true }));
} else {
  console.log('Usage: npm run admin -- reports | disable <link-name> "reason" | enable <link-name>');
}
