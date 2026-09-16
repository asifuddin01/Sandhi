# SANDHI Research Lab — Complete Build Specification for Codex

**Project:** sandhiresearch.org
**Document type:** Final build prompt and specification
**Audience:** Codex (autonomous coding agent)
**Status:** Final (v1.0)

---

## Part 0. Instructions to Codex (read first)

You are building the complete web platform for **SANDHI Research Lab**, an independent AI research organization. The platform has three layers: a public website, a private member portal, and an admin portal. Read this entire document before writing any code.

### 0.1 Working rules

1. Read the whole specification. Then create `PLAN.md` at the repository root that restates the milestones in Part 12 as a checklist. Update it as you complete work.
2. Build milestone by milestone, in order. Do not begin a milestone until the previous one passes its acceptance criteria (Part 13).
3. After each milestone, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e`. Fix all failures before continuing.
4. **Never invent content.** Do not fabricate people, publications, venues, metrics, partners, logos, testimonials, awards, or statistics. Where real content is required and not supplied in this document, render a designed empty state (Part 6.4) and leave the field editable from the admin portal.
5. **Never hardcode counts.** Every number shown publicly is computed from the database at request time (with caching).
6. No lorem ipsum anywhere. All copy you need is written in Part 5. If a string is missing, write it in the voice described in Part 5.1 and add it to `content/strings.ts`.
7. Unpublished research is private. A project's results, figures, or metrics must never render publicly unless the project's `resultsPublic` flag is `true`.
8. Keep dependencies minimal and justified. If you add a library not listed in Part 2, note the reason in `PLAN.md`.
9. Write clean, typed, documented code. Prefer server components; use client components only where interaction or animation requires them.
10. Accessibility and reduced-motion support are requirements, not enhancements.

---

## Part 1. The Organization

### 1.1 Identity

| Field | Value |
|---|---|
| Name | SANDHI Research Lab |
| Short name | SANDHI |
| Domain | sandhiresearch.org |
| Type | Independent research organization |
| Founded | 2026 |
| Devanagari | सन्धि |
| Transliteration (IAST) | sandhi |
| Meaning | joining, connection, union, junction |
| Philosophy | Connect. Investigate. Understand. Contribute. |
| Tagline | Where ideas meet, discovery begins. |

### 1.2 What SANDHI does

SANDHI is a multidisciplinary research team working at the intersection of artificial intelligence, machine learning, and computational science. The primary output is **research and peer-reviewed publication**. Secondary outputs are datasets, benchmarks, open-source code, models, and technical reports.

### 1.3 Research areas (initial)

The areas are grouped into five **themes**. Themes are a philosophical organizing layer; areas are the concrete research fields. Both are database records, so new ones can be added later without code changes.

| Theme | Gloss | Areas |
|---|---|---|
| Perception | How machines see | Computer Vision |
| Language | How machines read, reason, and speak | Language Models & NLP |
| Junction | Where modalities meet | Vision-Language Models; Multimodal AI |
| Understanding | What is learned, and why it holds | Representation Learning; Causal Inference |
| Discovery | Computation in service of science | AI for Science; Computational Biology |

The theme named **Junction** is the literal meaning of *sandhi* and should be treated as the conceptual center of the research map.

### 1.4 Area descriptions (seed content)

- **Computer Vision** — Visual understanding, image analysis, medical imaging, segmentation, recognition, and generation.
- **Vision-Language Models** — Models that ground language in images and images in language.
- **Multimodal AI** — Systems that connect visual, textual, and other modalities, with a focus on multimodal understanding and reasoning.
- **Language Models & NLP** — Language understanding, generation, retrieval, reasoning, and knowledge-intensive systems.
- **Representation Learning** — Deep learning, generative models, evaluation, and new learning methods; the study of what models learn internally.
- **Causal Inference** — Relationships, interventions, and mechanisms beyond correlation.
- **AI for Science** — Computational intelligence applied to problems in biology, medicine, and other scientific disciplines.
- **Computational Biology** — Machine learning and computational approaches for biological and biomedical research.

---

## Part 2. Technology Stack (final)

Use the latest stable version of each package at build time.

### 2.1 Core

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router), React Server Components |
| Language | TypeScript, `strict: true` |
| Package manager | pnpm |
| Styling | Tailwind CSS v4 with CSS custom-property design tokens |
| UI primitives | Radix UI primitives (via shadcn/ui source, fully restyled to this spec) |
| Motion (UI) | Motion (`motion/react`) |
| Hero and graph rendering | `@react-three/fiber` + `@react-three/drei` (lazy-loaded); `d3-force` for the connections map |
| Database | PostgreSQL (Neon in production) |
| ORM | Prisma |
| Authentication | Better Auth (email + password, email verification, password reset, invitation-only sign-up, admin plugin) |
| Validation | Zod |
| Forms | React Hook Form + Zod resolver |
| Email | Resend + React Email |
| File storage | Cloudflare R2 (S3-compatible API) for CVs, PDFs, images |
| Markdown rendering | `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` + `rehype-pretty-code` (Shiki) |
| Search | PostgreSQL full-text search (`tsvector` columns with GIN indexes) |
| Anti-spam | Cloudflare Turnstile on all public forms |
| Rate limiting | Upstash Ratelimit (Redis) on forms and auth routes |
| Analytics | Plausible (privacy-respecting, no cookie banner needed) |
| OG images | `next/og` (dynamic per page) |
| Testing | Vitest (unit), Playwright (e2e), `@axe-core/playwright` (accessibility) |
| Lint/format | ESLint + Prettier |
| Deployment | Vercel |

### 2.2 External integrations

1. **Crossref API** — import publication metadata from a DOI in the admin portal.
2. **arXiv API** — import preprint metadata from an arXiv ID.
3. **ORCID public API** — optional: fetch works for a member profile (admin-triggered, never automatic publication).

---

## Part 3. Design System

### 3.1 Design concept: "The Junction"

The visual identity comes from the meaning of the name. In Sanskrit grammar, *sandhi* is the set of rules by which sounds change where two words meet: at the boundary, neither word stays exactly as it was, and together they read as one. The website expresses this idea in three ways:

1. **Threads.** Fine luminous lines are the core motif. They represent disciplines, ideas, and people. Where they meet, something new appears.
2. **Junctions.** Points where threads converge are marked with a small, softly glowing node. Junctions mark real relationships in the data (a person on a project, a project producing a paper).
3. **Quiet depth.** The atmosphere is nocturnal, contemplative, and scholarly: a night sky over a manuscript. Nothing is loud. Light is used the way a lamp is used in a dark study.

The tone is **deep and philosophical but never mystical or ornamental**. It is a serious scientific organization with a reflective soul.

### 3.2 Color tokens

No saturated or neon colors. No gradients used as decoration. The dark theme is the default; a light theme is available via a toggle and respects `prefers-color-scheme` on first visit.

**Dark theme (default): "Lapis Night"**

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#141A2E` | Page background (deep lapis, clearly blue, not grey-black) |
| `--ink-raised` | `#1B2340` | Raised surfaces, panels |
| `--ink-line` | `#2C3657` | Hairlines, borders, inactive threads |
| `--moonstone` | `#D9DEE8` | Primary text |
| `--mist` | `#8C95AB` | Secondary text, metadata |
| `--lamplight` | `#C9A55C` | The single accent: junction nodes, focus rings, primary buttons. Use sparingly. |
| `--lotus` | `#9C8FB8` | Secondary accent: links, active threads, graph edges |
| `--signal-ok` | `#7FA88F` | Success states only |
| `--signal-warn` | `#C98A6B` | Error and warning states only |

**Light theme: "Morning Fog"**

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#E9ECF1` | Page background (cool, not cream) |
| `--ink-raised` | `#F5F7FA` | Raised surfaces |
| `--ink-line` | `#C7CEDB` | Hairlines |
| `--moonstone` | `#1A2138` | Primary text |
| `--mist` | `#56607A` | Secondary text |
| `--lamplight` | `#8A6A2B` | Accent |
| `--lotus` | `#5E5282` | Links, threads |

**Rules**

1. All text/background pairs must meet WCAG 2.2 AA contrast. Verify with a script in `scripts/check-contrast.ts`.
2. `--lamplight` may occupy at most roughly 3% of any viewport. It marks meaning (a junction, a primary action, focus), never decoration.
3. Status colors are used only for status. Project statuses use shape and label, not color alone.

### 3.3 Typography

