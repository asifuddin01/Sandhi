# Setting the four services up

Work through these in order. The first three each hand you values; Vercel is
last because it consumes all of them.

Keep a scratch file open for the values as you collect them. **Do not put any
of them in the repository** — it is public.

---

## 0. Before you start

Generate the auth secret now, once:

```bash
openssl rand -base64 32
```

Save the output as `BETTER_AUTH_SECRET`. Changing it later signs everybody out
**and** invalidates every stored two-factor secret, so it is not a value to
regenerate casually.

---

## 1. Cloudflare R2 — file storage

You are already signed in. R2 is not switched on yet.

1. **R2 → Add R2 subscription to my account.** $0.00 today; free up to 10 GB
   storage, 1M writes and 10M reads a month. It attaches to the card on file
   and bills only past those limits. This click is yours, not mine.
2. **Create bucket** → name it `sandhi-public` → location **Asia-Pacific**.
3. **Create bucket** again → `sandhi-private` → same location.
4. Open `sandhi-public` → **Settings → Public Development URL → Enable.**
   Copy the `https://pub-….r2.dev` address. That is `R2_PUBLIC_BASE_URL`.
   Leave `sandhi-private` with no public access — CVs and manuscripts live
   there.
5. **R2 → Manage API tokens → Create Account API token.**
   - Permission: **Object Read & Write**
   - Scope it to the two buckets rather than all of them
   - Create, then copy **Access Key ID** and **Secret Access Key**. The secret
     is shown **once**.
6. Your **Account ID** is on the R2 overview page, and in the dashboard URL.
7. **On both buckets: Settings → CORS Policy → Add**, and replace the example
   with:

   ```json
   [
     {
       "AllowedOrigins": [
         "https://sandhiresearch.org",
         "https://www.sandhiresearch.org",
         "http://localhost:3000",
         "http://localhost:3100",
         "http://localhost:3200"
       ],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   **Uploads fail without this, and nothing on the server says so.** The
   browser sends every file straight to R2 — profile photos, CVs, project
   attachments — so each one is a cross-origin request, and the browser
   refuses it at the preflight unless the bucket names the site. A test run
   from Node passes regardless, because Node does not enforce CORS; only a
   real browser shows the failure.

   `PUT` with `content-type` is everything the three upload forms send.
   Reads need no rule: images load through `<img>`, private files through
   signed links the browser navigates to.

   When Vercel gives the project its `*.vercel.app` address, add that origin
   too, or uploads fail on it until the custom domain is live.

Collected: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET_PUBLIC=sandhi-public`, `R2_BUCKET_PRIVATE=sandhi-private`,
`R2_PUBLIC_BASE_URL`.

---

## 2. Neon — the database

1. Sign up at **neon.tech** (signing in with GitHub is quickest).
2. **Create project**
   - Name: `sandhi`
   - Postgres: **17**
   - Region: **AWS Asia Pacific (Singapore) — ap-southeast-1**

   The region is not a detail. Every page runs several queries, and a database
   an ocean away from the app pays that round trip on each one.

3. On the connection panel, copy **two** strings — they are different and both
   are needed:
   - **Pooled** (the host contains `-pooler`) → this is `DATABASE_URL` for the
     app
   - **Direct** (no `-pooler`) → for migrations only

   Migrations take session-level locks, which a transaction-mode pooler does
   not carry. Running `prisma migrate deploy` through the pooled URL can hang
   or half-apply.

4. In both strings, change `sslmode=require` to **`sslmode=verify-full`**.

   Today the `pg` driver quietly treats `require` as `verify-full` — encrypted
   _and_ the server's certificate checked — and prints a warning saying so.
   Its next major version gives `require` the libpq meaning instead: encrypted
   but unverified, which leaves room for something to impersonate the
   database. Saying `verify-full` keeps the strong behaviour through the
   upgrade. Neon's certificates are valid, so nothing else changes.

Free tier is 0.5 GB and scales to zero, so the first request after a quiet
hour is about a second slower. Fine for launch.

