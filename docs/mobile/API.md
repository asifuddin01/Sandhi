# The SANDHI API (`/api/v1`)

One backend serves the website and the app. There is no second database, no
second authentication system and no second copy of the permission rules: every
route here reads through the same modules the pages read through, so a record
that is not public on the website is not public here either.

- **Visibility:** `lib/visibility.ts` decides what is public. Every public route
  goes through a `lib/public-*.ts` read model that applies it.
- **Permissions:** `lib/permissions.ts` and `lib/authz.ts` decide who may do
  what. `lib/api/handler.ts` calls the same `authorize()` the admin server
  actions call, including the two-factor requirement and the twelve-hour staff
  session limit.
- **Ownership:** member-scoped reads go through `lib/portal-content.ts`, which
  keys every query on the viewer's own member id.

## Versioning

The path carries the major version. `meta.apiVersion` repeats it in every
response. A new field is added without a version change; a field is never
removed or given a new meaning inside a version.

## Envelope

Success (HTTP 200):

```json
{ "data": {}, "meta": { "apiVersion": 1 } }
```

Failure:

```json
{
  "error": { "code": "not_found", "message": "Not found." },
  "meta": { "apiVersion": 1 }
}
```

`error.code` is stable and safe to branch on. `error.message` is written for a
person and may change. Some refusals add `error.details`.

| Code                  | Status | What it means                                                                                  |
| --------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `bad_request`         | 400    | The request was understood and is wrong.                                                       |
| `unauthenticated`     | 401    | No session, or the token no longer works. Sign in again.                                       |
| `forbidden`           | 403    | Signed in, but not allowed.                                                                    |
| `not_found`           | 404    | No such record, or it is not public.                                                           |
| `upgrade_required`    | 426    | This app version is older than the deployment supports. `details` carries the current release. |
| `client_required`     | 428    | The `X-Sandhi-Client` header is missing.                                                       |
| `rate_limited`        | 429    | Too many attempts. `Retry-After` says how long.                                                |
| `service_unavailable` | 503    | A service the request needed is down.                                                          |
| `server_error`        | 500    | Something unexpected. Nothing internal is disclosed.                                           |

## The client header

Every request should send, and every mutation must send:

```
X-Sandhi-Client: sandhi-mobile/1.4.0 (android; build=42)
```

This is not decoration. The API answers no CORS preflight, so a browser on
another site cannot attach a custom header to a cross-site request: requiring
the header is what stops another site posting to the API with a visitor's
cookies. It also carries the version used for the update prompt.

Reads accept the header's absence, so the website's own code and ordinary
tooling can call them.

## Authentication

Native clients hold no cookie jar, so they authenticate with a bearer token.
It is the same Better Auth session the website uses: the same expiry, the same
revocation, the same suspended-member block, the same audit trail. Signing out
in the app ends that session and no other.

### Sign in

`POST /api/v1/auth/sign-in` with `{ "email", "password" }`.

Without two-factor authentication:

```json
{
  "data": { "status": "signed-in", "token": "…", "expiresAt": "2026-09-26T…Z" }
}
```

With two-factor authentication (required for staff):

```json
{ "data": { "status": "two-factor", "challenge": "…" } }
```

The challenge is opaque, expires in ten minutes, and is only good for finishing
this sign-in.

### Finish two-factor

`POST /api/v1/auth/two-factor` with `{ "challenge", "code" }`, and
`"method": "backup"` for a backup code. It answers with the same `signed-in`
shape.

### Use the session

```
Authorization: Bearer <token>
```

Store the token in the platform keychain (Expo SecureStore, Android Keystore,
iOS Keychain) — never in `AsyncStorage`.

### The rest

- `GET /api/v1/auth/session` — whether the token still works, and who it is.
- `POST /api/v1/auth/sign-out` — end this session.
- `POST /api/v1/auth/password-reset` with `{ "email" }` — sends the same link
  the website sends. The link opens in a browser: resets stay one web flow, so
  there is one place where a new password is checked against the breach list.

