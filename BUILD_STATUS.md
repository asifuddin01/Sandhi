# SANDHI Research Lab — build brief and current status

Last updated: 17 September 2026 (Asia/Dhaka)

This document is the durable handoff for the complete SANDHI Research Lab website. It records what the product is, the decisions made during the build, what is already implemented, what is currently being finished, and what remains before launch.

The governing detailed specification remains `SANDHI_Codex_Build_Prompt.md`. `PLAN.md` is the milestone gate checklist. If this document and the specification differ, the user's latest explicit decision takes precedence, followed by the specification.

### Current completion snapshot

- **Milestones 1–3:** complete, tested, committed, and pushed.
- **Milestone 4:** complete. Every gate passes (lint, typecheck, 87 unit tests, 62 end-to-end tests with fixture-backed visibility enabled, contrast, production build). Committed and pushed with the owner's standing approval.
- **Latest user refinements:** implemented and tested — Join path context, optional-link removal, form-step history, proposal/CV rules, removable PDF attachments, exact route scroll restoration, and the layered neural-network research map with signal motion.
- **Security hardening (first Milestone 8 items):** implemented, tested against a production build, committed, and pushed — see section 11.
- **Milestone 5 (in progress):** slice 1 — authentication, authorization, protected routes, and the admin shell — is committed; members and invitations, content managers, the applications pipeline, approvals, and data caching follow in that order.
- **Milestones 6–8:** otherwise not started. These contain authentication/admin, the member portal, the private research workspace, security/performance hardening, deployment, and DNS.
- **Production launch:** not yet complete. The current site is a local development build, not the live finished service.

## 1. Product being built

SANDHI is a public research-lab website plus an invitation-only research workspace.

It has three connected surfaces:

1. A public scholarly website for research, projects, publications, people, news, events, opportunities, resources, and research notes.
2. A member portal for profiles, projects, tasks, meetings, publications, announcements, insights, experiments, logs, and documents.
3. An administration system for membership, publishing, applications, reviews, settings, approvals, audit history, and site operations.

The production domain is `https://sandhiresearch.org`. The Git repository is `https://github.com/asifuddin01/Sandhi.git`.

## 2. Product and role decisions made during the build

### Authentication and roles

- The public header action is **Sign in**, not “Member sign in”, because every authorized role uses the same entry point.
- `OWNER` is the superadmin-equivalent. The Owner cannot be altered by an Admin and is the only role that can transfer ownership.
- `ADMIN` manages members, applications, opportunities, settings, and administrative operations.
- The former `EDITOR` role is renamed **Reviewer** (`REVIEWER`). Reviewers manage editorial review and publishing workflows.
- `MEMBER` is the ordinary authenticated research member role.
- **Research Lead** is a member rank/research assignment, not a system-wide administrator role.
- **Project Lead** is assigned per project through `ProjectMember.isLead`.
- A person can therefore be a Research Lead for a research area, a Project Lead for a specific project, both, or neither.

### Join SANDHI decisions

- The form has six paths: Join as a researcher, Research internship, Research collaboration, Propose a project, Academic collaboration, and Industry collaboration.
- Contact number is available and optional.
- The selected application path is shown clearly on steps 2 and 3.
- Browser Back/Forward must traverse the three form steps before leaving `/join`:
  - Interest → About you → Motivation/proposal.
  - Back from About you returns to Interest.
  - Back from Motivation/proposal returns to About you.
- Project-proposal applications may attach a CV, but the CV is optional.
- A project proposal PDF is mandatory and limited to 10 MB.
- Research-collaboration proposal/brief PDF is optional and limited to 10 MB.
- Academic and industry collaboration use this exact note: “In the next step, describe the collaboration and optionally attach a PDF brief.”
- Google Scholar, ORCID, GitHub, LinkedIn, and personal-website fields are removed from every Join path as unnecessary form friction. The server remains backward-compatible with older payloads.
- CV and proposal files are private, validated, and stored by key rather than publicly exposed URL.
- A chosen CV or proposal PDF appears as a file row (name, size, and a small × remove button). Removing it returns keyboard focus to the picker. The row reflects form state, so it stays accurate when moving between steps.
- A reload keeps the step and draft but not files; submitting without a required CV explains that the CV must be attached again instead of doing nothing.

### Visual and interaction decisions

