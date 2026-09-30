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
2. **Domains → Add Domain** → `sandhiresearch.org`.
3. Resend shows a set of DNS records — an MX and TXT for the return path, a
   TXT for DKIM, optionally DMARC. Add each one in **Cloudflare → your domain
   → DNS → Add record**, copying name and value exactly.
4. Back in Resend, **Verify**. It is usually a few minutes; DNS can take
   longer.
5. **API Keys → Create API Key** → permission **Sending access** → copy it.
   Shown once.

Free tier is 3,000 emails a month, 100 a day — far beyond what this site sends.

Collected: `RESEND_API_KEY`, and
`EMAIL_FROM="SANDHI Research Lab <no-reply@sandhiresearch.org>"`. The address
must be on the domain you just verified. Also set `ADMIN_NOTIFY_EMAIL` to
wherever join and contact submissions should land.

---

## 4. Vercel — the app

1. Sign up at **vercel.com** with GitHub.
2. **Add New → Project** → import `asifuddin01/Sandhi`.
3. Framework is detected as Next.js. Leave the build command alone — the
   project's own `build` script already runs `prisma generate` first.
4. **Before deploying**, open **Environment Variables** and add every value
   you collected, for the Production environment:

   ```
   DATABASE_URL            (the pooled Neon string)
   BETTER_AUTH_SECRET
   BETTER_AUTH_URL         https://sandhiresearch.org
   RESEND_API_KEY
   EMAIL_FROM
   ADMIN_NOTIFY_EMAIL
   R2_ACCOUNT_ID
   R2_ACCESS_KEY_ID
   R2_SECRET_ACCESS_KEY
   R2_BUCKET_PUBLIC
   R2_BUCKET_PRIVATE
   R2_PUBLIC_BASE_URL
   ```

5. **Deploy.** The first build takes a few minutes.
6. **Settings → General → Node.js Version → 22.x** (or 24.x). The package
   requires `>=20.19 <25`; a newer default fails the build.
7. **Settings → Functions → Function Region → Singapore (sin1)**, to match
   Neon.
8. Redeploy so both settings take effect.

### The domain

1. **Settings → Domains → Add** `sandhiresearch.org`.
2. Vercel gives you a record to create. Add it in **Cloudflare → DNS**.
3. Set that record to **DNS only (grey cloud)**, not proxied. Proxying
   Cloudflare in front of Vercel doubles the CDN and causes certificate
   trouble; Vercel terminates TLS itself.
4. If you do want it proxied later, Cloudflare SSL mode must be
   **Full (strict)**.

---

## 5. First run

With the site deployed but empty:

```bash
# Use the DIRECT Neon URL here, not the pooled one
DATABASE_URL="<direct neon url>" pnpm db:deploy

SEED_OWNER_NAME="Asif Uddin" \
SEED_OWNER_EMAIL="you@example.com" \
SEED_OWNER_PASSWORD="<a strong password you choose>" \
DATABASE_URL="<direct neon url>" pnpm seed:owner
```

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