Accepting an invitation, adding a passkey, and changing a password also stay on
the website. Open them in the system browser rather than an in-app web view.

Sign-in, the second factor and reset share the website's limiter: ten attempts
per fifteen minutes, per address and per network.

## Who am I

`GET /api/v1/me` returns the viewer, the member record, and `capabilities` —
every capability the role holds. Use it to lay out navigation. It is advisory:
every route authorizes again on the server, so hiding a button is never the
control.

## Public reads

No authentication. Cached for sixty seconds.

| Path                                   | Answers                                                 |
| -------------------------------------- | ------------------------------------------------------- |
| `GET /api/v1/home`                     | Everything the home screen shows                        |
| `GET /api/v1/research`                 | Themes and their areas                                  |
| `GET /api/v1/research/themes/{slug}`   | One theme                                               |
| `GET /api/v1/research/areas/{slug}`    | One area                                                |
| `GET /api/v1/projects`                 | `?status=&theme=&area=&researcher=`                     |
| `GET /api/v1/projects/{slug}`          | One project                                             |
| `GET /api/v1/publications`             | `?q=&year=&type=&theme=&area=&researcher=&venue=&sort=` |
| `GET /api/v1/publications/{slug}`      | One publication                                         |
| `GET /api/v1/people`                   | `?area=`                                                |
| `GET /api/v1/people/{slug}`            | One person                                              |
| `GET /api/v1/news`                     | `?category=`                                            |
| `GET /api/v1/news/{slug}`              | One post                                                |
| `GET /api/v1/events`                   | Upcoming and past                                       |
| `GET /api/v1/events/{slug}`            | One event                                               |
| `GET /api/v1/insights`                 | `?kind=`                                                |
| `GET /api/v1/insights/{slug}`          | One insight                                             |
| `GET /api/v1/resources`, `/{slug}`     | Resources                                               |
| `GET /api/v1/opportunities`, `/{slug}` | Open opportunities                                      |
| `GET /api/v1/partners`                 | Partners                                                |
| `GET /api/v1/search?q=`                | Two characters or more; sixty a minute                  |
| `GET /api/v1/graph`                    | The research connections map                            |
| `GET /api/v1/settings`                 | Contacts, links, which sections exist, any notice       |
| `GET /api/v1/app/release`              | The current build per platform, and the minimum         |

Sections switched off in administration answer 404 here as well as on the
website. Markdown bodies come back as Markdown; render them with the same
restrictions the website applies — no raw HTML.

## Member reads

Bearer token required.

| Path                           | Answers                                           |
| ------------------------------ | ------------------------------------------------- |
| `GET /api/v1/me`               | Viewer, member, capabilities                      |
| `GET /api/v1/me/profile`       | The viewer's own lab profile                      |
| `GET /api/v1/me/projects`      | Projects the viewer is on, drafts included        |
| `GET /api/v1/me/announcements` | `?limit=`, with a `read` flag and an unread count |
| `GET /api/v1/me/documents`     | `?project=`, on the viewer's own projects only    |

Private documents come back as links that expire in ten minutes. The storage
key is never sent.

These answers are `private, no-store`. Do not cache them to disk.

## Writing

The API is read-only today, apart from the authentication routes. Editing a
profile, drafting an insight, and moving a task arrive with the member portal
(M6) as one set of server-side actions the website and the app both call, so
neither can drift from the other. Anything that writes will require the client
header and will be audited exactly as an administrative change is.

## What the API is not

- **No CORS.** Native clients are not subject to it. A browser client on
  another origin is not supported; put a same-origin proxy in front instead.
- **No second permission model.** If a capability does not exist on the
  website, it does not exist here.
- **No public write surface.** Contact, Join and event registration keep their
  existing routes, with Turnstile.