| Role | Typeface | Notes |
|---|---|---|
| Display and long-form reading | **Spectral** (Google Fonts) | Weights 300, 400, 500; italics for epigraphs and quotations only |
| Interface, navigation, metadata | **Hanken Grotesk** (Google Fonts) | Weights 400, 500, 600 |
| Devanagari | **Tiro Devanagari Sanskrit** (Google Fonts) | Used only for सन्धि and any Sanskrit terms |
| Code, BibTeX, math-adjacent | **IBM Plex Mono** | Only inside code blocks and BibTeX panels |

Load with `next/font`, subset, `display: swap`.

**Type scale** (perfect fourth, 1.333, base 18px for reading surfaces, 16px for interface):

| Step | Size | Use |
|---|---|---|
| `display` | clamp(3rem, 7vw, 5.6rem) | Hero title only |
| `h1` | clamp(2.2rem, 4.5vw, 3.2rem) | Page titles |
| `h2` | 1.95rem | Section titles |
| `h3` | 1.45rem | Sub-sections, card titles |
| `body-lg` | 1.25rem | Lead paragraphs |
| `body` | 1.125rem | Reading text |
| `ui` | 1rem | Interface |
| `meta` | 0.875rem | Metadata |

**Typographic rules**

1. Reading measure: 60–72 characters. Serif body line-height 1.65; sans UI line-height 1.45.
2. Sentence case everywhere. **No all-caps labels. No tracked-out eyebrow labels above headings.**
3. Do not emphasize a single word in a headline with a different color, weight, or italic.
4. Metadata is written as natural text or separated into distinct elements, not joined with middle dots.
5. Links and buttons do not append arrows.
6. Headlines are set in Spectral 300 at large sizes; the lightness of the weight is part of the calm character.
7. Mathematical notation renders with KaTeX in research notes and publication abstracts.

### 3.4 Layout

1. **Grid:** 12 columns, max content width 1280px; reading column max 720px.
2. **Alignment:** Left-aligned throughout. Only the hero and the closing call to action are centered.
3. **The margin thread:** On desktop, a single 1px vertical thread runs along the left margin of long pages. As the reader scrolls, the thread draws downward (scroll-linked). At each major section it passes through a small junction node, and the section's title aligns to that node. This replaces generic per-section entrance animations and gives every page a quiet spine.
4. **Surfaces:** Avoid a grid of identical rounded cards with drop shadows. Use:
   - Lists with generous spacing and hairline separators for publications and news.
   - Larger, asymmetric "entries" for featured projects (title, gloss, and a small thread diagram showing its areas and people).
   - Border radius: 2px for inputs and buttons, 0 for layout panels, full circle only for junction nodes and avatars.
   - No drop shadows. Depth is expressed by `--ink-raised` and hairlines.
5. **Numbered markers** are used only where the content is a real sequence: the four-step philosophy, the research process, timelines, and publication workflow.
6. **Imagery:** Member portraits are rendered in a consistent treatment (desaturated to 20%, subtle lapis duotone in dark mode). No stock photography anywhere.

### 3.5 Motion system

**Tokens**

| Token | Value |
|---|---|
| `--ease-sandhi` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--ease-thread` | `cubic-bezier(0.65, 0, 0.35, 1)` |
| `--dur-quick` | 160ms |
| `--dur-base` | 320ms |
| `--dur-slow` | 640ms |
| `--dur-ceremony` | 1600ms |

**Principles**

1. **One ceremony per page.** Each page has at most one orchestrated, non-user-triggered motion moment. On the home page it is the hero. On other pages it is the margin thread drawing in.
2. **Motion answers action.** Hover, focus, open, expand, filter, and submit get motion that shows what changed.
3. **Motion carries meaning.** When a user hovers a project, thin threads briefly draw to its linked areas and people. When filters change on Publications, entries reflow with layout animation rather than blinking.
4. **No generic fade-and-slide-up on every section.** Do not add scroll-reveal animations to every block.
5. **Reduced motion:** When `prefers-reduced-motion: reduce` is set, disable the WebGL hero (render the static SVG poster), disable scroll-linked drawing (render threads fully drawn), and replace all transitions with instant or opacity-only changes under 120ms. Also provide a "Reduce motion" toggle in the footer that persists in `localStorage`.
6. **Performance:** Animate only `transform` and `opacity` in the DOM. Pause WebGL when the tab is hidden or the hero is off-screen (`IntersectionObserver`). Cap device pixel ratio at 1.75.
7. **Page transitions:** Use the View Transitions API where supported: a 320ms cross-fade, with the page title as a shared element when navigating from a list to a detail page. Fall back to no transition.

### 3.6 Signature element 1: The Sandhi Field (home hero)

A full-viewport WebGL scene, lazy-loaded after first paint, with a static SVG poster rendered on the server so the page is complete without JavaScript.

**Sequence (total about 4 seconds, plays once per session):**

1. **Two streams (0–1.2s).** Two sparse streams of fine luminous particles enter from the left and right edges, colored `--lotus` at low opacity. They represent two separate disciplines.
2. **Convergence (1.2–2.4s).** The streams curve toward a point slightly right of center and begin to interweave. Where particles pass near each other, faint line segments appear between them (a proximity graph), forming a loose lattice.
3. **Junction (2.4–3.2s).** At the point of convergence, a single node brightens in `--lamplight`. For a moment, the lattice resolves into the outline of the glyph सन्धि, drawn as thread.
4. **Settling (3.2–4.0s).** The glyph dissolves back into a slow, drifting constellation that breathes indefinitely at very low motion. The title and tagline fade in over the left side.

**Interaction:** The constellation bends gently away from the pointer (radius about 140px). On touch devices, a tap sends a slow ripple through the lattice. No other interaction.

**Implementation notes:**
- Use instanced points and a line-segments buffer updated with a spatial hash; keep under 1,500 particles on desktop, 600 on mobile.
- The glyph outline is sampled from an SVG path of सन्धि set in Tiro Devanagari Sanskrit (pre-computed at build time into a JSON point set in `public/field/sandhi-points.json`).
- Must hold 60fps on a mid-range laptop and must not block interaction. Target main-thread cost under 4ms per frame.
- On repeat visits in the same session, skip to the settled state.

### 3.7 Signature element 2: The Map of Connections (Research page)

An interactive force-directed graph showing how the lab's knowledge connects: **themes → areas → projects → people → publications**.

1. Nodes are small circles; edge color `--ink-line`, highlighted edges `--lotus`, focused node `--lamplight`.
2. Hovering or focusing a node draws its edges and dims unrelated nodes to 20% opacity.
3. Clicking a node opens a side panel with a short description and a link to its page.
4. Filter chips by theme.
5. Data comes from a server route (`/api/graph`) that returns only published entities.
6. **Accessibility:** Provide a "View as list" toggle that shows the same relationships as a nested, keyboard-navigable list. The graph itself has `role="img"` with a generated text summary; the list is the accessible equivalent.
7. When there are fewer than 8 published entities, show the themes and areas only, with a note: "Projects and papers will appear here as they are published."

### 3.8 Supporting motifs

- **Junction node:** A 6px circle with a soft 12px glow in `--lamplight`. Used as bullet for the philosophy steps, as timeline markers, and in the margin thread.
- **Thread divider:** Instead of flat horizontal rules between major sections, use a 1px line that curves slightly and passes through a junction node.
- **Epigraphs:** Short, set in Spectral italic, `--mist` color, used at most once per page.
- **Favicon and logo:** A wordmark "SANDHI" in Spectral 400 with generous letter-spacing only in the logo itself, paired with a mark made of two curved threads meeting at a single node. Provide SVG for the mark, the wordmark, and the lockup, in both themes. Generate `favicon.svg`, `apple-touch-icon.png`, and a maskable PWA icon from the mark.

---

## Part 4. Information Architecture

### 4.1 Public routes

| Route | Page |
|---|---|
| `/` | Home |
| `/about` | About |
| `/research` | Research overview and Map of Connections |
| `/research/[theme]` | Theme page |
| `/research/areas/[area]` | Research area page |
| `/projects` | Projects index |
| `/projects/[slug]` | Project page |
| `/publications` | Publications database |
| `/publications/[slug]` | Publication page |
| `/people` | People directory |
| `/people/[slug]` | Researcher profile |
| `/news` | News index |
| `/news/[slug]` | News article |
| `/events` | Events |
| `/events/[slug]` | Event page |
| `/opportunities` | Open positions and collaborations |
| `/opportunities/[slug]` | Opportunity page |
| `/join` | Join SANDHI (application flow) |
| `/resources` | Datasets, benchmarks, code, models, tools |
| `/resources/[slug]` | Resource page |
| `/insights` | Research notes |
| `/insights/[slug]` | Research note |
| `/open-science` | Open science commitments |
| `/partners` | Partners |
| `/contact` | Contact |
| `/privacy` | Privacy policy |
| `/terms` | Terms of use |
| `/feed.xml` | RSS feed (news and insights) |
| `/sitemap.xml`, `/robots.txt` | Generated |

### 4.2 Portal routes (authenticated members)

| Route | Page |
|---|---|
| `/portal/sign-in` | Sign in |
| `/portal/accept-invite/[token]` | Accept invitation and set password |
| `/portal/reset-password` | Password reset |
| `/portal` | Dashboard |
| `/portal/profile` | Edit profile |
| `/portal/projects` | My projects |
| `/portal/projects/[slug]` | Project workspace |
| `/portal/publications` | My publications |
| `/portal/publications/new` | Add publication |
| `/portal/publications/[id]` | Edit publication |
| `/portal/tasks` | Tasks |
| `/portal/meetings` | Meetings and notes |
| `/portal/announcements` | Announcements |
| `/portal/workspace` | Research workspace (experiments, logs, documents) |
| `/portal/insights` | Draft and submit research notes |

### 4.3 Admin routes

| Route | Page |
|---|---|
| `/admin` | Admin dashboard |
| `/admin/members` | Members, invitations, roles |
| `/admin/research` | Themes and areas |
| `/admin/projects` | Projects |
| `/admin/publications` | Publications and review queue |
| `/admin/news` | News posts |
| `/admin/events` | Events |
| `/admin/opportunities` | Opportunities |
| `/admin/applications` | Applications pipeline |
| `/admin/resources` | Resources |
| `/admin/insights` | Research notes review |
| `/admin/partners` | Partners |
| `/admin/approvals` | Pending profile change requests |
| `/admin/settings` | Site settings (contact emails, social links, location, feature flags) |
| `/admin/audit` | Audit log |

### 4.4 Navigation

**Primary navigation (desktop):**

```text
[mark] SANDHI      Research   Projects   Publications   People   News   About   More ▾      [Join SANDHI]
```

**More menu:**

```text
Events
Opportunities
Resources
Insights
Open science
Partners
Contact
```

**Utility (right of header, small):** theme toggle, search (⌘K / Ctrl K command palette across projects, publications, people, news, insights).

**Mobile:** A full-screen menu that opens with the threads motif drawing across the panel (300ms), listing all items in a single column, with Join SANDHI at the bottom.

**Footer:**

```text
SANDHI Research Lab
Where ideas meet, discovery begins.