- Dark default theme: Lapis Night.
- Light theme: warm off-white/cream, not pure white.
- The home background threads have restrained motion, disabled by reduced-motion settings.
- The normal system pointer remains visible; no custom cursor replacement.
- Search trigger displays “Search” only; it does not display “Cmd K”. The keyboard shortcut still works.
- The public header includes **Sign in** and **Join SANDHI**.
- Browser Back/Forward should restore the exact previous scroll position.
- The research connections map is a layered neural-network architecture (the user's direction overrides the specification's "force-directed" wording):
  - Themes → research areas → projects → researchers → publications, each in one strictly aligned column; `d3-force` was removed because a force simulation cannot keep layers aligned.
  - Nodes within a layer are ordered by a barycentre sweep to reduce crossings, and each node is drawn level with the mean of its connections (the largest layer stays evenly spaced), so a theme sits level with the areas it contains. Rows keep a 56px gap and never leave the drawing.
  - The drawing takes only its natural width: outer names sit beside the nodes (inputs left, outputs right), layers sit at most 300px apart, and the detail panel receives the remaining width. Richer graphs grow the drawing up to the space available; narrow screens place names above nodes.
  - Labels are fitted into lanes, so always-visible labels never overlap across columns or leave the drawing at any width. Researchers and publications are named on hover/selection.
  - The detail panel lists a selected node's connections grouped by layer; with nothing selected it summarises the visible layers with their database counts.
  - Signal motion: forward-pass waves fire every theme with a slight stagger; signals travel real edges with a short trail, and each node emits an expanding ring as it fires. Hovering or selecting a node sends activation along its connections and one hop further. It runs outside React, pauses off-screen and in hidden tabs, and is disabled by reduced motion (system setting or footer toggle).
- The home "Recent publications" empty state reads "Our first paper will appear here soon." at the user's request; `/publications` keeps the specification copy.
- No demo numbers or invented content appear in production. Counts come from the database; `[Fixture]` records exist only in local test databases.

## 3. Design language

The visual concept is **The Junction**: disciplines, ideas, publications, projects, and people are represented as fine threads that form meaningful junctions.

Core rules already encoded in the implementation:

- Calm, nocturnal, scholarly, and precise; never mystical, ornamental, or promotional.
- Spectral for display and reading, Hanken Grotesk for interface text, Tiro Devanagari Sanskrit only for Sanskrit, and IBM Plex Mono for code/BibTeX.
- All colors come from semantic CSS tokens. Components do not introduce arbitrary hex colors.
- Lamplight is reserved for junctions, primary actions, and focus—not general decoration.
- No gradients, shadows, identical rounded SaaS cards, spinning counters, all-caps labels, headline word accents, or decorative link arrows.
- Reading columns remain approximately 60–72 characters and at most 720px.
- Public pages are left aligned except for intentionally centered hero/closing statements.
- Empty states use a thread ending at an unlit node plus one sentence and an optional action.
- Reduced motion disables WebGL, scroll-linked drawing, long transitions, and skeleton shimmer.
- Dark and light themes are persistent and respect system preference on first visit.
- WCAG 2.2 AA, visible keyboard focus, semantic headings/landmarks, and no-JavaScript public reading are required.

## 4. Technology and production architecture

- Next.js App Router 16 with React 19 and strict TypeScript.
- pnpm package management.
- PostgreSQL (production target: Neon) with Prisma 7 and the PostgreSQL driver adapter.
- Better Auth with the Prisma adapter for invitation-only accounts.
- Cloudflare R2 for public and private files.
- Resend for transactional email.
- Upstash Redis for production rate limiting.
- Cloudflare Turnstile for public-form abuse prevention.
- Plausible for privacy-respecting analytics.
- Vercel for application deployment and cron execution.
- Three.js/React Three Fiber for the lazy home Sandhi Field.
- A deterministic layered SVG layout and a small signal engine for the connections map (no graph library).
- React Markdown, GFM, KaTeX, Shiki, and sanitization for research content.
- Vitest for unit tests and Playwright plus axe-core for browser/accessibility tests.

All environment keys are listed in `.env.example`; secrets stay server-side.

## 5. Data model and content integrity

The Prisma schema already contains the full planned domain model, including:

