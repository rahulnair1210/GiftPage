# Giftpage

Sell personalised birthday websites. People build a gift for free, pay once to publish it, and send a link that stays locked behind a countdown until 12:00 AM on the birthday.

```
 Browser                              Netlify (or Vercel)                  Services
 ───────                              ───────────────────                  ────────
 /            landing page     ─┐
 /create      builder (autosave)│     /api/*  one function     ──────▶  Supabase  Postgres: gifts, reports
 /g/<link>    the gift          ├──▶  (server/router.js)        ──────▶  Supabase  Storage: photos
 /demo        sample gift       │                               ──────▶  Razorpay  orders, payments, webhook
 /legal/*     policy pages     ─┘     daily clean-up job        ──────▶  Resend    "your gift is live" email
```

**What's built in**

- Builder with autosave, photo uploads, a private edit link, and a "Your gifts" list per device.
- Publishing: buyers pick their link name, pay with Razorpay (UPI, cards, netbanking, wallets) and get the link by email.
- A photo puzzle: solving it turns the sky to night and reveals your message. A "Solve it for me" button appears if they get stuck.
- A real lock. Before the opening time the server sends only the countdown. Photos and messages are released after midnight in the chosen time zone, so changing a phone's clock does nothing.
- Edits after publishing go live immediately. Buyers can delete a gift and all its photos.
- A Razorpay webhook publishes gifts even if the buyer closes the tab mid-payment.
- A report button on every gift, plus an admin command to take pages down.
- Automatic clean-up: unpaid drafts after 30 days, published gifts a year after they open.
- Landing page, demo, and the Terms, Privacy, Refunds, Delivery and Contact pages Razorpay asks for.

---

## 1. Run it on your laptop (5 minutes, no accounts)

You need Node.js 20 or newer.

```bash
npm install
cp .env.example .env      # local settings: file storage + fake checkout
npm run dev               # http://localhost:3000
```

Make a gift at `/create` and publish it. The checkout is a **test screen**, so no money moves. Data goes in `./.data`.

Run the automated end-to-end check in a second terminal while `npm run dev` is running:

```bash
npm test                  # 24 checks: drafts, uploads, link names, payment, lock, reports, deletion
```

## 2. Make it yours

| What | Where |
|---|---|
| Brand name | `BRAND_NAME` env var **and** `brand` in `public/assets/site.js` |
| Price | `PRICE_INR` env var (landing page and builder read it automatically) |
| Your legal name, address, email, phone | `public/assets/site.js` (fills every legal page) |
| Link preview image for WhatsApp | Replace `https://YOUR-DOMAIN` in `public/index.html` and `public/view.html`; swap `public/og.png` if you like |
| Policy wording | `public/legal/*.html`. These are **templates**: have a lawyer or CA review them. |
| How long things are kept | `KEEP_DAYS`, `DRAFT_DAYS` env vars (update the privacy page to match) |

## 3. Go live

Do these in order. Start Razorpay in **test mode**. Switch to live keys only after a full test purchase on your real domain.

### a. Supabase (database + photo storage)
1. Create a project at supabase.com. Choose the **Mumbai** region if most buyers are in India.
2. Open **SQL Editor**, paste in `supabase/schema.sql`, and click **Run**. This creates the tables, locks them down, and creates the `gift-photos` bucket.
3. In **Project Settings → API**, copy the **Project URL** and the **service_role** key. The service_role key is a secret: never put it in front-end code.

### b. Razorpay (payments)
1. Sign up at razorpay.com and complete KYC: PAN, bank account and business details. Sole proprietorship is the simplest route. They review your website, so deploy first (step d) with the legal pages filled in.
2. In **Account & Settings → API Keys**, generate **test** keys.
3. In **Account & Settings → Webhooks**, add `https://YOUR-DOMAIN/api/webhooks/razorpay` with the events **payment.captured** and **order.paid**. Set a secret.

### c. Resend (email, recommended)
Buyers need the email: it carries their private edit link.
1. Sign up at resend.com and add your domain. Add the DNS records it shows you.
2. Create an API key. Set `EMAIL_FROM`, for example `Giftpage <hello@yourdomain.in>`.

### d. Netlify (hosting)
Everything Netlify needs is already in the project: `netlify.toml` (publish folder, page routes, headers), `netlify/functions/api.mjs` (all `/api/*` routes) and `netlify/functions/cleanup.mjs` (daily clean-up).

1. **Put the code on GitHub.** Create a **private** repo and push this folder to it:
   ```bash
   git init && git add . && git commit -m "Giftpage"
   git branch -M main
   git remote add origin https://github.com/<you>/giftpage.git
   git push -u origin main
   ```
   `.env` and `.data` are in `.gitignore`, so your local secrets and test data stay off GitHub.