Research            Organization         Connect
Research areas      About                Contact
Projects            People               Join SANDHI
Publications        News                 Opportunities
Resources           Events               RSS
Insights            Partners             GitHub  /  LinkedIn  /  X
Open science

सन्धि  — joining, connection, junction.

© 2026 SANDHI Research Lab    Privacy    Terms    Member sign in    Reduce motion [toggle]
```

Social links render only when set in admin settings.

---

## Part 5. Page Specifications and Final Copy

### 5.1 Voice

Calm, precise, and reflective. Plain verbs. Sentence case. No hype words (revolutionary, cutting-edge, world-class, unleash, empower). Claims are modest and specific. Philosophy is expressed through a few well-chosen sentences, not through ornament.

### 5.2 Home (`/`)

**Section A: Hero (The Sandhi Field, Part 3.6)**

- Title: **SANDHI Research Lab**
- Tagline: **Where ideas meet, discovery begins.**
- Lead: "An independent research lab exploring artificial intelligence and computational science. We investigate difficult problems across vision, language, multimodal AI, and AI for science."
- Primary button: **Explore our research** (`/research`)
- Secondary button: **Join SANDHI** (`/join`)
- A small line beneath, in Devanagari and transliteration: "सन्धि  ·  sandhi: the place where two things join." (This is the one permitted use of a middle dot, because it separates two scripts.)

**Section B: The idea**

Heading: **At the boundary, both sides change.**

Body:
> In Sanskrit grammar, *sandhi* describes what happens where two words meet. Sounds shift, merge, and settle into something that reads as one. We think research works the same way. The most useful ideas rarely come from a single field. They form at the junctions, where methods, disciplines, and people meet and are changed by the meeting.

Link: **Read about SANDHI** (`/about`)

**Section C: Philosophy (a real sequence, numbered)**

Four steps set along a horizontal thread with junction nodes (vertical on mobile). As each step enters view, its node lights; this is the page's only scroll-linked effect besides the margin thread.

1. **Connect** — We bring together ideas, methods, and people from different fields.
2. **Investigate** — We pursue questions where existing methods fall short.
3. **Understand** — We test rigorously, so that results explain rather than merely impress.
4. **Contribute** — We publish, release code and data, and add knowledge others can build on.

**Section D: Research themes**

Heading: **What we study**

Five themes as a row of labeled threads (Perception, Language, Junction, Understanding, Discovery), each listing its areas beneath in plain text. Hovering a theme brightens its thread and shows its gloss. Link: **See the map of connections** (`/research`).

**Section E: Featured projects**

Heading: **Current work**

Up to 3 projects where `featured = true` and `state = PUBLISHED`. Layout: one large entry and two smaller ones, asymmetric. Each shows title, one-sentence gloss, areas, researchers, and status. Empty state (Part 6.4) if none.

**Section F: Latest publications**

Heading: **Recent publications**

The 5 most recent public publications as a list: title, authors (SANDHI members linked), venue and year, and links (Paper, Code, Dataset, Project) shown only when present. Link: **All publications**.

**Section G: News**

Heading: **From the lab**

Latest 3 news posts as a list with date and category.

**Section H: The lab in numbers (conditional)**

Render only when **every** metric is at least 1 **and** there are at least 3 published publications. Metrics: researchers (active members), projects (public), publications (public), research areas. Values come from the database. Numbers are typeset in Spectral 300 at `h1` size with plain labels beneath; no counters that spin up.

**Section I: Closing call**

Centered.

- Heading: **Research with us.**
- Body: "We look for people who want to investigate difficult problems carefully and contribute knowledge that lasts."
- Button: **Join SANDHI**

### 5.3 About (`/about`)

1. **Title:** About SANDHI
2. **Lead:** "SANDHI Research Lab is an independent research organization advancing artificial intelligence and computational methods through interdisciplinary research."
3. **The name** (with the glyph सन्धि set large in Tiro Devanagari Sanskrit, drawn in as a thread on load — this is the page's ceremony):
   > *Sandhi* (सन्धि) is a Sanskrit word meaning joining, connection, union, or junction. It names our core belief: meaningful discoveries often emerge where different ideas, disciplines, and perspectives meet.
4. **Epigraph:** *"Truth is one; the wise speak of it in many ways."* — Ṛgveda 1.164.46
5. **Mission:**
   > To investigate meaningful questions in artificial intelligence and computational science, develop new methods, and contribute rigorous, reproducible knowledge to the research community.
6. **Vision:**
   > A research community where fields do not work in isolation, and where the connections between vision, language, learning, and science lead to understanding that none of them could reach alone.
7. **What defines us:**
   > We do not want to be defined by a particular model, architecture, or technology. We want to be defined by the questions we pursue and the knowledge we contribute.
8. **How we work (a real sequence, numbered):**
   1. Identify meaningful and challenging research questions.
   2. Study existing knowledge and find the gaps.
   3. Develop new models, methods, algorithms, and systems.
   4. Experiment systematically across datasets, models, and settings.
   5. Evaluate rigorously through reproducible experiments and meaningful benchmarks.
   6. Collaborate across research areas and with researchers beyond SANDHI.
   7. Publish through papers, technical reports, datasets, benchmarks, and open-source tools.
   8. Contribute knowledge that the wider community can build on.
9. **Values** (not numbered; set as a two-column list of term and one-line explanation):
   - Curiosity — We follow questions, not trends.
   - Rigor — We distrust results we cannot explain.
   - Openness — We share methods, code, and data wherever we can.
   - Reproducibility — Every claim should be checkable by someone else.
   - Collaboration — We think better together, across fields.
   - Contribution — We measure our work by what it adds.
10. **Timeline** (database-driven `Milestone` records; seed only "2026: SANDHI Research Lab founded").
11. **Leadership** (members with rank `DIRECTOR` or `RESEARCH_LEAD`; empty state if none published).

### 5.4 Research (`/research`)

1. **Title:** Research
2. **Lead:** "Our work is organized around five themes. Each theme gathers research areas that share a central question."
3. **Map of Connections** (Part 3.7) — the page's ceremony is the graph settling into place.
4. **Themes list:** each theme with gloss, its areas, and counts of public projects and publications (hidden when zero).

**Theme page (`/research/[theme]`):** theme name, gloss, a longer overview (Markdown), its areas, and projects/publications across those areas.

**Area page (`/research/areas/[area]`):**

1. Overview (Markdown)
2. Open questions (a list the admin edits)
3. Current projects
4. Publications
5. Researchers working in this area
6. Resources (datasets, code)
7. Related areas (drawn as a small thread diagram)

### 5.5 Projects (`/projects`)

1. **Title:** Projects
2. **Lead:** "Research programs at SANDHI, from early proposals to published work."
3. **Filters:** status, theme, area, researcher. Filters are URL search params so views are shareable.
4. **Entry layout:** title, gloss, areas, researchers (avatars + names), status (label plus shape icon), start year.
5. **Statuses:** Proposed, Active, Completed, Submitted, Published, Archived. Archived projects are hidden unless the status filter includes them.

**Project page (`/projects/[slug]`):**

| Block | Rule |
|---|---|
| Title, gloss, status, timeline | Always |
| Abstract | Always |
| Research question | Always |
| Motivation | If present |
| Approach / method | If present |
| Experiments | If present and `resultsPublic` |
| Results and figures | Only if `resultsPublic` |
| Researchers (with project roles) | Always |
| Publications | If any public |
| Code, dataset, demo links | If present |
| Related projects | If any |
| Areas | Always, as threads to area pages |

A small "connections" diagram at the top shows this project as a junction linking its areas and researchers.

### 5.6 Publications (`/publications`)

1. **Title:** Publications
2. **Search:** full-text across title, abstract, authors, venue.
3. **Filters:** year, type, theme, area, researcher, venue.
4. **Sort:** newest (default), title.
5. **Grouping:** by year, with the year as a junction on the margin thread.
6. **Entry:** title, author list (member names linked, `*` for equal contribution, `†` for corresponding author with a legend), venue and year, type, and link buttons (Paper, arXiv, Code, Dataset, Project, BibTeX). Only show links that exist.
7. **BibTeX:** clicking opens an inline panel with generated BibTeX (or the stored override) and a copy button that confirms "Copied".
8. **Export:** "Export BibTeX" for the current filtered set.
9. **Types:** Conference paper, Journal article, Workshop paper, Preprint, Technical report, Dataset, Benchmark, Thesis.
10. **Public visibility:** only `stage` in `ACCEPTED` or `PUBLISHED`, or `type = PREPRINT` with an arXiv ID, and `state = PUBLISHED`.

**Publication page:** title, authors with affiliations, venue, year, abstract (KaTeX-enabled), links, BibTeX, linked project, linked resources, related publications. Include Google Scholar meta tags (`citation_title`, `citation_author` in order, `citation_publication_date`, `citation_conference_title` or `citation_journal_title`, `citation_pdf_url`, `citation_doi`, `citation_arxiv_id`) and `ScholarlyArticle` JSON-LD.

### 5.7 People (`/people`)

1. **Title:** People
2. **Lead:** "The researchers of SANDHI."
3. **Groups (in order):** Leadership (Directors, Research Leads), Researchers, Research Assistants, Interns, Collaborators, Alumni.
4. Each person: portrait (consistent treatment), name, rank, three research interests.
5. Filter by area.

**Profile page (`/people/[slug]`):** name, rank, portrait, bio, research interests (linked to areas when they match), projects (auto-linked through `ProjectMember`), publications (auto-linked through `PublicationAuthor`), research notes, links (Google Scholar, ORCID, GitHub, LinkedIn, personal site), and organization email if the member opts in. `Person` JSON-LD with `affiliation` = SANDHI Research Lab.

A member's projects and publications must appear automatically once linked; there is no manual duplication.

### 5.8 News (`/news`)

Categories: Research, Publications, Events, Team, Announcements, Opportunities. List with date, category, title, excerpt. Article page: title, date, author (member link), category, optional cover image, Markdown body, related project or publication. Scheduled publishing supported (`publishAt`).

### 5.9 Events (`/events`)

Upcoming and past, separated. Kinds: Seminar, Workshop, Talk, Reading group, Conference, Internal (internal never public). Event page: title, speaker(s), abstract, date and time with time zone (display in the viewer's local time with the original zone noted), location or "Online", registration link or built-in registration form, recording and slides links after the event. Provide an `.ics` download.

### 5.10 Opportunities (`/opportunities`)

1. **Lead:** "Openings for researchers, interns, and collaborators."
2. **Sections:** Research positions, Internships, Collaborations, Project-specific openings.
3. **Opportunity page:** role, area(s), description, responsibilities, requirements, duration, location or remote, deadline (with "Closes in N days" computed), and **Apply** (routes to `/join?opportunity=slug` with the type preselected).
4. Closed opportunities disappear from the list automatically after the deadline.
5. Empty state: "There are no open positions right now. You can still introduce yourself through Join SANDHI."

### 5.11 Join SANDHI (`/join`)

A three-step form (a real sequence, so the progress indicator is numbered and drawn as a thread with three nodes).

**Step 1: Interest.** Heading: "What would you like to do?" Options (large selectable rows, not cards):
- Join as a researcher
- Research internship
- Research collaboration
- Propose a project
- Academic collaboration
- Industry collaboration

**Step 2: About you.** Fields: full name*, email*, institution or organization*, current role*, research interests* (multi-select from areas plus free text), Google Scholar, ORCID, GitHub, LinkedIn, personal website, CV (PDF, max 5 MB)*, opportunity (if arriving from one).

**Step 3: Your motivation.** "Why SANDHI?"* (150–1500 characters), relevant experience (optional), research proposal (required only for "Propose a project" and collaboration types: title, summary, and optional PDF), availability (hours per week), consent checkbox* ("I agree that SANDHI may store and review this application.").

**Behavior:**
1. Client and server validation with Zod.
2. Turnstile and rate limiting.
3. CV uploaded to R2 via a pre-signed URL; only the key is stored.
4. On submit, the applicant receives a confirmation email, and admins receive a notification.
5. Success state: "Application received. We read every application and will reply by email." with the thread completing its third node.
6. Progress is saved in `sessionStorage` so a refresh does not lose it (except the file).

### 5.12 Resources (`/resources`)

Kinds: Datasets, Benchmarks, Code, Models, Tools, Tutorials, Technical reports. Each resource page: name, kind, description, license, version, links (download, repository, documentation, Hugging Face), citation (BibTeX), linked publication and project, changelog. Empty state: "Datasets, code, and models will be released here alongside our publications."

### 5.13 Insights (`/insights`)

1. **Title:** Insights
2. **Lead:** "Not every useful result is a paper. Research notes, explanations, and reproducibility reports from the lab."
3. **Kinds:** Technical note, Explainer, Tutorial, Benchmark analysis, Experimental finding, Reproducibility report, Literature review.
4. Long-form reading layout: 720px column, Spectral body, KaTeX math, syntax-highlighted code, footnotes (GFM), figure captions, a table of contents in the margin on desktop, estimated reading time, author(s), and "Cite this note" BibTeX.
5. Written by members in the portal; published after admin review.

### 5.14 Open Science (`/open-science`)

Title: **Open science**. Sections with body copy:

1. **Code** — "We release the code behind our published work, with instructions to reproduce the main results."
2. **Data** — "Where licensing and privacy allow, we release datasets and document how they were collected and processed."
3. **Models** — "We release trained models when doing so is safe and useful, with clear documentation of their limits."
4. **Reproducibility** — "We report seeds, splits, hardware, and hyperparameters, and we publish reproducibility reports on our own work."
5. **Evaluation** — "We compare against strong baselines on identical splits and report where our methods fail."
6. **Medical and biological data** — "We follow the data use agreements of every dataset we use and never release data we are not permitted to share."

### 5.15 Partners (`/partners`)

Kinds: Universities, Research labs, Companies, Open-source organizations, Funders. Each: logo (monochrome treatment, color on hover), name, description, link, relationship. Empty state: "We welcome collaboration with universities, labs, and organizations. Get in touch through Join SANDHI." (Do not display any partner not entered by an admin.)

### 5.16 Contact (`/contact`)

```text
SANDHI Research Lab