- Better Auth users, sessions, accounts, verification records, and invitations.
- Members, ranks, system roles, research-area assignments, and project assignments.
- Research themes and areas.
- Projects, project relations, project members, results visibility, and linked outputs.
- Publications, ordered authors, reviews, affiliations, links, and workflow stage.
- News, events and registrations, opportunities, applications and notes.
- Resources, insights and authors, partners, meetings, tasks, announcements.
- Experiments, experiment logs, documents, change requests, settings, and audit logs.

Public visibility is centralized in `lib/visibility.ts`. Public queries must use it for pages, search, graph, sitemap, RSS, and counts.

Key visibility guarantees:

- Public entities require `state=PUBLISHED` and a due publishing time when applicable.
- Public publications additionally require an allowed publication stage/type combination.
- Internal events never appear publicly.
- Expired opportunities never appear publicly.
- Project results appear only when `resultsPublic=true`.
- Experiment data and results never appear on public routes.
- Public people require a public active profile.
- Counts are calculated from the database and are never invented or hardcoded.
- No fake people, projects, publications, partners, awards, metrics, or testimonials enter production-facing seeds.

The production seed contains only the specified research themes/areas, the 2026 founding milestone, site contact settings, and the configured private owner account/member. Development fixtures are unmistakably prefixed and refuse to run in production.

## 6. Public route inventory

Status legend: **Done** means implemented and already closed in a committed milestone. **Gate passed, commit pending** means Milestone 4 work that passed every gate and awaits the owner's approval to commit and push.

| Route                         | Purpose                                                                                             | Status                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `/`                           | Home, Sandhi Field, philosophy, themes, featured work, publications, news, conditional metrics, CTA | Done                                                          |
| `/about`                      | Mission, meaning, process, values, timeline, leadership                                             | Done                                                          |
| `/research`                   | Research themes and accessible connections map/list                                                 | Done; layered map and signal motion, gate passed              |
| `/research/[theme]`           | Theme overview, areas, public projects/publications                                                 | Done                                                          |
| `/research/areas/[area]`      | Area overview, questions, linked research, mini connections                                         | Done                                                          |
| `/projects`                   | URL-shareable project filters and public list                                                       | Done                                                          |
| `/projects/[slug]`            | Relational project detail with gated results                                                        | Done                                                          |
| `/publications`               | Search, URL filters, sorting, BibTeX, export                                                        | Done                                                          |
| `/publications/[slug]`        | Scholarly detail, links, relations, metadata and JSON-LD                                            | Done                                                          |
| `/people`                     | Grouped public people directory and area filter                                                     | Done                                                          |
| `/people/[slug]`              | Auto-relational public member profile                                                               | Done                                                          |
| `/news`                       | Published/scheduled news list                                                                       | Done                                                          |
| `/news/[slug]`                | News article detail                                                                                 | Done                                                          |
| `/events`                     | Upcoming/past public events                                                                         | Done; gate passed, commit pending                             |
| `/events/[slug]`              | Event details, local/original time, registration, recordings/slides                                 | Done; gate passed, commit pending                             |
| `/events/[slug]/calendar.ics` | Event calendar download                                                                             | Done; gate passed, commit pending                             |
| `/opportunities`              | Unexpired openings in four sections                                                                 | Done; gate passed, commit pending                             |
| `/opportunities/[slug]`       | Role detail and preselected Join link                                                               | Done; gate passed, commit pending                             |
| `/join`                       | Three-step application flow and private uploads                                                     | Done; history, file removal, and reload guidance, gate passed |
| `/resources`                  | Public datasets, code, models, tools, tutorials and reports                                         | Done; gate passed, commit pending                             |
| `/resources/[slug]`           | Resource links, citation, relations and changelog                                                   | Done; gate passed, commit pending                             |
| `/insights`                   | Research-note directory and kinds                                                                   | Done; gate passed, commit pending                             |
| `/insights/[slug]`            | Long-form note with TOC, KaTeX, code, footnotes, figures and citation                               | Done; gate passed, commit pending                             |
| `/open-science`               | Six exact research-sharing commitments                                                              | Done; gate passed, commit pending                             |
| `/partners`                   | Admin-entered partner directory and empty state                                                     | Done; gate passed, commit pending                             |
| `/contact`                    | Editable contacts and routed inquiry form                                                           | Done                                                          |
| `/privacy`                    | Plain-language privacy and retention policy                                                         | Done                                                          |
| `/terms`                      | Plain-language terms                                                                                | Done                                                          |
| `/feed.xml`                   | Public news and insight RSS                                                                         | Done, with insight integration                                |
| `/sitemap.xml`                | Static and visibility-filtered dynamic routes                                                       | Done, with Milestone 4 indexes added                          |
| `/robots.txt`                 | Public crawling rules; admin/portal disallowed                                                      | Done                                                          |
| custom 404 / 500              | Required error copy and recovery actions                                                            | Done                                                          |