2. **Create the site.** In Netlify, go to **Add new project → Import an existing project → GitHub** and pick the repo. Netlify reads `netlify.toml`, so leave **Build command** empty, check **Publish directory** shows `public`, and click **Deploy**. The first deploy will show "Storage is not set up" errors until the next step is done. That's expected.
3. **Add environment variables.** Go to **Project configuration → Environment variables → Add a variable** (or "Import from a .env file"). Make sure each one's **scopes include Functions**; "All scopes" is fine.

   ```
   SITE_URL=https://yourdomain.in
   BRAND_NAME=Giftpage
   PRICE_INR=299
   SUPABASE_URL=...            SUPABASE_SERVICE_ROLE_KEY=...      SUPABASE_BUCKET=gift-photos
   RAZORPAY_KEY_ID=...         RAZORPAY_KEY_SECRET=...            RAZORPAY_WEBHOOK_SECRET=...
   RESEND_API_KEY=...          EMAIL_FROM=Giftpage <hello@yourdomain.in>
   ADMIN_TOKEN=<random>
   ```

   Generate random values with `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
   **Do not** set `TEST_PAYMENTS` or `GIFTPAGE_LOCAL` on Netlify.
4. **Redeploy** so the functions pick up the variables: **Deploys → Trigger deploy → Deploy project without cache**. Then open `https://<your-project>.netlify.app/api/health`. It should show `"store":"supabase"` and `"payments":"razorpay"`.
5. **Connect your domain.** Go to **Domain management → Add a domain** and follow the DNS records Netlify shows: either point your registrar's nameservers to Netlify DNS, or add the records it lists. HTTPS is set up automatically once DNS resolves.
6. **Update the URL everywhere.** If `SITE_URL` was a temporary `.netlify.app` address, change it to your domain and redeploy. Point the Razorpay webhook at `https://yourdomain.in/api/webhooks/razorpay`.
7. **Clean-up job.** This needs nothing from you. It runs daily at 09:00 IST on your published production deploy. Find it under **Logs → Functions → cleanup**.

From now on, every `git push` to `main` deploys automatically.

<details><summary>Prefer Vercel instead?</summary>

The project also works on Vercel unchanged (`vercel.json` and `api/index.js`): import the repo with Framework preset **Other**, add the same environment variables plus `CRON_SECRET=<random>`, and deploy. Vercel's free Hobby plan is for non-commercial use, so you'd need Pro once you take payments.
</details>

### e. Test the live site, then flip to real money
1. Run `SITE_URL=https://yourdomain.in npm test`. It runs everything except the payment steps against your real setup.
2. Make one real purchase in Razorpay test mode. For UPI, use `success@razorpay`; Razorpay's docs list test cards. Check that the gift publishes, the email arrives, and the countdown shows.
3. Swap in your **live** Razorpay keys, add the same webhook in live mode, and redeploy.

## 4. Running the business

- **Reports and takedowns**
  ```bash
  SITE_URL=https://yourdomain.in ADMIN_TOKEN=... npm run admin -- reports
  SITE_URL=https://yourdomain.in ADMIN_TOKEN=... npm run admin -- disable some-link "reason"
  SITE_URL=https://yourdomain.in ADMIN_TOKEN=... npm run admin -- enable some-link
  ```
- **Refunds:** issue them from the Razorpay dashboard. To also take the page down, use `disable`.
- **Finding a buyer's gift:** in Supabase, open the **Table Editor** for `gifts` and search by email or slug.
- **Setup check:** open `https://yourdomain.in/api/health`. It tests the database and photo bucket and says in plain words what's wrong, for example a missing table or the wrong Supabase key.
- **Logs:** Netlify → your project → **Logs → Functions → api**. Failed emails and payment errors are logged there.
- **Costs to start:** the free tiers of Supabase and Resend, plus Razorpay's per-transaction fee, cover early sales.
  - Netlify's free plan has monthly usage limits, and function calls count towards them. Check the usage page as sales grow, and upgrade before you hit the limit.
  - Supabase can pause idle free projects. Move to its paid plan once you're selling.
  - Check each provider's current terms and pricing.

## 5. Good to know

- **The edit link is the password.** Anyone with it can edit or delete that gift. It's shown after creating, kept on the device, and emailed after payment.
- **"Their own time zone"** opens at midnight on the viewer's device. The server can't know where the viewer is, so it releases content once that date has begun anywhere on Earth (UTC+14). Someone technical could get in up to a day early. The fixed zones (IST, UK, US, and so on) are exact.
- **Photos** are in a public bucket under random file names. Their URLs are never sent to anyone before the gift opens.
- **No rate limiting yet.** If you get abuse, add rate-limit rules for `/api/gifts` and `/api/report` in your host's firewall or security settings.
- The renderer (`public/gift/gift.js`) is shared by the builder preview, the live gift and the demo, so what buyers preview is exactly what recipients see.

## Project layout

```
netlify.toml              Netlify: publish folder, page routes, headers
netlify/functions/         api.mjs (every /api/* route), cleanup.mjs (daily job)
api/index.js, vercel.json Vercel equivalents (unused on Netlify)
server/router.js          all endpoints
server/store/             local.js (dev files) and supabase.js (production)
server/payments.js        Razorpay orders + signature checks (test mode for local)
server/email.js           Resend
server/sanitize.js        whitelists gift data and photo URLs
server/time.js            midnight-in-a-time-zone, server side
public/index.html         landing page          public/create.html   builder
public/view.html          the gift at /g/<link> public/demo.html     sample gift
public/gift/              renderer (gift.js, gift.css)
public/assets/            builder.js, defaults.js, site.js (your details), styles
public/legal/             policy pages
supabase/schema.sql       database + bucket setup
scripts/smoke-test.js     end-to-end API check   scripts/admin.js   moderation CLI
dev-server.js             local server with the same routes as Vercel
```