General          contact@sandhiresearch.org
Research         research@sandhiresearch.org
Collaborations   collaborate@sandhiresearch.org
Applications     join@sandhiresearch.org
```

All addresses and the optional location are editable in admin settings. A general inquiry form (name, email, topic, message; Turnstile; rate limited) sends to the address matching the topic.

### 5.17 Not found and error pages

- **404:** Heading "No junction here." Body: "This path does not connect to anything yet." Buttons: Go home, Search. Background: two threads that approach each other and stop just short of meeting.
- **500:** Heading "Something broke on our side." Body: "The error has been logged. Try again in a moment." Button: Try again.

### 5.18 Legal pages

Privacy policy and terms of use in plain language, covering: what applications store (and for how long, default 24 months, configurable), analytics (Plausible, no cookies), file storage, account data for members, and a contact for data deletion requests. Mark both pages in admin as requiring review before launch.

---

## Part 6. Shared Components and States

### 6.1 Core components

`SiteHeader`, `MoreMenu`, `MobileMenu`, `SiteFooter`, `ThemeToggle`, `ReduceMotionToggle`, `CommandPalette`, `MarginThread`, `ThreadDivider`, `JunctionNode`, `SandhiField` (WebGL hero) with `SandhiFieldPoster` (SVG), `ConnectionsMap` with `ConnectionsList`, `ConnectionsMini` (small entity diagram), `ProjectEntry`, `PublicationEntry`, `BibtexPanel`, `PersonEntry`, `NewsEntry`, `EventEntry`, `OpportunityEntry`, `ResourceEntry`, `StatusLabel`, `FilterBar` (URL-synced), `EmptyState`, `Prose` (Markdown renderer), `Epigraph`, `SequenceSteps`, `Timeline`, `FormStepper`, `FileDropzone`, `Toast`.

### 6.2 Buttons

- **Primary:** `--lamplight` 1px border, transparent fill, `--moonstone` text; on hover the fill rises from the bottom to 12% lamplight (base duration). On press, a junction node pulses once at the pointer location.
- **Secondary:** text-only with a 1px underline that draws left to right on hover.
- Button labels state the action exactly ("Submit application", "Copy BibTeX", "Publish post").

### 6.3 Focus

A 2px `--lamplight` outline offset by 3px, always visible on keyboard focus.

### 6.4 Empty states

Every list has a designed empty state: a single thread ending in an unlit node, one sentence of direction, and, where relevant, a link. Examples:

| Where | Copy |
|---|---|
| Projects | "Our first projects will be published here soon." |
| Publications | "Our first papers are in progress." |
| People | "Team profiles are being prepared." |
| News | "News from the lab will appear here." |
| Events | "No events are scheduled. Seminars will be announced here." |

### 6.5 Loading states

Skeletons are hairline outlines matching the final layout, with a slow 1.6s opacity shimmer (disabled under reduced motion). No spinners except inside buttons during submission.

---

## Part 7. Data Model

Implement with Prisma. Better Auth generates its own `user`, `session`, `account`, and `verification` tables through its CLI; extend its user with a `role` field and link it one-to-one with `Member`. You may refine field names, but keep every relation.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---------- Enums ----------

enum SystemRole       { OWNER ADMIN EDITOR MEMBER }
enum MemberRank       { DIRECTOR RESEARCH_LEAD RESEARCHER RESEARCH_ASSISTANT INTERN COLLABORATOR }
enum MemberStatus     { INVITED ACTIVE ALUMNI SUSPENDED }
enum PublishState     { DRAFT IN_REVIEW SCHEDULED PUBLISHED ARCHIVED }
enum ProjectStatus    { PROPOSED ACTIVE COMPLETED SUBMITTED PUBLISHED ARCHIVED }
enum PublicationType  { CONFERENCE JOURNAL WORKSHOP PREPRINT TECHNICAL_REPORT DATASET BENCHMARK THESIS }
enum PublicationStage { DRAFT INTERNAL_REVIEW SUBMITTED ACCEPTED PUBLISHED }
enum ResourceKind     { DATASET BENCHMARK CODE MODEL TOOL TUTORIAL REPORT }
enum NewsCategory     { RESEARCH PUBLICATIONS EVENTS TEAM ANNOUNCEMENTS OPPORTUNITIES }
enum EventKind        { SEMINAR WORKSHOP TALK READING_GROUP CONFERENCE INTERNAL }
enum InsightKind      { TECHNICAL_NOTE EXPLAINER TUTORIAL BENCHMARK_ANALYSIS FINDING REPRODUCIBILITY LITERATURE_REVIEW }
enum OpportunityKind  { RESEARCH_POSITION INTERNSHIP COLLABORATION PROJECT_OPENING }
enum ApplicationType  { RESEARCHER INTERNSHIP COLLABORATION PROJECT_PROPOSAL ACADEMIC_COLLABORATION INDUSTRY_COLLABORATION }
enum ApplicationStatus { NEW IN_REVIEW SHORTLISTED INTERVIEW ACCEPTED REJECTED INVITED WITHDRAWN }
enum PartnerKind      { UNIVERSITY LAB COMPANY OPEN_SOURCE FUNDER }
enum TaskStatus       { TODO IN_PROGRESS BLOCKED DONE }
enum Priority         { LOW MEDIUM HIGH URGENT }
enum ChangeStatus     { PENDING APPROVED REJECTED }

// ---------- People ----------

model Member {
  id            String       @id @default(cuid())
  userId        String?      @unique            // Better Auth user id
  slug          String       @unique
  name          String
  rank          MemberRank
  status        MemberStatus @default(INVITED)
  title         String?                         // free-text display title
  bio           String?                         // Markdown
  photoKey      String?
  interests     String[]
  orgEmail      String?      @unique
  showOrgEmail  Boolean      @default(false)
  scholarUrl    String?
  orcid         String?
  githubUrl     String?
  linkedinUrl   String?
  websiteUrl    String?
  sortOrder     Int          @default(0)
  isPublic      Boolean      @default(false)
  joinedAt      DateTime?
  leftAt        DateTime?
  areas         MemberArea[]
  projects      ProjectMember[]
  authorships   PublicationAuthor[]
  newsPosts     NewsPost[]
  insights      InsightAuthor[]
  tasks         Task[]       @relation("TaskAssignee")
  changeRequests ChangeRequest[]
  experiments   Experiment[]
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

// ---------- Research structure ----------

model ResearchTheme {
  id        String         @id @default(cuid())
  slug      String         @unique
  name      String
  gloss     String
  overview  String?
  sortOrder Int            @default(0)
  areas     ResearchArea[]
}

model ResearchArea {
  id          String        @id @default(cuid())
  slug        String        @unique
  name        String
  summary     String
  overview    String?
  questions   String[]
  sortOrder   Int           @default(0)
  state       PublishState  @default(PUBLISHED)
  themeId     String
  theme       ResearchTheme @relation(fields: [themeId], references: [id])
  projects    ProjectArea[]
  publications PublicationArea[]
  members     MemberArea[]
  resources   ResourceArea[]
}

model MemberArea {
  memberId String
  areaId   String
  member   Member       @relation(fields: [memberId], references: [id], onDelete: Cascade)
  area     ResearchArea @relation(fields: [areaId], references: [id], onDelete: Cascade)
  @@id([memberId, areaId])
}

// ---------- Projects ----------

model Project {
  id            String         @id @default(cuid())
  slug          String         @unique
  title         String
  gloss         String
  abstract      String
  question      String
  motivation    String?
  approach      String?
  experiments   String?
  results       String?
  resultsPublic Boolean        @default(false)
  status        ProjectStatus  @default(PROPOSED)
  state         PublishState   @default(DRAFT)
  featured      Boolean        @default(false)
  coverKey      String?
  codeUrl       String?
  datasetUrl    String?
  demoUrl       String?
  startedAt     DateTime?
  endedAt       DateTime?
  areas         ProjectArea[]
  members       ProjectMember[]
  publications  Publication[]
  resources     Resource[]
  relatedFrom   ProjectRelation[] @relation("from")
  relatedTo     ProjectRelation[] @relation("to")
  tasks         Task[]
  meetings      Meeting[]
  documents     Document[]
  experimentsLog Experiment[]
  newsPosts     NewsPost[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

model ProjectArea {
  projectId String
  areaId    String
  project   Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  area      ResearchArea @relation(fields: [areaId], references: [id], onDelete: Cascade)
  @@id([projectId, areaId])
}

model ProjectMember {
  projectId String
  memberId  String
  role      String            // e.g. "Lead", "Researcher", "Advisor"
  isLead    Boolean @default(false)
  sortOrder Int     @default(0)
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  member    Member  @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@id([projectId, memberId])
}

model ProjectRelation {
  fromId String
  toId   String
  from   Project @relation("from", fields: [fromId], references: [id], onDelete: Cascade)
  to     Project @relation("to",   fields: [toId],   references: [id], onDelete: Cascade)
  @@id([fromId, toId])
}

// ---------- Publications ----------

model Publication {
  id            String            @id @default(cuid())
  slug          String            @unique
  title         String
  abstract      String
  type          PublicationType
  stage         PublicationStage  @default(DRAFT)
  state         PublishState      @default(DRAFT)
  venueName     String?
  venueShort    String?
  year          Int?
  publishedAt   DateTime?
  doi           String?           @unique
  arxivId       String?           @unique
  pdfUrl        String?
  manuscriptKey String?           // private upload
  codeUrl       String?
  datasetUrl    String?
  pageUrl       String?
  bibtexOverride String?
  award         String?
  featured      Boolean           @default(false)
  projectId     String?
  project       Project?          @relation(fields: [projectId], references: [id])
  authors       PublicationAuthor[]
  areas         PublicationArea[]
  resources     Resource[]
  reviews       PublicationReview[]
  newsPosts     NewsPost[]
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  // add a generated tsvector column + GIN index via a SQL migration
}

model PublicationAuthor {
  id                  String      @id @default(cuid())
  publicationId       String
  position            Int
  memberId            String?
  externalName        String?
  externalAffiliation String?
  equalContribution   Boolean     @default(false)
  corresponding       Boolean     @default(false)
  publication         Publication @relation(fields: [publicationId], references: [id], onDelete: Cascade)
  member              Member?     @relation(fields: [memberId], references: [id])
  @@unique([publicationId, position])
}

model PublicationArea {
  publicationId String
  areaId        String
  publication   Publication  @relation(fields: [publicationId], references: [id], onDelete: Cascade)
  area          ResearchArea @relation(fields: [areaId], references: [id], onDelete: Cascade)
  @@id([publicationId, areaId])
}

model PublicationReview {
  id            String      @id @default(cuid())
  publicationId String
  reviewerId    String      // Member id
  comment       String
  decision      ChangeStatus @default(PENDING)
  publication   Publication @relation(fields: [publicationId], references: [id], onDelete: Cascade)
  createdAt     DateTime    @default(now())
}

// ---------- Outputs and communication ----------

model Resource {
  id            String        @id @default(cuid())
  slug          String        @unique
  name          String
  kind          ResourceKind
  description   String
  license       String?
  version       String?
  downloadUrl   String?
  repoUrl       String?
  docsUrl       String?
  hfUrl         String?
  bibtex        String?
  changelog     String?
  state         PublishState  @default(DRAFT)
  projectId     String?
  publicationId String?
  project       Project?      @relation(fields: [projectId], references: [id])
  publication   Publication?  @relation(fields: [publicationId], references: [id])
  areas         ResourceArea[]
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}

model ResourceArea {
  resourceId String
  areaId     String
  resource   Resource     @relation(fields: [resourceId], references: [id], onDelete: Cascade)
  area       ResearchArea @relation(fields: [areaId], references: [id], onDelete: Cascade)
  @@id([resourceId, areaId])
}

model NewsPost {
  id            String       @id @default(cuid())
  slug          String       @unique
  title         String
  excerpt       String
  body          String
  category      NewsCategory
  coverKey      String?
  state         PublishState @default(DRAFT)
  publishAt     DateTime?
  authorId      String?
  author        Member?      @relation(fields: [authorId], references: [id])
  projectId     String?
  project       Project?     @relation(fields: [projectId], references: [id])
  publicationId String?
  publication   Publication? @relation(fields: [publicationId], references: [id])
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

model Insight {
  id          String          @id @default(cuid())
  slug        String          @unique
  title       String
  summary     String
  body        String
  kind        InsightKind
  state       PublishState    @default(DRAFT)
  publishedAt DateTime?
  authors     InsightAuthor[]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

model InsightAuthor {
  insightId String
  memberId  String
  position  Int
  insight   Insight @relation(fields: [insightId], references: [id], onDelete: Cascade)
  member    Member  @relation(fields: [memberId], references: [id], onDelete: Cascade)
  @@id([insightId, memberId])
}

model Event {
  id           String       @id @default(cuid())
  slug         String       @unique
  title        String
  kind         EventKind
  abstract     String
  speakers     String[]
  startsAt     DateTime
  endsAt       DateTime?
  timeZone     String       @default("Asia/Dhaka")
  location     String?
  isOnline     Boolean      @default(true)
  registerUrl  String?
  allowRegistration Boolean @default(false)
  recordingUrl String?
  slidesUrl    String?
  state        PublishState @default(DRAFT)
  registrations EventRegistration[]
  createdAt    DateTime     @default(now())
}

model EventRegistration {
  id        String   @id @default(cuid())
  eventId   String
  name      String
  email     String
  affiliation String?
  event     Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([eventId, email])
}

model Opportunity {
  id               String          @id @default(cuid())
  slug             String          @unique
  title            String
  kind             OpportunityKind
  areaSlugs        String[]
  description      String
  responsibilities String[]
  requirements     String[]
  duration         String?
  location         String?
  isRemote         Boolean         @default(true)
  deadline         DateTime?
  state            PublishState    @default(DRAFT)
  applications     Application[]
  createdAt        DateTime        @default(now())
}

model Application {
  id            String            @id @default(cuid())
  type          ApplicationType
  status        ApplicationStatus @default(NEW)
  name          String
  email         String
  institution   String
  currentRole   String
  interests     String[]
  scholarUrl    String?
  orcid         String?
  githubUrl     String?
  linkedinUrl   String?
  websiteUrl    String?
  cvKey         String
  motivation    String
  experience    String?
  proposalTitle String?
  proposalSummary String?
  proposalKey   String?
  hoursPerWeek  Int?
  consent       Boolean
  opportunityId String?
  opportunity   Opportunity?      @relation(fields: [opportunityId], references: [id])
  notes         ApplicationNote[]
  rating        Int?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
}

model ApplicationNote {
  id            String      @id @default(cuid())
  applicationId String
  authorId      String
  body          String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  createdAt     DateTime    @default(now())
}

model Partner {
  id           String       @id @default(cuid())
  name         String
  kind         PartnerKind
  description  String
  relationship String?
  url          String?
  logoKey      String?
  sortOrder    Int          @default(0)
  state        PublishState @default(DRAFT)
}

model Milestone {
  id        String   @id @default(cuid())
  date      DateTime
  title     String
  body      String?
  isPublic  Boolean  @default(true)
}

model ContactMessage {
  id        String   @id @default(cuid())
  name      String
  email     String
  topic     String
  message   String
  handled   Boolean  @default(false)
  createdAt DateTime @default(now())
}

// ---------- Portal ----------

model Task {
  id          String     @id @default(cuid())
  title       String
  description String?
  status      TaskStatus @default(TODO)
  priority    Priority   @default(MEDIUM)
  dueAt       DateTime?
  projectId   String?
  assigneeId  String?
  project     Project?   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignee    Member?    @relation("TaskAssignee", fields: [assigneeId], references: [id])
  createdById String
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

model Meeting {
  id        String    @id @default(cuid())
  title     String
  startsAt  DateTime
  endsAt    DateTime?
  link      String?
  agenda    String?
  notes     String?   // Markdown
  projectId String?
  project   Project?  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  attendeeIds String[]
  createdAt DateTime  @default(now())
}

model Announcement {
  id        String   @id @default(cuid())
  title     String
  body      String
  pinned    Boolean  @default(false)
  authorId  String
  createdAt DateTime @default(now())
  readBy    String[]
}

model Experiment {
  id          String   @id @default(cuid())
  projectId   String
  ownerId     String
  name        String
  hypothesis  String?
  config      Json?
  datasetRefs String[]
  modelInfo   String?
  results     Json?
  notes       String?
  milestone   String?
  trackingUrl String?  // W&B / MLflow link
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  owner       Member   @relation(fields: [ownerId], references: [id])
  logs        ExperimentLog[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ExperimentLog {
  id           String     @id @default(cuid())
  experimentId String
  body         String
  experiment   Experiment @relation(fields: [experimentId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())
}

model Document {
  id        String   @id @default(cuid())
  projectId String
  title     String
  fileKey   String?
  url       String?
  uploadedById String
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

model ChangeRequest {
  id        String       @id @default(cuid())
  memberId  String
  field     String
  oldValue  String?
  newValue  String
  status    ChangeStatus @default(PENDING)
  reviewerId String?
  member    Member       @relation(fields: [memberId], references: [id], onDelete: Cascade)
  createdAt DateTime     @default(now())
  decidedAt DateTime?
}

// ---------- System ----------

model SiteSetting {
  key   String @id
  value Json
}

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String
  action    String
  entity    String
  entityId  String
  diff      Json?
  createdAt DateTime @default(now())
}
```

