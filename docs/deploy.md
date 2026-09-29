# Deploying SANDHI

Decided 2026-09-30. Four services, all on free tiers:

| Piece | Service | Why |
|---|---|---|
| The app | Vercel | Reference host for Next 16; `unstable_cache`, `updateTag`, server actions and streaming work with no adapter |
| Database | Neon Postgres, **Singapore** | Managed Postgres with the extensions the search needs |
| Files | Cloudflare R2 | S3-compatible, already signed by hand in `lib/storage.ts` |
| Email | Resend | Already HTTP-only in `lib/email.ts` — no SMTP anywhere |

DNS and CDN stay on Cloudflare.

## Why not all of it on Cloudflare

Pages alone cannot run this: it is Postgres, server actions, `runtime = "nodejs"`
route handlers and server-side Shiki, not a static site. Workers can, through
`@opennextjs/cloudflare`, but the free plan caps CPU at 10 ms per request —
React SSR plus Shiki goes past that — and it would still need Postgres hosted
elsewhere, plus R2/KV wired up as the incremental cache and D1 as the tag cache
before `updateTag` kept working. Days of work and a monthly bill to end up
slower. Revisit only if Vercel's free limits are outgrown.

## Put the app and the database in the same region

Every page runs several Prisma queries. An app in Washington talking to a
database in Singapore pays the round trip on each one, and no amount of caching
hides it. Neon region **ap-southeast-1**, Vercel function region **sin1** — the
closest pair to Dhaka.

## Node version

`package.json` pins `>=20.19 <25`. Set Vercel's Node version to **22 or 24**.
The current default elsewhere is 25, which is out of range and fails the build.

## Environment

`.env.example` is the full list. What each one is for:

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Neon — use the **pooled** connection string |
| `BETTER_AUTH_SECRET` | Generate once: `openssl rand -base64 32`. Changing it invalidates every session and every stored TOTP secret |
| `BETTER_AUTH_URL` | The public origin, e.g. `https://sandhiresearch.org` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend, with the sending domain verified. Required in production — `assertEmailConfigured` refuses to start without them |
| `ADMIN_NOTIFY_EMAIL` | Where join and contact submissions land |
| `R2_*` (six of them) | Cloudflare R2. Until these are set, portrait and attachment uploads are disabled rather than broken |
| `UPSTASH_*`, `TURNSTILE_*`, `CRON_SECRET` | Optional; rate limiting, bot check, scheduled work |

Never commit any of these. The repository is public, and `.claude/launch.json`
(which holds the local ones) is git-ignored for the same reason.

## Migrations

Vercel does not run them. The build is `prisma generate && next build`, which
only regenerates the client.

Run migrations yourself against the production database before the deploy that
needs them:

```bash
DATABASE_URL="<neon pooled url>" pnpm db:deploy
```

**Every generated migration must be checked first.** Prisma does not know about
the tsvector triggers and GIN indexes that `20260916000200_search` installs, so
it writes `DROP INDEX "…_search_vector_gin"` into new migrations. Delete those
lines before applying, or full-text search silently falls back to sequential
scans.

## First run

1. `pnpm db:deploy` against the empty database
2. `SEED_OWNER_NAME`, `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` set, then
   `pnpm seed:owner`
3. Sign in as the owner and **enrol in two-factor immediately** — administration
   is closed to accounts without it, by design
4. Change the seeded password

## What is not wired up yet

- **R2** is unset everywhere, so profile photos, project attachments and the
  documents library are inactive. The code is written and waiting.
- **The documents library** (`/portal/workspace`) is deliberately unbuilt for
  the same reason: `Document.fileKey` needs somewhere to put the file.