## 7. Public capabilities already completed

### Foundation (Milestone 1, committed)

- Project tooling, strict TypeScript, ESLint, Prettier, Vitest, Playwright.
- Full token/theme/font system and warm cream light palette.
- Header, More menu, full-screen mobile menu, footer, skip link, Sign in, and command palette.
- Brand mark, wordmark, lockup, favicon and app icons.
- Margin thread, thread divider, sequence steps, junction nodes, motion preferences.
- Complete Prisma schema, migrations, production-safe seed, and guarded fixtures.
- Central visibility helpers, Markdown sanitation, and BibTeX generation for every publication type.
- Better Auth database tables and owner-compatible credential seeding groundwork.

Commit: `c5e5822 build foundation and research data model`

### Public core (Milestone 2, committed)

- Home, About, research hierarchy, projects, publications, people, news, contact and Join.
- Public filters, relational detail pages, metadata, Open Graph, JSON-LD and Scholar metadata.
- Private direct uploads, Turnstile, rate limits, applicant/admin email flow.
- Optional phone number and separate 10 MB proposal upload support.
- Legal pages, empty states, not-found/error pages, sitemap, robots and RSS.
- Fixture-backed visibility tests for unpublished projects/publications/members and private results.
- Conditional database-derived metrics.

Commit: `a0cf546 feat: build public website core`

### Signature motion (Milestone 3, committed)

- SSR/LCP Sandhi poster and deferred WebGL field.
- Once-per-session four-phase opening sequence, pointer/touch response, visibility pausing and reduced-motion fallback.
- Background thread drift/flow without a custom cursor.
- Published-only research graph API, accessible complete list equivalent, filters and detail panel.
- ConnectionsMini on project, research-area and person pages.
- Project relation hover threads, publication reflow, and supported page/title view transitions.
- Home initial JavaScript measured at approximately 137 KiB gzip excluding lazy WebGL.

Commit: `ec86263 feat: add signature research motion`

## 8. Milestone 4 implementation (gate passed, commit pending)

Implemented:

- Events list/detail, original and viewer-local time, built-in registration, external registration, recording/slides after an event, and `.ics` downloads.
- Event registration server validation, same-origin check, Turnstile, 5-per-10-minute rate limit, duplicate protection, and public-event validation.
- Opportunities grouped into Research positions, Internships, Collaborations, and Project-specific openings.
- Automatic expired-opportunity exclusion and exact "Closes in N days" labels.
- Opportunity-to-Join preselection.
- Resources with seven kinds, safe HTTP(S) links, license/version, BibTeX, project/publication relations, research areas and changelog.
- Insights with seven kinds, reading time, authors, desktop TOC, stable heading anchors, KaTeX, Shiki code, GFM footnotes, figures/captions and note BibTeX.
- Exact Open science copy.
- Published-only Partners with accessible logos, safe links, required kind grouping and exact empty copy.
- Command-palette navigation for every new public section and dynamic insight search.
- Sitemap entries and public no-JavaScript/axe coverage for the new indexes.

Browser verification against real records (isolated `sandhi_e2e` database, temporary records removed afterwards): past events show recordings and slides; future events hide them and offer registration; internal events return 404 (page and `.ics`); open opportunities show "Closes in 10 days" and preselect Join; expired opportunities return 404; insights render inline and display KaTeX, highlighted code, footnotes, figure captions and heading anchors; resources and partners render. Every one of those pages passed axe (WCAG 2.2 AA) after the fixes below.

## 9. Work completed in the Claude Code session (17 September 2026)

Codex stopped mid-debugging a failing scroll-restoration test. This session finished Milestone 4:

