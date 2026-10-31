# Giftpage

Sell personalised birthday websites. People build a gift for free, pay once to publish it, and send a link that stays locked behind a countdown until 12:00 AM on the birthday.

```
 Browser                              Vercel                               Services
 ───────                              ──────                               ────────
 /            landing page     ─┐
 /create      builder (autosave)│     /api/*  one function     ──────▶  Supabase  Postgres: gifts, reports
 /g/<link>    the gift          ├──▶  (server/router.js)        ──────▶  Supabase  Storage: photos
 /demo        sample gift       │                               ──────▶  Razorpay  orders, payments, webhook
 /legal/*     policy pages     ─┘     daily cron: clean-up      ──────▶  Resend    "your gift is live" email
```

**What's built in**

- Builder with autosave, photo uploads, a private edit link, and a "Your gifts" list per device.
- Publishing: buyers pick their link name, pay with Razorpay (UPI, cards, netbanking, wallets) and get the link by email.
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

### d. Vercel (hosting)
1. Push this folder to a **private** GitHub repo.
2. In Vercel, click **Add New → Project**, import the repo, and choose Framework preset **Other**. Leave the build settings empty.
3. Add these environment variables (Production):

   ```
   SITE_URL=https://yourdomain.in
   BRAND_NAME=Giftpage
   PRICE_INR=299
   SUPABASE_URL=...            SUPABASE_SERVICE_ROLE_KEY=...      SUPABASE_BUCKET=gift-photos
   RAZORPAY_KEY_ID=...         RAZORPAY_KEY_SECRET=...            RAZORPAY_WEBHOOK_SECRET=...
   RESEND_API_KEY=...          EMAIL_FROM=Giftpage <hello@yourdomain.in>
   ADMIN_TOKEN=<random>        CRON_SECRET=<random>
   ```

   Generate the random values with `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
   **Do not** set `TEST_PAYMENTS` on the live site, because it lets people publish without paying.
4. Deploy. Add your domain under **Settings → Domains** and point your DNS at Vercel. If the domain changed, update `SITE_URL` and redeploy.
5. The daily clean-up runs automatically from `vercel.json`. Vercel sends your `CRON_SECRET` with it.

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
- **Logs:** Vercel → your project → Logs. Failed emails and payment errors are logged there.
- **Costs to start:** the free tiers of Supabase, Resend and Razorpay (which charges a fee per transaction) cover early sales. Plan for paid tiers once you're selling:
  - Vercel's free Hobby plan is for personal, non-commercial use, so move to Pro when you take payments.
  - Supabase can pause idle free projects.
  - Check each provider's current terms and pricing.

## 5. Good to know

- **The edit link is the password.** Anyone with it can edit or delete that gift. It's shown after creating, kept on the device, and emailed after payment.
- **"Their own time zone"** opens at midnight on the viewer's device. The server can't know where the viewer is, so it releases content once that date has begun anywhere on Earth (UTC+14). Someone technical could get in up to a day early. The fixed zones (IST, UK, US, and so on) are exact.
- **Photos** are in a public bucket under random file names. Their URLs are never sent to anyone before the gift opens.
- **No rate limiting yet.** If you get abuse, turn on Vercel's Firewall rules for `/api/gifts` and `/api/report`.
- The renderer (`public/gift/gift.js`) is shared by the builder preview, the live gift and the demo, so what buyers preview is exactly what recipients see.

## Project layout

```
api/index.js              Vercel function: every /api/* route
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