### 7.1 Publishing logic

1. A public query always filters `state = PUBLISHED` and, where applicable, `publishAt <= now()`.
2. Put all public-visibility rules in one module, `lib/visibility.ts`, and use it everywhere (pages, sitemap, feeds, graph API, search, counts).
3. Use Next.js cache tags per entity type; revalidate tags on every admin mutation.

### 7.2 BibTeX generation

`lib/bibtex.ts` generates entries from `Publication` (key format `lastnameYEARfirstword`, e.g. `uddin2027hierarchical`), choosing `@inproceedings`, `@article`, `@misc` (preprint, with `eprint` and `archivePrefix`), or `@techreport`. Escape LaTeX special characters. Unit-test all types.

---

## Part 8. Roles and Permissions

| Capability | Owner | Admin | Editor | Member | Public |
|---|---|---|---|---|---|
| View public site | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sign in to portal | ✓ | ✓ | ✓ | ✓ | |
| Edit own profile (non-public fields) | ✓ | ✓ | ✓ | ✓ | |
| Edit own public profile fields | direct | direct | direct | via approval | |
| Add or edit own publications (draft) | ✓ | ✓ | ✓ | ✓ | |
| Submit publication for review | ✓ | ✓ | ✓ | ✓ | |
| Approve and publish publications | ✓ | ✓ | ✓ | | |
| Create or edit projects | ✓ | ✓ | ✓ | leads of that project (draft only) | |
| Manage news, events, resources, insights | ✓ | ✓ | ✓ | draft and submit insights only | |
| Manage opportunities and applications | ✓ | ✓ | | | |
| Invite, suspend, remove members; assign roles | ✓ | ✓ (not Owner) | | | |
| Site settings | ✓ | ✓ | | | |
| View audit log | ✓ | ✓ | | | |
| Transfer ownership | ✓ | | | | |

