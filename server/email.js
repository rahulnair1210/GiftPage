import { esc } from './util.js';

/** Sends through Resend (https://resend.com) when RESEND_API_KEY and EMAIL_FROM are set; otherwise logs. */
export async function sendEmail(cfg, { to, subject, html, text }) {
  if (!cfg.email.resendKey || !cfg.email.from) {
    console.log(`[email not configured] to=${to} subject="${subject}"\n${text}`);
    return { skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.email.resendKey}` },
    body: JSON.stringify({ from: cfg.email.from, to: [to], subject, html, text, ...(cfg.email.replyTo ? { reply_to: cfg.email.replyTo } : {}) }),
  });
  if (!res.ok) { console.error('Email failed', res.status, await res.text().catch(() => '')); return { ok: false }; }
  return { ok: true };
}

export function liveEmail(cfg, { name, giftUrl, editUrl, opensText }) {
  const subject = `Your gift for ${name || 'them'} is live`;
  const text = `Your gift is ready to share.\n\nGift link (send this to ${name || 'them'}):\n${giftUrl}\n\n${opensText}\n\nYour private edit link (don't share this one):\n${editUrl}\n\nThanks for using ${cfg.brand}.`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;color:#24131a;line-height:1.5">
<h1 style="font-size:22px">Your gift for ${esc(name || 'them')} is live 🎁</h1>
<p>Send this link to ${esc(name || 'them')}:</p>
<p><a href="${esc(giftUrl)}" style="display:inline-block;background:#ffc24f;color:#2a1400;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700">${esc(giftUrl)}</a></p>
<p>${esc(opensText)}</p>
<hr style="border:0;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:14px">To change text or photos later, use your <strong>private edit link</strong>. Don't share it.<br><a href="${esc(editUrl)}">${esc(editUrl)}</a></p>
<p style="font-size:13px;color:#7a6870">Thanks for using ${esc(cfg.brand)}.</p></div>`;
  return { subject, html, text };
}