1. **Scroll restoration rewrite** (`components/navigation/ScrollRestoration.tsx`). Root cause: Next's router commits a Back/Forward traversal before our `popstate` listener runs, so the old code saved the outgoing page's scroll under the destination's key and restored the wrong value. Positions are now recorded on scroll and on the Navigation API `navigate` event (before a traversal applies), never in `popstate`; restoration waits for the router to render the destination; pushed entries always get a fresh key; fragment entries keep a null state (Next reloads the page when traversing to a state it did not create).
2. **Join form:** profile-link fields removed from the client and made optional on the server (legacy payloads are still validated); removable PDF rows; reload guidance; browser-history step tests.
3. **Research map:** layered layout with natural-width sizing and connection-levelled rows (`components/graph/graph-layout.ts`, 11 unit tests), forward-pass signal engine with trails and firing rings (`components/graph/neural-signals.ts`), panel connections and layer summary, `d3-force` removed. Owner feedback drove three iterations: stretched two-column map → compact centred map → content-edge map whose width follows its layers.
4. **Defects found and fixed during review:** undefined CSS tokens (`--lapis` rendered theme nodes black; `--font-ui` ×4; `--dur-standard`); events time-zone note failed AA contrast in both themes; `/research` theme counts used a prohibited `aria-label`; doubled rules on `/insights` and `/news`; three end-to-end tests with ambiguous locators; Home was prerendered once at build time, freezing scheduled news and counts until the next deploy (now dynamic like every other public page). Pages using `ResearchPages.module.css` stacked the intro margin and the first section's top padding (about 200px of empty space under the intro); the first section no longer adds top padding.

Tests added: layout unit suite (8), legacy-link schema test, Join history, reload, and file-removal end-to-end tests, map alignment/signal/reduced-motion end-to-end test.

## 10. Portal and admin routes

### Milestone 5 slice 1 — authentication foundation (committed)

- Better Auth (`lib/auth.ts`, `/api/auth/[...all]`): invitation-only (public sign-up disabled and its endpoint removed), verified email required, 12–128 character passwords, one-hour reset links that revoke other sessions, seven-day sessions, telemetry off, and the role field server-only. Unused endpoints (`update-user`, `change-email`, `delete-user`) are disabled.
- Rate limits (spec 10.4): 10 attempts per 15 minutes per IP and per email through the shared Upstash limiter, applied in the server actions and, for direct HTTP calls, in an auth hook. Suspended members cannot start a session.
- `lib/permissions.ts` holds the Part 8 matrix (Editor renamed Reviewer), Owner protection, and a redirect guard that keeps `next` inside `/portal` and `/admin`. `lib/authz.ts` enforces it: pages call `requireCapability` (people without access see "not found"), actions and route handlers call `authorize`.
- `proxy.ts` redirects signed-out requests for `/portal` and `/admin` to sign in before rendering; the server checks remain authoritative.
- Pages: `/portal/sign-in`, `/portal/reset-password`, `/portal/accept-invite/[token]` (token stored only as a SHA-256 hash, claimed atomically, creates the account, credential, and member in one transaction), a minimal `/portal`, and the `/admin` shell with the dashboard from spec 9.2. Portal and admin pages are `noindex`.
- Emails: invitation, verification, and password reset templates; without an email provider in local development the links are printed to the server log.
- Tests: permission matrix unit tests; end-to-end sign-in for each role, wrong password, suspended and unverified accounts, open-redirect refusal, sign-out, neutral reset response, the full emailed reset link (including replay refusal), and invitation acceptance; Better Auth's endpoint refuses cross-site sign-in (`INVALID_ORIGIN`).
- Known follow-up: the public header still says "Sign in" while signed in (Milestone 6, without adding a database query to every public page).

### Milestone 5 slice 2 — members, settings, and audit (committed)