Rules:
1. Enforce permissions on the server in every action and route handler through `lib/authz.ts`. Never rely on hidden UI alone.
2. Every admin mutation writes an `AuditLog` entry.
3. Sign-up is invitation-only. The first `OWNER` is created by `pnpm seed:owner` from environment variables.
4. Protect `/portal` and `/admin` with middleware plus server-side checks.

---

## Part 9. Portal and Admin Specifications

### 9.1 Member portal

**Dashboard (`/portal`):** greeting ("Good evening, Asif" based on local time), counts (my active projects, my publications, my open tasks, upcoming meetings) computed from data, pinned announcements, recent activity across my projects, and deadlines in the next 14 days.

**Profile:** edit bio, interests, photo (crop to square, stored in R2), links, org email visibility. Public fields go to `ChangeRequest` for members; a banner shows "Your changes are waiting for approval."

**My projects:** list with role and status. **Project workspace** tabs: Overview, Tasks (kanban with drag and drop: To do, In progress, Blocked, Done), Experiments, Documents, Meetings, Publications.

**Publications:** add manually or import by DOI or arXiv ID; order authors by drag and drop; link authors to members or enter external authors; upload a private manuscript; set links; track the stage through the workflow shown as a numbered thread: **Draft → Internal review → Submitted → Accepted → Published**. Moving to "Internal review" notifies editors. Only editors can mark a publication public.

