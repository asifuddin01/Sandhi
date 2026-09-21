# SANDHI Research Lab — build brief and current status

Last updated: 19 September 2026 (Asia/Dhaka)

This document is the durable handoff for the complete SANDHI Research Lab website. It records what the product is, the decisions made during the build, what is already implemented, what is currently being finished, and what remains before launch.

The governing detailed specification remains `SANDHI_Codex_Build_Prompt.md`. `PLAN.md` is the milestone gate checklist. If this document and the specification differ, the user's latest explicit decision takes precedence, followed by the specification.

### Current completion snapshot

- **Milestones 1–3:** complete, tested, committed, and pushed.
- **Milestone 4:** complete. Every gate passes (lint, typecheck, 87 unit tests, 62 end-to-end tests with fixture-backed visibility enabled, contrast, production build). Committed and pushed with the owner's standing approval.
- **Latest user refinements:** implemented and tested — Join path context, optional-link removal, form-step history, proposal/CV rules, removable PDF attachments, exact route scroll restoration, and the layered neural-network research map with signal motion.
- **Security hardening (first Milestone 8 items):** implemented, tested against a production build, committed, and pushed — see section 11.
- **Milestone 5 (in progress):** slice 1 — authentication, authorization, protected routes, and the admin shell — is committed; members and invitations, content managers, the applications pipeline, approvals, and data caching follow in that order.
- **Milestone 9 (mobile app readiness):** complete and committed — the versioned `/api/v1` surface, bearer-token sessions for native clients, the member read model with ownership checks, administration-editable release settings, the public `/app` download page, and verified deep links. See section 10b.
- **Milestones 6–8:** otherwise not started. These contain the member portal, the private research workspace, security/performance hardening, deployment, and DNS.
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

### Milestone 5 slice 3 — content framework and News (committed)