- Shared admin plumbing (`lib/admin/actions.ts`): every mutation runs through `runAdminAction(capability, work)`, which re-checks the signed-in account on the server, and writes its `AuditLog` row inside the same transaction as the change. `lib/cache-tags.ts` names the data tags that admin changes invalidate (`updateTag`), ready for data-level caching.
- `/admin/members`: invite by email with role and rank (7-day links; resending replaces the link, and withdrawing revokes it), search and status filters, and a detail page for access (role and rank), status (active, alumni, suspended — suspension deletes every session at once), removal that requires typing the member's name and is refused for anyone with a scholarly record or who invited others, and Owner-only ownership transfer. Nobody can change their own access, and only the Owner can change the Owner.
- `/admin/settings` (Owner and Admin): contact addresses, location, social links (https only), which public sections show (Events, Partners, the home page numbers), application retention, and a site notice. Stored values are validated again when read, so a bad row falls back to its default. Switching a section off removes it from the navigation, command palette, footer, and sitemap and makes its pages, calendar files, and registration endpoint return 404. Saving an untouched form records nothing.
- `/admin/audit` (Owner and Admin): every administrative change, newest first, filtered by record type and action, 50 per page, with the recorded changes.
- Forms keep what was typed when a save is refused (React resets a form after its action; `components/forms/useFormAction.ts` opts out while keeping the no-JavaScript fallback). This also fixes the sign-in form clearing the email after a wrong password.
- Tests: settings parsing and validation unit tests; end-to-end invitation and withdrawal, Owner protection, suspension signing a member out, removal by name, settings changing the public site at once and being audited, and Members and Reviewers failing to invite, promote, or change settings even by posting harvested server-action references directly.
- The settings end-to-end tests change every public page, so Playwright runs them alone after the rest of the suite (`chrome-site-wide` project).

The fixture-backed end-to-end run now also needs `DATABASE_URL` (the invitation and reset tests create and read records): `E2E_FIXTURES_READY=true DATABASE_URL=… pnpm test:e2e`. Fixture accounts use the password `fixture-password-2026` and exist only in test databases.

## 10a. Portal and admin routes still to build

### Admin routes (Milestone 5)

Built: `/admin`, `/admin/members`, `/admin/settings`, `/admin/audit`, and the sign-in, reset, and invitation routes (slices 1 and 2). Still to build:

- `/admin/research`
- `/admin/projects`
- `/admin/publications`
- `/admin/news`
- `/admin/events`
- `/admin/opportunities`
- `/admin/applications`
- `/admin/resources`
- `/admin/insights`
- `/admin/partners`
- `/admin/approvals`

Every admin mutation must enforce authorization on the server, create an AuditLog record, and revalidate affected cache tags. Hiding an action in the interface is never sufficient authorization.

Required admin workflows still to build:

- Research/project/publication/news/event/opportunity/resource/insight/partner managers.
- Search, filters, bulk actions, Markdown preview, slug uniqueness, state/scheduling and public preview.
- Mandatory image alt text that blocks save.
- DOI and arXiv import; DOI must populate title/authors/venue/year.
- Application kanban and detail, signed 10-minute private-file access, private notes, rating, status/email and accepted-to-invitation action.
- Change-request approvals with old/new diff.

### Member portal routes (Milestone 6)

- `/portal` dashboard.
- `/portal/profile`
- `/portal/projects`
- `/portal/projects/[slug]`
- `/portal/publications`
- `/portal/publications/new`
- `/portal/publications/[id]`
- `/portal/tasks`
- `/portal/meetings`
- `/portal/announcements`
- `/portal/workspace`
- `/portal/insights`

Required member workflows still to build:

- Local-time greeting, personal counts, announcements, activity and 14-day deadlines.
- Profile editing with direct private-field updates and approval-gated public fields for Members.
- Exact pending banner: “Your changes are waiting for approval.”
- Project workspace tabs: Overview, Tasks, Experiments, Documents, Meetings, Publications.
- Keyboard-accessible kanban with To do, In progress, Blocked and Done.
- Publication creation/import, ordered internal/external authors, private manuscript, links and review workflow.
- Draft → Internal review → Submitted → Accepted → Published.
- Personal task filters, meeting calendar/agenda and per-meeting ICS.
- Pinned/unread announcements.
- Insight Markdown editor with live math/code preview and review submission.
- Automatic relational propagation: one newly linked publication appears on its project, publication list and every linked public author profile.

### Research workspace (Milestone 7)

- Experiments grouped by project.
- Hypothesis, JSON configuration, datasets, model, private results JSON, notes and milestone.
- Weights & Biases / MLflow external tracking URL.
- Timestamped experiment logs.
- Project document library with private files.
- Dashboard/project activity feed.
- Tests proving experiment results cannot appear on any public route.

## 11. Hardening and launch work still required (Milestone 8)

### Security hardening completed (17 September 2026)