Collected: `DATABASE_URL` (pooled), and the direct URL kept aside.

---

## 3. Resend — email

Nothing leaves the site without this: `assertEmailConfigured` refuses to start
in production without both values.

1. Sign up at **resend.com**.
2. **Domains → Add Domain** → `sandhiresearch.org`, region **Tokyo
   (ap-northeast-1)** — the closest Resend offers to Dhaka.
3. With the domain on Cloudflare, Resend's **Auto configure** adds its records:
   DKIM (`resend._domainkey`) and the sending path (`rsend`, `send`). Those two
   are what sending needs.
4. **Switch off "Enable Receiving".** This is not optional for this site. It
   asks for an MX record on the root domain pointing at Resend's inbound
   servers, and the root MX decides where _all_ mail to `@sandhiresearch.org`
   goes. The app only sends — it has no inbound handler — so mail to
   `join@sandhiresearch.org` would land in a pipeline nothing reads, and
   vanish rather than bounce. Receiving left on is also what keeps the domain
   at "Partially verified".
5. Add the DMARC record Resend lists as optional — TXT `_dmarc`,
   `v=DMARC1; p=none;`. `p=none` only monitors; it blocks nothing.
6. **API Keys → Create API Key** → permission **Sending access** → copy it.
   Shown once.

Leave open and click tracking off (the pixels cost deliverability, and read as
surveillance on a password reset), and TLS on Opportunistic — Enforced makes an
email to any server without TLS fail rather than send.

Free tier is 3,000 emails a month, 100 a day — far beyond what this site sends.

Collected: `RESEND_API_KEY`, and
`EMAIL_FROM="SANDHI Research Lab <no-reply@sandhiresearch.org>"`. The address
must be on the domain you just verified.

### Somewhere for the lab's own addresses to land

Resend only sends. The site _publishes_ four addresses people will write to —
`join@`, `contact@`, `research@` and `collaborate@` — and `ADMIN_NOTIFY_EMAIL`
is `join@`, where every join and contact submission is delivered. Without an
MX record none of them has an inbox, and those submissions bounce.

**Cloudflare → your domain → Email → Email Routing**, free:

1. **Destination addresses** → add the inbox that should receive them. One on
   the same address as the Cloudflare login is verified at once; any other
   gets a confirmation email.
2. **Settings → DNS records → Add missing records.** Three MX, a DKIM key and
   an SPF line. None of them collide with Resend's: different names, a
   different DKIM selector, and Resend's SPF lives on the `send.` subdomain.
3. **Routing rules** → one per address, each **Send to an email** → that
   inbox. Leave the **catch-all disabled**: it forwards every address at the
   domain, which in practice means forwarding spam.

`no-reply@` stays unrouted on purpose.

---

## 4. Vercel — the app

1. Sign up at **vercel.com** with GitHub.
2. **Add New → Project** → import `asifuddin01/Sandhi`.
3. Framework is detected as Next.js. Leave the build command alone — the
   project's own `build` script already runs `prisma generate` first.
4. **Deploy.** It builds cleanly with no variables at all, and every page
   answers 200 — because pages render on demand and much of the code returns
   empty lists when no database is configured. **A "Ready" build is not a
   working site.** The check that means something is `/research` showing
   the research themes, which only exist in the database.
5. **Settings → Environment Variables → Add Environment Variable.** Twelve
   values, five of them secret. Rather than copy each by hand, this puts all
   twelve on the clipboard without showing or saving any of them — it asks
   for the pooled Neon URL, upgrades its `sslmode` to `verify-full`, and
   generates the auth secret itself:

   ```bash
   cd /path/to/sandhi && printf "Pooled Neon URL: " && read -rs NEON_POOLED && echo && { cat .env.local; printf '\nDATABASE_URL=%s\nBETTER_AUTH_SECRET=%s\nBETTER_AUTH_URL=https://sandhiresearch.org\nADMIN_NOTIFY_EMAIL=join@sandhiresearch.org\n' "${NEON_POOLED/sslmode=require/sslmode=verify-full}" "$(openssl rand -base64 32)"; } | pbcopy; unset NEON_POOLED
   ```

   Paste into the **Key** field and Vercel splits the block into rows.
   Choose **Production only**: Vercel builds a preview for every branch,
   Dependabot's included, and a preview holding the production secrets can
   write to the live database.

   Vercel flags the four real secrets as "Needs Attention" — not wrong, just
   not marked Secret, so anyone with access to the project could read them.
   Worth converting before anyone else joins the Vercel team.

   **Never regenerate `BETTER_AUTH_SECRET` once it is in use.** It signs every
   session and encrypts every stored two-factor secret; changing it signs
   everybody out and breaks every authenticator, the owner's included.