**Tasks:** personal view across projects; filter by project, status, priority, due date.

**Meetings:** calendar (month and agenda views), meeting notes in Markdown, `.ics` export per meeting.

**Announcements:** list with pinned first; unread indicator.

**Research workspace:** experiments per project (hypothesis, configuration JSON, datasets, model information, results JSON, notes, milestone, link to external tracking such as Weights & Biases or MLflow), an experiment log (timestamped entries), and a documents library.

**Insights:** write a research note with Markdown editor and live preview (KaTeX and code highlighting), submit for review.

### 9.2 Admin portal

**Dashboard:** members (active), projects (public / total), publications (public / total), pending items (applications new, change requests, publications in review, insights in review), and recent audit entries.

**Members:** invite by email (sends invitation with token, 7-day expiry), assign rank, system role, organization email, projects; suspend; mark as alumni; remove (with confirmation dialog that names the member).

**Content managers** (projects, publications, news, events, opportunities, resources, insights, partners, themes and areas): table views with search, filters, and bulk actions; editors with Markdown and live preview; slug auto-generation with uniqueness check; state control (Draft, In review, Scheduled, Published, Archived); preview of the public page before publishing.

**Applications pipeline:** columns by status (New, In review, Shortlisted, Interview, Accepted, Rejected); open an application to view details, download the CV via a short-lived signed URL, add private notes, rate (1–5), change status (with optional templated email to the applicant), and convert an accepted applicant into an invitation in one action.

**Approvals:** diff view of each change request with Approve and Reject.

**Settings:** contact addresses, social links, optional location, application retention period, feature flags (show events, show partners, show numbers section), and maintenance banner text.

---

## Part 10. SEO, Accessibility, Performance, Security

### 10.1 SEO

1. Per-page `generateMetadata` with titles in the form `Page title | SANDHI Research Lab`.
2. Dynamic Open Graph images via `next/og`: lapis background, a thread motif, the title in Spectral, and the SANDHI mark.
3. JSON-LD: `ResearchOrganization` (site-wide, with `name`, `url`, `logo`, `sameAs`, `foundingDate`), `ScholarlyArticle`, `Person`, `Event`, `Dataset`, `NewsArticle`, `BreadcrumbList`.
4. Google Scholar meta tags on publication pages (Part 5.6).
5. `sitemap.xml` and `robots.txt` generated from visibility rules; disallow `/portal` and `/admin`.
6. RSS feed at `/feed.xml`.
7. Canonical URLs on `https://sandhiresearch.org`.

### 10.2 Accessibility (WCAG 2.2 AA)

1. Semantic landmarks, one `h1` per page, logical heading order.
2. Skip link.
3. Full keyboard support, including the command palette, menus, filters, kanban (keyboard move), and the connections map (via the list view).
4. Visible focus (Part 6.3).
5. Alt text required for all uploaded images in admin (the form blocks saving without it).
6. Reduced-motion behavior (Part 3.5).
7. axe checks pass on every public route in Playwright.

### 10.3 Performance budgets

| Metric | Target |
|---|---|
| LCP (home, 4G mid-range mobile) | < 2.5s (the SVG poster is the LCP element, not WebGL) |
| CLS | < 0.05 |
| INP | < 200ms |
| Home initial JS (excluding lazy WebGL chunk) | < 150 KB gzipped |
| Lighthouse (performance, accessibility, best practices, SEO) | ≥ 95 on all public pages except home performance ≥ 90 |

Use `next/image` for all images, AVIF/WebP, and ISR or tag-based caching for public pages.

### 10.4 Security