- **Content Security Policy** (`proxy.ts`, `lib/security-headers.ts`): a fresh nonce per page request; scripts need the nonce, and `'strict-dynamic'` extends trust to the scripts they load; `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`; Turnstile allowed for scripts and frames; direct uploads allowed only to the configured R2 account host; `upgrade-insecure-requests` only over HTTPS; `'unsafe-eval'` only in development. Styles allow inline attributes because KaTeX, Shiki and motion require them. The root layout applies the nonce to its inline theme script.
- **Static headers** on every response (`next.config.ts`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a minimal `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, and HSTS (`max-age=63072000; includeSubDomains`) from production builds. `preload` is left for the owner to decide.
- **Cross-site request refusal:** contact, join, upload and event registration share `isSameOriginRequest` (refuses `Sec-Fetch-Site: cross-site` and foreign `Origin`; a missing `Origin` is refused in production). It runs before rate limiting so forged requests cannot spend real visitors' quota.
- **Search rate limit:** 60 requests per minute per client; search stays available (and logs) if the limiter is unreachable, since it is read-only and bounded.
- **Zod runs without JIT** (`lib/zod.ts`): its `new Function` probe otherwise reported a CSP violation on every form page in production.
- **Dependencies:** `lodash`, `mysql2`, and `deepmerge-ts` pinned to patched releases through `pnpm-workspace.yaml` overrides (`deepmerge-ts` 8 keeps the API the Prisma CLI's config loader uses; validate, generate, and migrate status were checked). `pnpm audit` reports no known vulnerabilities.
- **Verification:** unit tests for the policy builder and origin checks; a join-route test proving cross-site posts do no work; an end-to-end security spec (headers, unique nonces, zero violations on Home, Research, Join, Publications, Contact, 403 for cross-site posts) that also passed against a production build, where an injected script without the nonce was blocked and recorded, and an insight with KaTeX and highlighted code rendered with no violations.

### Security checklist, slice A (19 September 2026)

The owner's 100-item security checklist is tracked item by item in [`docs/security/checklist.md`](docs/security/checklist.md); settings that live in hosting dashboards are in [`docs/security/operations.md`](docs/security/operations.md), and the reporting policy is `SECURITY.md`.

- Production refuses a remote database without TLS (`sslmode=require`) and an auth secret shorter than 32 characters (`lib/production-config.ts`).
- Password-reset tokens are stored only as SHA-256 hashes (Better Auth `verification.storeIdentifier`).
- `/.well-known/security.txt` (RFC 9116) is generated from the general contact address in Admin → Settings, with a rolling six-month expiry.
- `scripts/db/least-privilege.sql`: a runtime role that cannot change the schema and can only append to the audit log (tested inside a rolled-back transaction).
- GitHub: CI (lint, types, tests, contrast, build, dependency audit), CodeQL (security-extended), and Gitleaks on every push, with actions pinned to commit SHAs and read-only tokens; Dependabot weekly for npm and actions.
- Still to come: breached-password refusal, security event logging and alert emails (B); session list and revocation, re-authentication for sensitive actions (C); authenticator-app two-factor authentication required for staff (D); passkeys (E).

Remaining for launch hardening:

- Verify Turnstile with a live site key under the policy; add Plausible's origin when analytics is integrated.

- Nonce-aware Content Security Policy compatible with KaTeX, WebGL, Turnstile and Plausible.
- `frame-ancestors 'none'`, HSTS, referrer and permissions headers.
- CSRF review for every mutation.
- Magic-byte/MIME/size validation for CVs, proposals, images and manuscripts.
- Ten-minute private signed URLs.
- Retention cron that removes expired application records and their private files.
- Axe checks on every public route, including fixture-backed dynamic details.
- Lighthouse targets: at least 95 for accessibility/best-practices/SEO on public pages, at least 95 performance generally, and at least 90 performance on Home.
- LCP under 2.5s, CLS below .05, INP below 200ms.
- Home initial JavaScript below 150 KiB gzip excluding deferred WebGL.
- Final production README replacing the current create-next-app placeholder.
- `LAUNCH_CHECKLIST.md`.
- Neon/PostgreSQL production database and migration deployment.
- R2 public/private buckets, Resend, Upstash, Turnstile and Plausible configuration.
- Vercel deployment.
- Cloudflare DNS for `sandhiresearch.org` apex and `www` → apex redirect.

External/team-owned launch dependencies:

- Provisioning the `@sandhiresearch.org` mailboxes.
- Resend domain verification.
- Writing/approving real bios, projects, publications and partner content.
- Legal review of Privacy and Terms.
- Deciding whether to publish a physical location.

### Performance baseline (measured 17 September 2026)

Production build, Lighthouse-style mobile throttling (4× CPU, 150 ms RTT, 1.6 Mbps), local server without a database:

| Route              | LCP    | CLS   | TBT       | Initial JS (gzip)                   |
| ------------------ | ------ | ----- | --------- | ----------------------------------- |
| `/`                | 0.99 s | 0     | 470 ms    | 145.6 KiB (+241 KiB deferred WebGL) |
| `/research`        | 1.05 s | 0     | 125 ms    | 147 KiB                             |
| `/join`            | 1.03 s | 0.016 | 146 ms    | 239 KiB                             |
| other public pages | ~1.0 s | 0     | 37–109 ms | ~142 KiB                            |

Open performance items for Milestone 8:

- **Home TBT:** the deferred three.js hero initialises right after load. Budget passes, but measure with real Lighthouse and consider idle-time initialisation without breaking the opening sequence.
- **`/join` bundle:** one ~90 KiB chunk, most likely the shared Zod schemas; investigate before changing validation.
- **Server-side caching:** every public page renders per request and queries the database. The specification's nonce-based CSP requires dynamic rendering, which rules out ISR/CDN page caching. The compatible design is data-level caching (`unstable_cache` with tags): cache published records, apply time rules (`publishAt`, deadlines, event end) after the cache so visibility guarantees stay exact, and have Milestone 5 admin mutations revalidate the tags.
- Not applicable: a load balancer or CDN (Vercel provides both); minification and compression (Next production builds and Vercel already do this); a route loading skeleton (removed deliberately in Milestone 2).

## 12. Quality gates

At the end of every milestone, run these commands in this exact order and fix every failure before continuing:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Also run:

```bash
pnpm contrast
pnpm build
```

Milestone-specific current acceptance checks:

- Events show recordings/slides only after the event.
- Internal events are absent publicly.
- Expired opportunities are absent.
- Insights render math, highlighted code, GFM footnotes and figure captions.
- Public routes retain reading content without JavaScript.
- Both themes pass contrast checks.
- Reduced motion removes every non-essential animation.
- List → Map does not change the graph scale.
- Join browser Back/Forward follows the form steps.

## 13. Current repository state and safe resume point

Committed and pushed through Milestone 3:

```text
ec86263 feat: add signature research motion
a0cf546 feat: build public website core
c5e5822 build foundation and research data model
```

Milestone 4 is complete, passes every gate, and is committed. `graphify-out/` is a local code-graph cache and should not be committed.

Local environment notes:

- The project requires Node 20.19–24. The machine's default `node` is 25; use Node 24 (Codex's runtime: `~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`) with pnpm 11.19.
- Next 16 allows one `next dev` per project directory (`.next/dev/lock`). Stop a running dev server before starting another, or point Playwright at it with `PLAYWRIGHT_BASE_URL`.
- Launch-state preview: a seed-only database (`sandhi_preview`: migrations and `pnpm seed`, no fixtures) shows exactly what production shows before real content is added.
- Fixture-backed end-to-end run: create an isolated database (for example `sandhi_e2e`), run `pnpm exec prisma migrate deploy`, `pnpm seed`, and `pnpm seed:fixtures` with `DATABASE_URL` pointing at it, start the dev server with that `DATABASE_URL` on port 3100, then run `E2E_FIXTURES_READY=true pnpm test:e2e`.

Safe next sequence:

1. Data-level caching (section 11): cache published records with tags, apply time-based visibility after the cache, with tests.
2. Verify Turnstile with a live key under the CSP once credentials exist.
3. Begin Milestone 5 with authentication/authz first, then admin foundations, then manager modules, including tag revalidation on every mutation.

## 14. Definition of complete

The website is not complete merely because the public pages render locally. Completion means:

- All eight milestones are checked in `PLAN.md` in order.
- Public, portal and admin workflows are implemented and server-authorized.
- All visibility/privacy invariants have automated coverage.
- All required quality, accessibility, security and performance targets pass.
- Production services and environment variables are configured.
- Database migrations and owner seed are deployed safely.
- The Vercel production deployment is live at `sandhiresearch.org`.
- `www.sandhiresearch.org` redirects to the apex.
- The final launch checklist clearly separates completed technical work from the few human-owned content/legal/email tasks.