6. **Settings → Functions → Function Region.** The default is **Washington,
   D.C. (iad1)**, and the regions sit inside collapsed groups, so it is easy
   to miss. Open **North America**, untick `iad1`; open **Asia Pacific**, tick
   **Singapore (sin1)**; Save. Hobby allows one region, so it will not let
   you tick the second before clearing the first. Singapore rather than
   Mumbai, though Mumbai is nearer Dhaka: a page makes several queries, and
   each one pays the distance between the function and the database.
7. Node needs no setting — Vercel honours the `engines` range in
   `package.json`.

### The domain

1. **Settings → Domains → Add Existing** → `sandhiresearch.org`, connected to
   Production.
2. **Untick "Redirect apex domains to www".** Vercel ticks it and calls it
   recommended, and here it breaks sign-in: the site would really live at
   `www.`, while `BETTER_AUTH_URL` names the bare domain, and auth refuses
   requests from an origin it does not recognise as its own.
3. Vercel asks for a **CNAME on `@`**. Add it in **Cloudflare → DNS**, with
   **Proxy status off** (Cloudflare turns it on by default). DNS rules forbid
   a CNAME beside other records on the same name, but Cloudflare flattens it,
   so the root keeps answering mail lookups with the Email Routing MX
   records. Check both after:

   ```bash
   dig +short A sandhiresearch.org     # Vercel's addresses
   dig +short MX sandhiresearch.org    # still route1-3.mx.cloudflare.net
   ```

4. **Deployments → ⋯ → Redeploy**, build cache unticked. Variables and region
   apply only to deployments made after they were set; the build already
   running keeps what it started with.

Uploads need no `*.vercel.app` origin in the R2 CORS rule: sign-in only works
on the domain `BETTER_AUTH_URL` names, and nothing uploads without it.

---

## 5. First run

Three steps against the empty database, each with the **direct** Neon URL.
Run them in a real terminal: they prompt for input, and `read -rs` keeps the
URL and password off the screen and out of shell history.

```bash
# 1. The schema — 18 migrations
DATABASE_URL="<direct neon url>" pnpm db:deploy

# 2. The lab's own content: five research themes and their areas, the site
#    settings, and the founding milestone. Every write is an upsert, so it is
#    safe to run again, and with no owner details set it leaves accounts alone.
DATABASE_URL="<direct neon url>" pnpm seed

# 3. The owner account
SEED_OWNER_NAME="Asif Uddin" \
SEED_OWNER_EMAIL="you@example.com" \
SEED_OWNER_PASSWORD="<a strong password you choose>" \
DATABASE_URL="<direct neon url>" pnpm seed:owner
```

`seed:owner` alone creates the account and nothing else — `/research` stays
empty until step 2 has run.

Then:

1. Sign in at `/portal/sign-in` as the owner
2. **Enrol in two-factor straight away** — administration is closed to accounts
   without it, by design, so you cannot reach `/admin` until you do
3. Change the seeded password

---

## 6. Check it works

- `/` loads, `/research` and `/people` render
- `/contact` sends and the message arrives — proves Resend
- `/portal/profile` accepts a photo — proves R2
- Search returns results — proves the tsvector indexes survived the migration

If search returns nothing, the GIN indexes were dropped. See
[deploy.md](deploy.md); it is the one migration trap in this project.