1. Content Security Policy with nonces; `frame-ancestors 'none'`; HSTS; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy` minimal.
2. Sanitize all rendered Markdown (`rehype-sanitize` with an allowlist that keeps KaTeX output).
3. Uploads: validate MIME type and magic bytes server-side, size limits (CV 5 MB, images 4 MB, manuscripts 25 MB), private bucket, signed URLs with 10-minute expiry.
4. Rate limits: forms 5 per 10 minutes per IP; sign-in 10 per 15 minutes per IP and per email.
5. CSRF protection on server actions (built-in) and on route handlers.
6. Secrets only through environment variables; never exposed to the client.
7. Applications older than the retention period are deleted by a scheduled job (Vercel Cron) along with their files.

---

## Part 11. Project Structure and Environment

### 11.1 Repository layout

```text
sandhi/
├── app/
│   ├── (public)/
│   │   ├── page.tsx
│   │   ├── about/
│   │   ├── research/
│   │   ├── projects/
│   │   ├── publications/
│   │   ├── people/
│   │   ├── news/
│   │   ├── events/
│   │   ├── opportunities/
│   │   ├── join/
│   │   ├── resources/
│   │   ├── insights/
│   │   ├── open-science/
│   │   ├── partners/
│   │   ├── contact/
│   │   ├── privacy/
│   │   └── terms/
│   ├── portal/
│   ├── admin/
│   ├── api/
│   │   ├── auth/[...all]/
│   │   ├── graph/
│   │   ├── upload/
│   │   ├── search/
│   │   └── cron/
│   ├── feed.xml/
│   ├── sitemap.ts
│   ├── robots.ts
│   ├── not-found.tsx
│   ├── error.tsx
│   └── layout.tsx
├── components/
│   ├── brand/          (logo, mark, junction node)
│   ├── motion/         (margin thread, thread divider, sequence steps)
│   ├── field/          (SandhiField, poster)
│   ├── graph/          (ConnectionsMap, ConnectionsList, ConnectionsMini)
│   ├── entries/        (project, publication, person, news, event, resource)
│   ├── forms/
│   ├── portal/
│   ├── admin/
│   └── ui/             (restyled primitives)
├── content/
│   └── strings.ts      (all fixed copy from Part 5)
├── emails/             (React Email templates)
├── lib/
│   ├── auth.ts
│   ├── authz.ts
│   ├── db.ts
│   ├── visibility.ts
│   ├── bibtex.ts
│   ├── crossref.ts
│   ├── arxiv.ts
│   ├── storage.ts
│   ├── ratelimit.ts
│   ├── markdown.ts
│   ├── search.ts
│   └── audit.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
│   ├── brand/
│   └── field/sandhi-points.json
├── scripts/
│   ├── build-glyph-points.ts
│   └── check-contrast.ts
├── styles/
│   └── tokens.css
├── tests/
│   ├── unit/
│   └── e2e/
├── PLAN.md
├── README.md
└── .env.example
```

### 11.2 Environment variables (`.env.example`)

```bash
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://sandhiresearch.org
RESEND_API_KEY=
EMAIL_FROM="SANDHI Research Lab <no-reply@sandhiresearch.org>"
ADMIN_NOTIFY_EMAIL=join@sandhiresearch.org
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_PUBLIC=
R2_BUCKET_PRIVATE=
R2_PUBLIC_BASE_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=sandhiresearch.org
CRON_SECRET=
SEED_OWNER_NAME="Asif Uddin"
SEED_OWNER_EMAIL=
SEED_OWNER_PASSWORD=
```

### 11.3 Seed data

`prisma/seed.ts` seeds **only**:

1. The five research themes and eight research areas from Part 1.3 and 1.4 (state `PUBLISHED`).
2. The milestone "2026: SANDHI Research Lab founded".
3. Site settings with the contact addresses from Part 5.16.
4. The owner account and a linked `Member` record for the name in `SEED_OWNER_NAME` with rank `DIRECTOR`, `isPublic = false` (the owner completes and publishes the profile).

A separate `prisma/fixtures.ts` (run with `pnpm seed:fixtures`) creates clearly fictional development data (names such as "Fixture Researcher A", titles prefixed "[Fixture]") for local testing and e2e tests. The fixtures script must refuse to run when `NODE_ENV=production` or when `DATABASE_URL` points to the production host.

### 11.4 Scripts

```json
{
  "dev": "next dev",
  "build": "prisma generate && next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "db:migrate": "prisma migrate dev",
  "db:deploy": "prisma migrate deploy",
  "seed": "tsx prisma/seed.ts",
  "seed:owner": "tsx prisma/seed.ts --owner-only",
  "seed:fixtures": "tsx prisma/fixtures.ts",
  "glyph": "tsx scripts/build-glyph-points.ts",
  "contrast": "tsx scripts/check-contrast.ts"
}
```

---

## Part 12. Build Milestones

Complete these in order. Each ends with its acceptance criteria from Part 13.

### Milestone 1: Foundation

1. Initialize the Next.js project with TypeScript strict, pnpm, ESLint, Prettier, Vitest, Playwright.
2. Implement design tokens (`styles/tokens.css`), fonts, dark and light themes, theme toggle, reduce-motion toggle.
3. Build the brand assets (mark, wordmark, lockup, favicon set).
4. Build layout shell: header, More menu, mobile menu, footer, skip link, command palette shell.
5. Build motion primitives: `JunctionNode`, `ThreadDivider`, `MarginThread`, `SequenceSteps`.
6. Set up Prisma with the full schema, initial migration, search migration, and seed.
7. Implement `lib/visibility.ts`, `lib/bibtex.ts` (with tests), `lib/markdown.ts`.

### Milestone 2: Public website core

1. Home (all sections, with the SVG poster in place of the hero; WebGL comes in Milestone 3).
2. About, Research (themes and areas, list version of the map), Projects, Publications (search, filters, BibTeX, export), People, News, Contact.
3. Join SANDHI (full three-step flow with uploads, Turnstile, rate limit, emails).
4. Empty states, 404, 500, privacy, terms.
5. SEO: metadata, OG images, JSON-LD, Scholar tags, sitemap, robots, RSS.

### Milestone 3: Signature motion

1. `scripts/build-glyph-points.ts` and the Sandhi Field WebGL hero with full sequence, pointer interaction, visibility pausing, session skip, reduced-motion fallback.
2. Connections Map with graph API, filters, side panel, and list equivalent.
3. `ConnectionsMini` diagrams on project, area, and person pages.
4. Hover threads on project entries; layout animation on publication filters; View Transitions.
5. Performance pass to meet Part 10.3.

### Milestone 4: Remaining public pages

Events (with registration and `.ics`), Opportunities, Resources, Insights (long-form layout with table of contents and KaTeX), Open Science, Partners. Wire all into the command palette search.

### Milestone 5: Authentication and admin portal

1. Better Auth: invitation-only accounts, email verification, password reset, sessions, rate limits.
2. `lib/authz.ts` and middleware.
3. Admin dashboard and all managers from Part 9.2, including DOI/arXiv import, application pipeline, approvals, settings, audit log.
4. Cache-tag revalidation on every mutation.

### Milestone 6: Member portal

Dashboard, profile with change requests, my projects, project workspace with kanban, publications workflow with reviews, tasks, meetings with calendar and `.ics`, announcements, insights drafting.

### Milestone 7: Research workspace

Experiments, experiment logs, documents library, external tracking links, activity feed on the dashboard.

### Milestone 8: Hardening and launch readiness

Security headers and CSP, retention cron job, full axe and Lighthouse pass, e2e coverage of critical flows, `README.md` with setup, deployment to Vercel, DNS for `sandhiresearch.org` (apex plus `www` redirect to apex), and a `LAUNCH_CHECKLIST.md`.

---

## Part 13. Acceptance Criteria

### 13.1 Global (every milestone)

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` pass.
- [ ] No lorem ipsum, fake names, fake numbers, or fake partners in any non-fixture code path.
- [ ] Every public page works without JavaScript for reading content.
- [ ] Dark and light themes both pass the contrast script.
- [ ] Reduced motion disables all non-essential animation.

### 13.2 Milestone-specific checks

| Milestone | Must be true |
|---|---|
| 1 | Tokens drive all colors; no hex values in components. Margin thread draws on scroll and is fully drawn under reduced motion. BibTeX unit tests cover all publication types. |
| 2 | An unpublished project, publication, or member never appears on any public page, sitemap, feed, search, or count (e2e test with fixtures). Join flow submits, stores the CV privately, and sends both emails (mocked in tests). Numbers section stays hidden with fewer than 3 public publications. |
| 3 | Hero sequence plays once per session and holds 60fps on a mid-range laptop; LCP is the poster. Connections list exposes every relationship shown in the graph. |
| 4 | Past events show recordings when present; closed opportunities disappear after the deadline. Insights render math, code, and footnotes correctly. |
| 5 | A Member cannot reach any admin route or action (e2e test on server actions directly). Every admin mutation creates an audit entry. DOI import fills title, authors, venue, and year. |
| 6 | A member's public profile edit does not appear publicly until approved. A newly linked publication appears on the project page, publication list, and every linked member's profile without further action. |
| 7 | Experiment results are never exposed on any public route. |
| 8 | Lighthouse and axe targets from Part 10 met; CSP active without breaking KaTeX, WebGL, Turnstile, or Plausible. |

### 13.3 Design review checklist (self-critique before closing each milestone)

- [ ] Does any page look like a generic SaaS template (identical rounded cards with shadows, gradient washes, spinning counters)? If so, revise.
- [ ] Is `--lamplight` used only for junctions, primary actions, and focus?
- [ ] Is there at most one ceremonial motion moment per page?
- [ ] Are there any all-caps labels, eyebrow labels, arrows on links, or single-word headline accents? Remove them.
- [ ] Are numbered markers used only for real sequences?
- [ ] Does the page still feel calm and scholarly at mobile width?
- [ ] Remove one decorative element that does not carry meaning.

---

## Part 14. Out of Scope for Codex

These are handled by the SANDHI team, not in code:

1. Registering and configuring email mailboxes for the `@sandhiresearch.org` addresses (e.g. Google Workspace or Cloudflare Email Routing) and verifying the domain in Resend.
2. Writing member bios, project descriptions, and publication entries.
3. Legal review of the privacy policy and terms.
4. Choosing whether to publish a physical location.

---

**End of specification.** Begin by writing `PLAN.md`, then start Milestone 1.