- Shared publishing rules (`lib/content-state.ts`): the five states, slugs, scheduling, bulk actions, and which states may be deleted. Scheduled news goes live on its own once its time passes (`publicNewsWhere` now includes `SCHEDULED` with a past `publishAt`); no cron flips states. Admin forms read and show times in Dhaka time (`lib/dhaka-time.ts`).
- Shared editor pieces (`components/admin/ContentFields.tsx`): title and address fields where the address follows the title until edited; a Markdown field whose live preview is rendered by a server action with the public `Prose` component (`app/admin/preview-actions.tsx`), so the preview is sanitised and styled exactly like the site; a select-all checkbox for bulk actions.
- `/admin/news`: search, state and category filters, pagination, bulk publish, draft, archive, and delete (drafts and archived only); status shows Live, "Scheduled for …", or the state. The editor covers title, address, summary, Markdown body, category, state, publish time, author, and related project and publication; duplicate addresses are refused. `/admin/news/[id]/preview` renders the shared `NewsArticle` component, so the preview is the public page. Every change is audited (body edits recorded as changed, not copied).
- Public rendering fixes found while building the preview: maths rendered twice because no KaTeX stylesheet was loaded (now MathML only), Markdown lists had no markers (the global reset removed them), and highlighted code had no colours (the two-theme variables were never applied; now GitHub's high-contrast themes follow the site theme). Light-theme status colours now meet 4.5:1 and are checked by `pnpm contrast`.
- Tests: publishing rules, Dhaka time, and the math regression in unit tests; end to end, the full write–preview–schedule–publish–archive–delete flow, sanitised live preview, duplicate addresses, reviewer access, member refusal including direct posts, and axe on the list and editor.

### Milestone 5 slice 4 — Events and Opportunities (committed)

- Shared pieces extracted from News: `lib/admin/content-actions.ts` (field parsing with https-only links, one-per-line lists, Dhaka times, change diffs, and a generic bulk runner with per-record delete guards) and `components/admin/ContentIndex.tsx` (the list view with search, filters, always-mounted bulk form, status cell, and pagination). News now uses them too.
- `/admin/events` (staff): kind, start and end (end must follow start), speakers, location, online flag, built-in or external registration, recording and slides links, state. Internal events are never public and preview as such. The editor shows the registration count; only administrators see registrants' names and emails. Events with registrations cannot be deleted (archive instead). The preview renders the shared `EventDetail` with the registration form replaced.
- `/admin/opportunities` (administrators): kind, research areas (validated), description, responsibilities and requirements, duration, location, remote flag, deadline, state. Openings close on their own after the deadline ("Closed" in the list). Opportunities with applications cannot be deleted. The preview renders the shared `OpportunityDetail`.
- Fixed: the Markdown preview faded its text while refreshing, dropping contrast to 3:1; busy is now shown by the border.

### Milestone 5 slice 5 — Resources and Partners (committed)

- `/admin/resources` (staff): name, address, kind, Markdown description, licence, version, https-only download, repository, documentation, and Hugging Face links, BibTeX, Markdown changelog, related project and publication, and research areas (stored as `ResourceArea` links, replaced on each save). The preview renders the shared `ResourceDetail`.
- `/admin/partners` (administrators): name, kind, description, relationship, https website, display order, state. The preview renders the partner's card through the public `PartnerDirectory`. Existing logos are kept; logo upload arrives with image uploads.
- Fixed: the partner card's text wordmark (shown when there is no logo) repeated the name to screen readers; it is now hidden from them, since the heading names the partner.

### Milestone 5 slice 6 — Projects and Research (committed)

- `/admin/projects` (staff): title, address, one-line description, research question, abstract, Markdown motivation, approach, experiments, and results (with the results-public switch), project status, dates (end after start), https code, dataset, and demo links, featured flag, research areas, related projects, and the team (`components/admin/TeamField.tsx`: people in order with role and lead flag; each person once). Projects with publications, tasks, or meetings are archived, not deleted. The preview renders the shared `ProjectDetail`; private team members never appear publicly.
- `/admin/research` and `/admin/research/areas` (administrators): themes (name, address, short description, Markdown overview, order, state) and areas (name, address, theme, summary, overview, open questions, order, state). Renaming an area's address updates opportunities that name it. Themes with areas, and areas linked to projects, publications, people, or resources, are never deleted. Previews render the shared `ThemeDetail` and `AreaDetail`.

The fixture-backed end-to-end run now also needs `DATABASE_URL` (the invitation and reset tests create and read records): `E2E_FIXTURES_READY=true DATABASE_URL=… pnpm test:e2e`. Fixture accounts use the password `fixture-password-2026` and exist only in test databases.

## 10b. Milestone 9 — mobile app readiness (committed, 19 September 2026)

The SANDHI app for Android and iOS is a **client of this backend**, not a second
system. There is no separate API, database, account store, or permission model.
Everything below was built so a future React Native app reads and writes exactly
what the website does. The contract is `docs/mobile/API.md`; the app's own
architecture and distribution are in `docs/mobile/APP.md`.

- **`/api/v1` (`app/api/v1/**`, on `lib/api/*`).** One envelope
  (`{ data, meta }` or `{ error, meta }`) and one wrapper, `apiRoute()`, that
  applies the client-header rule, the minimum-version gate, rate limits,
  authorization, and error mapping. Public reads call the same `lib/public-*.ts`
  read models the pages call, so `lib/visibility.ts` decides what is public in
  exactly one place. Sections switched off in settings answer 404 here too.
- **Bearer-token sessions.** Better Auth's `bearer` plugin (`requireSignature`)
  turns `Authorization: Bearer <token>` back into the session cookie for the
  request, so `getViewer`, `authorize`, the two-factor requirement, the
  twelve-hour staff session limit, the suspended-member block and the audit
  trail are unchanged. `/api/v1/auth/{sign-in,two-factor,sign-out,session,password-reset}`
  wrap the same in-process calls the portal's server actions use.
  **Two-factor sign-in returns an opaque challenge**, never a session: Better
  Auth stamps the discarded password-only session's token onto that response,
  and `readSignInOutcome` deliberately decides from the session cookie instead.
- **CSRF without CORS.** The API answers no preflight and sends no CORS headers,
  so a browser on another origin cannot attach `X-Sandhi-Client`. Requiring that
  header on every mutation is what stops a cross-site post with a visitor's
  cookies. Native clients are not subject to CORS, so nothing is lost.
- **Member reads (`lib/portal-content.ts`).** Profile, projects, announcements
  and documents, every query keyed on the viewer's own member id rather than on
  an id from the request. Private documents come back as links that expire in
  ten minutes (`createPrivateDownloadUrl`); the storage key never leaves the
  server. **This module is the one the Milestone 6 portal pages will read
  through, so the website and the app cannot drift apart.**
- **Release settings (`lib/mobile-app.ts`, `/admin/settings` → SANDHI app).**
  Version, version code, APK address, size, SHA-256, minimum OS, notes, the iOS
  distribution and install link, and the minimum supported version. Stored as
  one `mobile.app` row, validated on write and again on read. A platform is
  published only with both a version and an https address.
- **Android distribution without the Play Store.** `/app` states the version,
  size and checksum and links to `/download/android`, one stable address that
  redirects to whichever build administration published. The page stays hidden
  (and `/app` 404s) until a build exists.
- **iOS distribution.** The settings record which private method the lab uses —
  TestFlight, Apple Business Manager, enterprise, or the App Store — and `/app`
  explains the steps for the chosen one.
- **Update checks.** `GET /api/v1/app/release`, plus a 426 `upgrade_required`
  refusal carrying the current release when an installed build is below the
  minimum. Browsers and unidentified clients are never gated.
- **Deep links.** `/.well-known/assetlinks.json` and
  `/.well-known/apple-app-site-association`, built from `ANDROID_APP_ID`,
  `ANDROID_APP_FINGERPRINTS` and `IOS_APP_ID`. `/portal`, `/admin`, `/api` and
  `/join` are excluded, so account and upload flows stay in the browser.
- **Also fixed here:** `/api/auth/change-password` is now rate-limited (finding
  S-4, partial): a bearer token makes that endpoint easier to reach.
- **Tests.** Unit: `api-contract`, `api-auth-cookies`, `api-handler`,
  `mobile-auth`, `portal-content`, `mobile-app`, `app-links`. End-to-end:
  `mobile-api.spec.ts` (envelope, refusals, the full native sign-in and
  sign-out, the two-factor challenge) and `mobile-app-release.spec.ts`
  (site-wide: publishing a release, `/app` with axe, the redirect, the version
  gate, and restoring).

**Not built, deliberately:** writing. Editing a profile, drafting an insight and
marking an announcement read arrive with Milestone 6 as server-side actions the
website and the app both call. Building them API-first now would be the one way
to make the two surfaces diverge.

## 10c. Project progress and materials (20 September 2026)

The team runs a project from the site, and the public sees as much of it as the
team chooses to show.

- **Two layers.** The _stage_ (`ProjectStatus`) is drawn as a numbered thread
  by `components/entries/ProjectStage.tsx` on the project card, the portal page
  and the public page: one glance answers "how far along is this". Under it sit
  _updates_ — dated notes saying what happened and what comes next.
- **`ProjectUpdate`** records the stage it was written at, so the history still
  reads correctly after the project moves on. It is internal when written;
  publishing is a separate button. `publicProjectUpdateWhere` needs both halves
  (the update public _and_ its project published), so publishing a project
  cannot retroactively publish working notes and publishing a note cannot leak
  an unpublished project.
- **`ProjectSection`** is the project's standing account of itself —
  Methodology, Datasets, Architecture, Evaluation — written by the team and
  edited in place, unlike an update, which is dated and never changes. A
  section appears on the public project page after the research question,
  once the team publishes it.
- **`ResearchPhase`** is the finer step inside a running project — proposal
  accepted, design, data, training, analysis, writing, manuscript ready. It is
  the team's to set; the five-stage `ProjectStatus` above it stays
  administrative. Both threads are drawn together, the phase only while the
  project is under way, and an update records the phase it was written at.
- **`Attachment`** carries the materials for either owner: a figure
  (architecture or pipeline diagram, plot, screenshot) shown inline, and
  documents and data files (dataset descriptions, tables, protocols) offered
  as downloads. A database check constraint holds it to exactly one owner. The
  browser uploads straight to the private bucket with a ten-minute signed URL
  minted only for a member on that project; the server then reads the object
  back and checks its type, size and format signature before a row exists.
  SVG is refused because figures are drawn inline. Tables and maths belong in
  the update body, which is the site's sanitised Markdown.
- **`/files/attachments/[id]`** is the authorization decision; the signed link is
  its last step. Public when the update and project both are, otherwise only
  for someone on that project, and the same 404 for every other case.
- **A research lead hands work out.** `Task` rows belong to a project and go
  to one member or several (`TaskAssignee`), with a state, a priority and an
  optional due date in Dhaka time. Whoever a task is on can move it along —
  a board only tells the truth if the person doing the work can say where it
  is — while assigning, reassigning and deleting stay with the leads.
- **An assistant research lead does everything the lead does on that project**
  (`ProjectMember.isAssistantLead`). A lead or an administrator appoints one;
  nobody appoints themselves, and the research lead itself is still named in
  administration, where teams are formed. This is per-project data, never an
  entry in `lib/permissions.ts`.
- **The controls live where the work is read.** `/projects/[slug]` shows an
  "Update this project" button to whoever is on that project — `membershipOf()`
  is one indexed row — and nothing at all to everyone else. The header, mobile
  menu and footer say "Portal" rather than "Sign in" to someone signed in.
- **The diagram builder is in the More menu** for anyone signed in, beside
  My projects, and in the command palette. Signed-out visitors see neither.
- **Routes:** `/portal/projects`, `/portal/projects/[slug]`,
  `/api/portal/attachments`, `/files/attachments/[id]`.

## 10d. Proposals, and how a team forms (20 September 2026)

An idea can come from anywhere, and the path from idea to team runs on the
site.

- **Anyone may send one.** `/proposals` is public: a member, a student, a
  colleague at another institution. It is treated like the other public forms
  — same origin, rate limited, behind Turnstile — and a signed-in member is
  credited from their session, never from the fields they filled in.
- **`Proposal`** moves Submitted → Under review → Queued → Approved, or is
  sent back. A **reviewer** (`proposals:review`, staff) takes one, queues it or
  declines it, always with a note kept on the record. Only an
  **administrator** (`proposals:approve`) approves.
- **A queued proposal is posted to the lab** at `/portal/proposals`, where
  members say they would work on it and what they would bring
  (`ProposalInterest`). An idea still under review is not posted: it is not an
  invitation.
- **Approving is the moment it becomes work.** One transaction creates the
  project from the proposal, puts everyone who volunteered on the team, names
  the research lead from that same list, links the proposal to what it became,
  and writes the audit record. The project starts as a draft: approved, not
  announced.
- **Routes:** `/proposals`, `/api/proposals`, `/admin/proposals`,
  `/admin/proposals/[id]`, `/portal/proposals`.

### The owner's own account

`pnpm seed:owner` creates it, and reads the password from
`SEED_OWNER_PASSWORD` at the moment it runs: the password is never in the
repository, never in a file, and only its scrypt hash is stored. The profile
itself — title, bio, interests, GitHub, LinkedIn, site — is the owner's own
published information, written into `OWNER_PROFILE` in `prisma/seed.ts`.

The rank defaults to **research lead** (`SEED_OWNER_RANK` overrides it, and
`SEED_OWNER_TITLE` the title): owning the site and directing the lab are
different things, and a lab can run with a research lead and no director.

Two switches, both off by default:

- `SEED_OWNER_PUBLIC=true` publishes the profile on `/people`. A profile is
  not published just because it exists.
- `SEED_OWNER_LEAD_ALL=true` puts the owner on every project as its research
  lead and on every research area as area lead, so the portal has something
  to open. A development convenience: never set it in production.

Research lead stays a per-project and per-area fact (`ProjectMember.isLead`,
`MemberArea.isLead`), never an entry in the permission matrix.

### Two-factor authentication, for everyone

Every account needs an authenticator, members included: the lab's unpublished
work, its people's addresses and its files sit behind a password otherwise.

- The gate lives in `app/portal/layout.tsx`, not in each page, because a gate
  that has to be remembered is one that will be forgotten the next time
  someone adds a page. It reads `x-pathname`, set by `proxy.ts`, and lets
  through only the ways in and `/portal/security`, where the authenticator is
  enrolled — gating that would be a locked door with the key behind it.
- Nobody can turn it off. The control is gone and the action refuses; a lost
  device is reset by an administrator, which replaces the authenticator
  rather than leaving the account without one.
- `requiresFreshStaffSession()` is now separate from `requiresTwoFactor()`.
  They were one condition, and making two-factor universal would have
  silently given every member administration's twelve-hour session expiry.
- **A passkey counts.** It is already two factors — the device, and the
  fingerprint, face or PIN the device insists on, which
  `lib/passkey-policy.ts` refuses to do without. `Viewer.secondFactor` is
  true for either, and the passkey count is only asked for when an
  authenticator has not already answered the question.
- **The setup page offers a way out.** It is where someone without a second
  factor is held, so it carries its own sign-out: otherwise a person who
  cannot finish — wrong account, lost phone — is trapped on it.
- Signing in and out revalidate the root layout. The header, mobile menu and
  footer change with the session, a client navigation reuses the layout it
  already has, and without this the header went on offering "Sign in" to
  someone who had just signed in.

### Naming a research lead, where the person is

`/people/[slug]` carries an administration panel for anyone with
`members:manage`, and nothing at all for everyone else. It sets the person's
standing — Research Lead, Research Assistant, Research Intern — and puts them
on a research area, with or without leading it. Naming a lead is a decision
made about a person, so it is made while looking at them rather than in a
list of rows in administration; the capability is the same either way, and
the server checks it again on every action.

Both actions audit in the same transaction as the change. Leading an area
stays a fact on `MemberArea.isLead`, never an entry in the permission matrix,
and the extra query the panel needs is asked only when the viewer can act on
the answer.

Granting **administrator** is deliberately not here: that is a site-wide
change of power and stays in the members manager, where it is audited beside
the rest of the access trail.

### Announcements: the News section, for the lab only

Staff post notices at `/admin/announcements` — a deadline, a seminar, a
change of plan — and anybody signed in with a member record reads them in a
marked-off box at the top of `/news`. A signed-out visitor sees no box, no
heading and no trace that one exists.

The rule is enforced at the source, not by the page remembering to hide
something: `getMemberAnnouncements` returns nothing at all without a member
record, so an empty list renders no section. The test holds that across the
page, the public news API and search.

Called **"Lab announcements"** rather than "Announcements", because the
public news categories in the filter row directly below already include one
named Announcements. Two different things with one name on one page is a
trap.

The body is Markdown, so a deadline can carry a link — staff write these,
unlike an application, where a stranger's words are shown as plain text.

`/news` is now read per viewer and cannot join the shared public cache. That
is the right trade: an announcement must never be served from an entry shared
between readers.

### A published profile is reviewed before the public sees it

The specification asks for "direct private-field updates and approval-gated
public fields for Members", with the banner "Your changes are waiting for
approval." The `/portal/profile` first shipped in this milestone wrote
straight through for everybody, which did not match it; this closes that, and
fills `/admin/approvals`, which the dashboard had been counting with nowhere
to go.

Everything on the profile form shows on a published profile, so for a member
whose profile is published, all of it waits. Two people edit directly: staff,
and anybody whose profile is **not published yet** — there is nothing to
protect, and a new member must not be held at the completion gate waiting for
somebody to approve their own name. `profileCompletedAt` is therefore set on
submission, never on approval.

One `ChangeRequest` per field, replacing any earlier request for the same
field so a queue cannot fill with one person's second thoughts.
`/admin/approvals` groups them by person and decides them together —
approving half of somebody's changes would publish a profile nobody wrote.

`APPROVAL_FIELDS` and the row the action reads are kept in step by the type
system rather than by care: `queueChanges` asks for a row keyed by every
approval field, so dropping one from the select is a compile error instead of
a change that silently never queues.

**The third time this bit.** Approving empties the queue, the person's block
disappears, and the form inside it takes its own message with it — the same
fault as the invitation form and the decision emails. Rather than patch it a
third time, the page now carries "Decided in the last day", which outlasts
the redraw and answers the question somebody actually comes back with: did I
already do that one?

### Telling people what was decided

Both inbound paths recorded a decision and told nobody. Somebody sent in an
idea, or applied to join, and the answer existed only inside the lab. The
confirmation email an applicant already receives says we "read every
application and will reply by email", so this was a broken promise rather
than a missing nicety.

A decision now emails the person: `ACCEPTED` or `REJECTED` for an
application, `APPROVED` or `DECLINED` for a proposal. Nothing else does —
being read, or shortlisted, or queued, is the lab talking to itself and not
an answer.

**What they are told is not the internal note.** `Proposal.decisionNote` is
documented as never shown publicly and is written for whoever picks the
proposal up next; application notes are the same. Both screens now carry a
separate "What to tell them" field, and the audit entry records only
*whether* a message was included, never its text — an audit log is read by
more people and kept longer than the thing it describes.

`decisionSentAt` on both models records that the person was actually told,
and is cleared whenever the decision changes, so a second decision is told as
well as the first. The queue shows **"Not told yet"** against any decided
application nobody has heard about, because a decision that quietly never
reached anyone is the exact failure this work exists to prevent.

An email that fails does not undo a decision the lab has made. The decision
is saved first; if the send fails the administrator is told so in the form's
own message, the record keeps saying nobody was told, and a **Send it now**
button stays on the page. Without that, a failure would be both invisible and
unrecoverable.

An approved proposal becomes a **draft** project, so the email carries no
link — there is nothing the proposer could open yet, and a link to a page
they cannot see is worse than none.

Two test faults this exposed, both pre-existing in shape: `proposals.spec.ts`
creates proposals under one title prefix and deletes by that prefix, so in
parallel its tests deleted each other's rows; it takes turns now. And the
decision labels appear on both the review and approve forms, so the decline
test is scoped to the Review section rather than guessing with `.first()`.

### Reading what arrives from Join SANDHI

Applications were being collected and emailed to an address, and that was
all: nothing in the site could read them, so a queue existed only in
somebody's inbox. `/admin/applications` is that queue — filtered by state and
by path, searchable by name, email or institution, and headed by how many are
still waiting on an answer rather than how many exist.

An applicant's words are shown **as plain text, not Markdown**. An
application comes from somebody with no account, and an administrator reading
it should see what they typed rather than a rendering of it that can carry a
link wearing someone else's name.

The CV and the proposal PDF are the most private things the site holds, so
they are reached through `/files/applications/[id]/[kind]`: the route is the
authorization decision, the signed link is its last step, it lives ten
minutes, and it is never cached or shared between readers. A reader without
`applications:manage` — or with it but no second factor yet — gets the same
404 as a file that does not exist.

Accepting is what offers an invitation. Inviting somebody the lab has not
decided about is how a queue stops meaning anything, so the button appears
only on an accepted application, and `INVITED` is not a state anybody sets by
hand: it means an invitation was really created and sent. The invitation is
the same one the members manager sends, so the person lands in the same
onboarding — accept, set up an authenticator, write a profile. They are
invited as an ordinary member; administration is granted afterwards,
deliberately, in Members.

Two things worth keeping:

- **The invite form stays on the page after sending.** Sending revalidates
  the page, and a form that unmounted on the way would take its message with
  it — including the one that matters, which is that the email did not go and
  needs resending from Members.
- **The dashboard's "New applications" count links only for a reader who can
  open it.** A count with nowhere to go is a count nobody acts on; a link to a
  404 is worse.

### Writing your profile, on the way in

The portal gate has two rungs now, taken in order. A new member sets up an
authenticator, and then — not before — is asked to write their profile.
Asking for both at once is how somebody gives up halfway and leaves an
account half-made.

The second rung costs nothing per request. `Member.profileCompletedAt` is one
more column on the row `getViewer()` already reads, so the gate is a boolean
on the session rather than a query. The migration backfills it for everyone
who already has a description and an interest, because sending the people
already in the lab to fill in a form they filled in long ago would be
absurd.

What counts as written: a name, a paragraph about the work, and at least one
research interest. **Not a photograph.** It is the one thing somebody may not
have to hand on their first morning, and locking a new member out of their
own projects over a missing picture is a worse outcome than a profile without
one. The form asks; the gate does not insist.

`/portal/profile` is not an open path — a person still needs their second
factor to reach it. It is exempt only from the rung that sends people to it,
which would otherwise be a redirect to itself. Like the security page, it
carries its own sign-out: held there with no way out is how an account gets
abandoned.

Completion is recomputed on every save, so emptying a field takes the date
back to null and the portal asks again. The form marks those fields
`required`, but that is the browser being helpful, not the rule — the server
decides, and a test proves it by turning the attribute off.

Profile changes are audited. A profile is published to a public page, so who
changed it and when belongs in the same trail as everything else.

#### Photographs

A portrait goes straight from the browser to the **public** bucket and is
served from it: it is a picture on a public page, so signing every read would
be ceremony. The upload slot is minted only for the signed-in member, and the
key carries their member id — a valid receipt spent on somebody else's key is
refused, which is a case worth having a test for, because the receipt alone
would not catch it. The stored object is checked for size and for the format's
signature before `photoKey` is written: the declared media type is the
browser's claim, and the bytes are what a visitor will be handed. No SVG.

`R2_BUCKET_PUBLIC` has been in `.env.example` since the start and now has
its first use. Without it the rest of the profile form works
normally and the picture field says why it cannot: a lab that has not
connected storage is not a lab that should be unable to write a profile. The
upload path itself is unit-tested against an injected environment, so it is
covered without live credentials — but it has not been exercised against a
real bucket, and that is the one part of this slice nobody has watched work.

### Stored images without a bucket

`mediaUrl()` serves from `R2_PUBLIC_BASE_URL` when it is set, and otherwise
from the site itself under `/media` — the same origin the CSP already allows,
on whatever port is running. A lab that has not set up object storage yet
still has pictures, and production behaviour is unchanged once the variable
is set. Files under `public/media` are a stopgap for exactly that window;
member photos belong in the bucket once the upload manager exists.

Still to build here: admin control of the project stage from the workspace
rather than only the Projects manager.

## 10a. Portal and admin routes still to build

### Admin routes (Milestone 5)

Built: `/admin`, `/admin/members`, `/admin/settings`, `/admin/audit`, `/admin/news`, `/admin/events`, `/admin/opportunities`, `/admin/resources`, `/admin/partners`, `/admin/projects`, `/admin/research`, `/admin/proposals`, `/admin/applications`, and the sign-in, reset, and invitation routes (slices 1–6). Still to build:

- `/admin/insights`
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
- Slice B (account protection): new passwords found in the Have I Been Pwned corpus are refused at invitation acceptance and reset (k-anonymity lookup; allowed with a logged warning if the service is down). Sign-ins, failed attempts, rate-limit lockouts, reset requests, and password changes are written to the audit log with the device and network only (`lib/security-events.ts`); the dashboard's recent activity leaves them out. Account holders are emailed about five failed attempts in 15 minutes (at most hourly), sign-ins from a new device or network, password changes, and role changes; the Owner is emailed when someone else grants administrator access.
- Slice C (sessions and re-authentication): `/portal/security` changes the password (current password required; other sessions end), lists every session with device, network, and activity, signs out one or all other sessions, and shows the last twelve account events. Ownership transfer and member removal ask for the administrator's password; failures are rate-limited and logged as `auth.reauth_failed`. Two fixture accounts (`fixture-sessions`, `fixture-password`) exist so these tests never sign other tests out.
- Slice D (two-factor authentication): Better Auth's `twoFactor` plugin with authenticator-app codes and ten encrypted backup codes (migration `20260918225344_two_factor`, edited so it does not drop the hand-made search indexes). Every staff role must enrol: administration redirects to `/portal/security?setup=two-factor`, and `authorize` refuses admin actions without it. Sign-in continues at `/portal/two-factor`; each code works once (used codes are remembered for 90 seconds), a challenge allows five tries, and ten failures lock two-factor sign-in for 15 minutes. Turning it off over HTTP is disabled; members may turn it off in the portal, staff cannot. Administrators can reset a lost device from the member page (password and name required, audited, emailed). The QR code is drawn server-side as an SVG path (`uqr`, no dependencies). A Playwright `setup` project enrols the staff fixture accounts through the real screen each run and stores their keys in `.playwright/` (git-ignored); `tests/e2e/support/auth.ts` completes the code step for them.
- Slice E (passkeys): `@better-auth/passkey` with discoverable credentials and required user verification (the `afterVerification` hooks refuse unverified registrations and sign-ins; `lib/passkey-policy.ts`). Every passkey HTTP endpoint is in `disabledPaths`; the portal's server actions call the API directly, so adding a passkey first confirms the password. "Sign in with a passkey" appears only where the browser supports WebAuthn and loads `@simplewebauthn/browser` on click. Production pins the RP ID and origin to `BETTER_AUTH_URL`; WebAuthn rejects IP addresses, so the passkey end-to-end test runs on `localhost` with Chrome's virtual authenticator. Migration `20260918232727_passkeys` (again without dropping the search indexes).
- Beyond the checklist: a quadratic-backtracking email pattern that ran before sign-in's rate limit was replaced with a linear, length-capped check (`lib/email-address.ts`); auth emails go out after the response so timing never reveals whether an address has an account; administration needs a sign-in from the last 12 hours (`STAFF_SESSION_MAX_AGE_MS`); `Origin-Agent-Cluster`, `X-Permitted-Cross-Domain-Policies`, and `Cross-Origin-Resource-Policy` (portal, admin, API) headers; CSP violations are reported to `/api/csp-report` and logged briefly. Owner steps for hosting accounts, DNS, and email authentication are in `docs/security/operations.md` section 12.

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
- **Search (done).** `lib/search.ts` reads the `tsvector` columns the database
  maintains by trigger and indexes with GIN, instead of `ILIKE '%term%'` across
  five tables. It runs in two steps on purpose: the index says what matches and
  how well, and Prisma then reads those rows through the same `publicXWhere`
  clauses as every other public query, so the visibility rules stay in one
  place. Expressing them in SQL would be faster again and would put a second
  copy of them somewhere they could drift.

  Two things the change had to keep. A search box is used while somebody is
  still typing, so the last word carries `:*` — full-text search matches whole
  lexemes, and without the prefix "neur" would find nothing. And every token is
  reduced to letters, digits and **marks**: in Bengali the virama and vowel
  signs are combining marks, so without `\p{M}` the lab's own name, সন্ধি, was
  torn into fragments.

  The vectors already cover more than the old query did — news bodies, a
  project's research question, short venue names — so the change finds more,
  not less.

- **Server-side caching (done for the pages that do not watch the clock).**
  `lib/cache.ts` wraps a read so it is computed once and shared, tagged with
  the same `cacheTags` every administrative mutation already expired — there
  were 39 `invalidate()` calls and nothing caching, so the expensive half was
  built and the cheap half missing. Cached now: home, projects, people,
  publications, insights, partners, resources and legal settings. A five
  minute `revalidate` is only a backstop, so a tag somebody forgets to expire
  costs minutes rather than lasting until the next deploy.

  **A cached read may not return a `Date`.** `unstable_cache` stores JSON, so
  a `Date` put in comes back a string: the first request after a fill looks
  perfect and every one after it throws on `.toISOString()`. That shipped
  once and returned 500s on `/insights`, `/publications` and `/news` — hidden
  because the fixture database has no published insights, publications or
  news, so the date code never ran and every page answered 200 over an empty
  list. `CacheSafe` in `lib/cache.ts` now makes it a compile error, each of
  the three modules converts to ISO on the way in and back on the way out,
  and `tests/e2e/cached-dates.spec.ts` creates dated rows of each kind and
  reads every page three times, checking as well that the rows really render
  — a test on empty lists is how this got through the first time.

  Both halves are proved rather than assumed. A probe showed three requests
  producing one database read; and `admin-resources-partners.spec.ts` reads
  the public index *before* publishing a resource, so the entry is warm and a
  stale one would still be serving the old list afterwards.

  **`isPublishedAndDue` is not the post-cache filter for news.** It refuses
  anything not `PUBLISHED`, while `publicNewsWhere` treats a `SCHEDULED` post
  as public once its time passes — scheduling needs no job to flip the state.
  Using it would have made every scheduled post vanish from the home page the
  moment it became due. `isNewsPublic` sits beside `publicNewsWhere` so the
  two are read and changed together. (`isPublishedAndDue` is used nowhere in
  production code; the disagreement was latent.)

  The home page caches everything clock-free and decides what is due per
  request, so a scheduled post appears when it is due rather than when the
  cache next happens to be filled.

  Still per-request on purpose: `/news`, `/events` and `/opportunities`. They
  depend on the clock in more tangled ways than home, and they are better
  left honest and slow than fast and subtly wrong. The cache-then-filter
  pattern is established for when they are done.

- **Server-side caching (original note):** every public page renders per request and queries the database. The specification's nonce-based CSP requires dynamic rendering, which rules out ISR/CDN page caching. The compatible design is data-level caching (`unstable_cache` with tags): cache published records, apply time rules (`publishAt`, deadlines, event end) after the cache so visibility guarantees stay exact, and have Milestone 5 admin mutations revalidate the tags.
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
