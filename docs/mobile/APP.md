# The SANDHI app

A React Native app for Android and iOS that members install alongside the
website. It is a client, not a second system: same backend, same database, same
accounts, same permissions. Everything it can read is described in
[API.md](./API.md).

This document covers what the website already provides for it, and what
building and distributing the app requires.

## What the website provides today

| Piece                                        | Where                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| Versioned JSON API                           | `app/api/v1/**`, on `lib/api/*`                                           |
| Bearer-token sessions                        | `bearer()` in `lib/auth.ts`, `lib/api/mobile-auth.ts`                     |
| Member-scoped reads with ownership checks    | `lib/portal-content.ts`                                                   |
| Release metadata, editable in administration | `lib/mobile-app.ts`, `/admin/settings`                                    |
| Public download page                         | `/app`, and `/download/android`                                           |
| Update check                                 | `GET /api/v1/app/release`, plus the 426 refusal                           |
| Verified deep links                          | `/.well-known/assetlinks.json`, `/.well-known/apple-app-site-association` |

## Suggested shape

Expo (managed workflow, prebuild for the native projects), TypeScript, React
Query for the reads, `expo-secure-store` for the token.

```
sandhi-app/
  api/client.ts      one fetch wrapper: base URL, client header, bearer, envelope
  api/session.ts     sign in, second factor, sign out, token storage
  api/hooks.ts       one hook per endpoint
  screens/           public browsing, then the member area
```

One thing worth insisting on: put the envelope handling in a single place. Every
response is `{ data }` or `{ error }`, so one wrapper can turn a 401 into "sign
in again", a 426 into the update screen and a 429 into a wait, and no screen has
to think about it.

```ts
const APP = "sandhi-mobile";

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${BASE_URL}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Sandhi-Client": `${APP}/${version} (${Platform.OS}; build=${build})`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new ApiError(body.error, response.status);
  return body.data as T;
}
```

### Sign-in

1. `POST /auth/sign-in`.
2. `status: "signed-in"` — store `token` in SecureStore.
3. `status: "two-factor"` — hold the `challenge` in memory only, ask for the
   code, then `POST /auth/two-factor`. Staff accounts always take this path.
4. On any later 401, clear the token and return to sign-in.

Never store the password. Never store the challenge on disk.

### What stays in the browser

Accepting an invitation, resetting a password, adding a passkey, and applying to
join. Open them with `expo-web-browser`, not an in-app web view: a web view
cannot use the platform password manager, and it makes a credential prompt
indistinguishable from a phishing one.

## Android: the signed APK

The lab distributes the APK from its own site, without the Play Store.

### Building

```bash
eas build --platform android --profile production
# or, locally, after `expo prebuild`:
cd android && ./gradlew assembleRelease
```

Sign every build with **the same** upload key. Android refuses to install an
update signed with a different key, and the fingerprint in `assetlinks.json`
has to match. Keep the keystore and its passwords in the lab's password
manager, never in the repository.

### Publishing a build

1. Upload the APK to object storage (the public R2 bucket) at a versioned path,
   for example `app/sandhi-1.4.0.apk`. Serve it over https.
2. Take its checksum: `shasum -a 256 sandhi-1.4.0.apk`.
3. In `/admin/settings` → **SANDHI app**, fill in the version, version code,
   address, size in bytes, checksum, minimum Android version and notes, then
   tick **Publish the app page**.
4. `/app` now offers the build and `/download/android` redirects to it, so a
   link shared with a member keeps working across releases.

The checksum is published so a member can verify the download before installing
it. That matters more here than in a store: the browser will warn about
installing from an unknown source, and the checksum is what turns that warning
into a decision the member can actually make.

### App Links

Set on the deployment:

```
ANDROID_APP_ID=org.sandhiresearch.app
ANDROID_APP_FINGERPRINTS=AA:BB:…:FF     # SHA-256 of the signing certificate
```

`/.well-known/assetlinks.json` is then served automatically, and a SANDHI link
opens in the app. Several fingerprints can be listed, separated by commas —
needed while a signing key is being rotated. Get the fingerprint with:

```bash
keytool -list -v -keystore upload.keystore -alias upload | grep "SHA256:"
```

## iOS: private distribution

Apple has no equivalent of a downloadable APK; sideloading is not a supported
path. Pick whichever of these fits the lab:

| Method                                 | Good for                                                  | Needs                                                         |
| -------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| **TestFlight**                         | Up to 10,000 invited testers, builds expire after 90 days | Apple Developer Program, $99/year                             |
| **Apple Business Manager**, custom app | Permanent, no expiry, distributed to an organisation      | Developer Program plus a D-U-N-S-registered organisation      |
| **Apple Developer Enterprise Program** | In-house, unlimited                                       | Strict eligibility; Apple rarely approves small organisations |
| **App Store**                          | Anyone                                                    | Review                                                        |

TestFlight is the realistic starting point. Its ninety-day expiry is the cost:
plan on a build roughly every quarter whether or not anything changed.

Record the choice in `/admin/settings` → **SANDHI app** → iOS: the version, the
distribution, and the invitation link. `/app` then explains the right steps for
that method.

### Universal Links

```
IOS_APP_ID=ABCDE12345.org.sandhiresearch.app    # team id, then bundle id
```

`/.well-known/apple-app-site-association` is then served as JSON, with
`/portal`, `/admin`, `/api` and `/join` excluded so account and upload flows stay
in the browser. Apple fetches the file without following redirects, so it must
be served directly from the apex domain.

## Update checks

On launch, `GET /api/v1/app/release`. If the installed build is behind, offer
the update. If the deployment has set a minimum version, every API call from an
older build is refused with 426 and the release details, so the app can show the
update screen without a separate check.

Raise the minimum only for a change that actually breaks older builds — it locks
out everyone who has not updated.

## Security expectations

- The token is a session. Keep it in the keychain, send it only to the SANDHI
  origin, and clear it on sign-out and on any 401.
- Pin nothing to a capability the client computed. `capabilities` from
  `/api/v1/me` is for layout; the server decides.
- Do not cache member answers to disk. They are served `private, no-store`.
- Document links expire in ten minutes. Fetch them when needed rather than
  storing them.
- Ship no secrets in the bundle. Anything in an app binary is public.

## What is not built yet

Writing. Editing a profile, drafting an insight, moving a task and marking an
announcement read arrive with the member portal (M6), as server-side actions the
website and the app both call. Push notifications, offline caching and native
passkeys are untouched; none of them change the architecture here.
