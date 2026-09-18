# SANDHI Research Lab build plan

This checklist follows the supplied build specification. Milestones are completed in order. Each milestone closes only after lint, type checking, unit tests, end-to-end tests, contrast checks, and its design review pass.

## Milestone 1 — Foundation

- [x] Initialize Next.js App Router with strict TypeScript, pnpm, ESLint, Prettier, Vitest, and Playwright.
- [x] Implement token-driven dark and light themes, fonts, theme preference, and persistent reduced motion.
- [x] Add the brand mark, wordmark, lockup, favicon, and application icons.
- [x] Build the public shell: skip link, header, More menu, mobile menu, footer, and command palette shell.
- [x] Build JunctionNode, ThreadDivider, MarginThread, and SequenceSteps.
- [x] Add the complete Prisma schema, initial migration, full-text-search migration, production-safe seed, and fixture seed.
- [x] Implement centralized visibility, BibTeX generation with all publication-type tests, and safe Markdown rendering.
- [x] Pass `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e`.
- [x] Confirm all component colors use tokens, reduced motion fully draws the margin thread, and both themes pass `pnpm contrast`.
- [x] Complete the milestone design self-review and remove one non-meaningful decorative element.

## Milestone 2 — Public website core

- [x] Build Home with its complete static poster and data-driven sections.
- [x] Build About, Research and area/theme pages, Projects, Publications, People, News, and Contact.
- [x] Build the three-step Join SANDHI flow with validation, private uploads, Turnstile, rate limiting, and two-email notification.
- [x] Add all required empty states, not-found and error pages, Privacy, and Terms.
- [x] Add page metadata, Open Graph output, JSON-LD, Scholar metadata, sitemap, robots, and RSS.
- [x] Prove centralized public visibility excludes unpublished records everywhere and protects private project results.
- [x] Prove the numbers section remains hidden until all specified thresholds are met.
- [x] Pass the four quality commands, contrast checks, accessibility checks, and milestone design review.
- [x] Remove the decorative route-level loading skeleton; retain only meaningful junction, focus, and action accents, with one ceremony at most per page.

## Milestone 3 — Signature motion

- [x] Build glyph points and the lazy Sandhi Field WebGL sequence with poster LCP, pointer/touch input, visibility pausing, session skip, and reduced-motion fallback.
- [x] Build the published-only graph API, force-directed Connections Map, theme filters, detail panel, summary, and complete accessible list equivalent.
- [x] Add ConnectionsMini to project, area, and person pages.
- [x] Add meaningful project hover threads, publication layout transitions, and supported View Transitions.
- [x] Meet the home JavaScript and runtime performance budgets.
- [x] Pass the four quality commands, contrast checks, accessibility checks, and milestone design review; remove redundant poster dots once the live constellation mounts.

## Milestone 4 — Remaining public pages

- [x] Build Events with registration, local/original time zones, recordings, slides, and ICS.
- [x] Build Opportunities with deadline visibility and Join preselection.
- [x] Build Resources and their linked output pages.
- [x] Build Insights with table of contents, KaTeX, code, footnotes, reading time, and citation.
- [x] Build Open science and Partners with their conditional states.
- [x] Include all public types in command-palette search.
- [x] Pass the four quality commands, contrast checks, accessibility checks, and milestone design review.
- [x] Verify every Milestone 4 visibility rule in the browser against an isolated fixture database, and fix the contrast, ARIA, undefined-token, and doubled-rule defects the review found.

## Milestone 5 — Authentication and admin portal

- [x] Configure Better Auth for invitations, verification, reset, sessions, and rate limits.
- [x] Enforce server authorization in `lib/authz.ts` and protected-route middleware (`proxy.ts`).
- [ ] Build the admin dashboard and every specified content, member, applications, approvals, settings, and audit manager.
- [ ] Add DOI and arXiv import, review workflows, previews, bulk actions, and mandatory image alt text.
- [ ] Write an audit record and revalidate cache tags on every admin mutation.
- [ ] Prove a Member cannot reach any admin page or mutation directly.
- [ ] Pass the four quality commands, contrast checks, accessibility checks, and milestone design review.

## Milestone 6 — Member portal

- [ ] Build the personal dashboard, announcements, deadlines, and activity views.
- [ ] Build profile editing with approval-gated public fields and private-field direct editing.
- [ ] Build My projects and the accessible project workspace/kanban.
- [ ] Build publication entry/import, authorship ordering, review stages, and notifications.
- [ ] Build personal tasks, meeting calendar and ICS, announcements, and Insights drafting.
- [ ] Prove profile approval gating and automatic publication propagation through relations.
- [ ] Pass the four quality commands, contrast checks, accessibility checks, and milestone design review.

## Milestone 7 — Research workspace

- [ ] Build experiments, structured configurations and results, logs, milestones, and external tracking links.
- [ ] Build the project documents library and research activity feed.
- [ ] Prove experiment data and results never appear on public routes.
- [ ] Pass the four quality commands, contrast checks, accessibility checks, and milestone design review.

## Milestone 8 — Hardening and launch readiness

- [ ] Add nonce-aware CSP and all required security headers without breaking approved integrations.
  - Progress (17 September 2026): per-request nonce CSP in `proxy.ts`, static security headers, same-origin checks on every public mutation, search rate limiting, and dependency overrides are implemented and verified against a production build (WebGL, KaTeX, code highlighting, forms). Still to do before checking: verify Turnstile with a live site key, add Plausible's origin when analytics is integrated.
- [ ] Add retention cleanup for application records and private files.
- [ ] Complete axe coverage for every public route and critical-flow end-to-end tests.
- [ ] Meet Lighthouse, LCP, CLS, INP, and JavaScript budgets.
- [ ] Document setup, development, testing, data operations, and Vercel deployment in `README.md`.
- [ ] Add `LAUNCH_CHECKLIST.md`, including legal review and the team-owned launch dependencies.
- [ ] Deploy to Vercel and configure `sandhiresearch.org` with `www` redirected to the apex when credentials and DNS authority are available.
- [ ] Pass the four quality commands, contrast checks, accessibility checks, security checks, and final design review.

## Dependency notes

- `server-only` is included to make accidental client imports of database and secret-bearing modules fail at build time, following the installed Next.js guidance.
- `katex`, `shiki`, and the Radix packages are direct runtime packages required by the specified Markdown and UI stacks.
- `@prisma/adapter-pg`, `pg`, and `dotenv` are required by the current stable Prisma PostgreSQL runtime and CLI configuration; `@types/pg` supplies strict types.
- `better-auth` and its Prisma adapter are installed in Milestone 1 so `seed:owner` writes a credential hash in the exact format the specified authentication system will verify in Milestone 5.
- `three`, `@react-three/fiber`, and `@react-three/drei` are the specification's Milestone 3 rendering stack. `d3-force` was removed in Milestone 4 when the connections map became a deterministic layered layout at the user's direction (strict layers cannot come from a force simulation); React and React DOM are pinned to 19.2.8 because the stable Fiber release does not yet support React 19.3.
- Prisma CLI is pinned to `7.10.0` to match the latest stable `@prisma/client`; the registry's current CLI `latest` tag resolves to an 8.0 release candidate rather than a stable release.
- ESLint remains on the newest v9 release because Next.js 16's bundled React, import, and accessibility plugins do not yet declare compatibility with ESLint 10.
