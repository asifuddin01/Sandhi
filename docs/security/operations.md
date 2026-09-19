# Security operations

The code enforces what it can. This page covers the rest: settings on the hosting services, secret rotation, backups, and what to do during an incident. Everything here is done by the site owner in each provider's dashboard.

## 1. Production environment variables

Set these in Vercel → Project → Settings → Environment Variables, scoped to **Production** only and marked **Sensitive**. Preview deployments get their own values (a separate Neon branch and separate keys), never production's.

| Variable                                             | Requirement                                                                                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BETTER_AUTH_SECRET`                                 | At least 32 random characters (`openssl rand -base64 32`). Production refuses to start signing people in with anything shorter. It also encrypts two-factor secrets; see section 7 before changing it. |
| `BETTER_AUTH_URL`                                    | `https://sandhiresearch.org`. Email links are built from this, never from the request's host.                                                                                                          |
| `DATABASE_URL`                                       | The least-privilege `sandhi_app` role (section 2), with `sslmode=require`. Production refuses a remote database without TLS.                                                                           |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Required: without them, sign-in and forms refuse requests in production instead of running without rate limits.                                                                                        |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`         | Required for the public forms in production.                                                                                                                                                           |
| `RESEND_API_KEY`, `EMAIL_FROM`                       | Required for invitations, resets, and verification emails.                                                                                                                                             |
| `R2_*`                                               | Keys scoped to the two SANDHI buckets only (Object Read & Write), not account-wide.                                                                                                                    |
| `CRON_SECRET`                                        | At least 32 random characters.                                                                                                                                                                         |

`SEED_OWNER_PASSWORD` is only for creating the first account. Remove it from every environment after that account exists.

## 2. Database (Neon)

- **Least privilege.** Create a `sandhi_app` role in the Neon console, then run [`scripts/db/least-privilege.sql`](../../scripts/db/least-privilege.sql) as the table owner. The application can then read and write rows but cannot change the schema, and it can only add to the audit log, never edit or delete entries. Migrations (`pnpm db:deploy`) keep using the owner role, whose connection string lives only where migrations run.
- **Encryption.** Neon encrypts data at rest (AES-256) and the application requires TLS in transit.
- **Access.** On plans that offer it, enable IP Allow for the production branch and mark it protected.
- **Backups.** Set history retention (point-in-time restore) to at least 7 days. Once a month, take an encrypted `pg_dump` and keep it outside Neon.

## 3. File storage (Cloudflare R2)

- The private bucket (CVs, proposals) has no public access and no `r2.dev` URL. Files are uploaded through ten-minute signed URLs, and the server checks each file's type, size, and PDF signature before accepting it.
- Limit the private bucket's CORS rules to `PUT` from `https://sandhiresearch.org`.
- Add a lifecycle rule that deletes objects under `applications/` after the retention period set in Admin → Settings.
- R2 encrypts objects at rest. It has no versioning, so copy the private bucket to separate storage (for example with `rclone`) along with the monthly database backup.

## 4. Edge: HTTPS, DDoS, firewall

- Vercel serves HTTPS only (TLS 1.2+), and the site sends HSTS for two years including subdomains. Once every subdomain is confirmed to be HTTPS, consider adding `preload` and submitting the domain at hstspreload.org. That is hard to undo.
- Vercel mitigates DDoS attacks automatically. In Vercel Firewall, add rate-limit rules for `/api/*` and `/portal/sign-in` as an outer layer in front of the application's own limits. Turn on **Attack Challenge Mode** during an attack.
- Use Cloudflare for DNS only (grey cloud) unless you deliberately move the proxy there. Proxying through both Cloudflare and Vercel causes caching and certificate problems.
- There are no servers to patch, no SSH, and no open ports: the site runs on Vercel's managed platform. If that ever changes, allow only ports 80 and 443 and SSH keys only, from known addresses.

## 5. GitHub

In the repository's Settings → Code security:

- Enable **Private vulnerability reporting**, **Dependabot alerts** and **security updates**, **Secret scanning**, and **Push protection**.
- Protect `main`: require pull requests, and require the CI, CodeQL, and Secret scan checks to pass. Block force pushes and branch deletion.
- Use two-factor authentication on every GitHub account that can push.

## 6. Accounts and access

- Keep as few Owners and Admins as the work needs. Everyone else is a Member or Reviewer.
- Review members every quarter: suspend people who have left, and move finished contributors to Alumni.
- Read the audit log (Admin → Audit log) monthly and after any unexpected change.

## 7. Rotating secrets

| Secret                              | How                                                                                                     | Effect                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                | Set `BETTER_AUTH_SECRETS=2:<new>,1:<old>` (newest first) instead of replacing the value, then redeploy. | Everyone is signed out; two-factor keeps working because the old key still decrypts existing secrets. |
| Database password                   | Reset the `sandhi_app` password in Neon, update `DATABASE_URL`, redeploy.                               | None visible.                                                                                         |
| Upstash, Turnstile, Resend, R2 keys | Create a new key, update Vercel, redeploy, then delete the old key.                                     | None visible.                                                                                         |

Rotate immediately if a secret may have leaked (a laptop is lost, a key is pasted somewhere public, or a secret-scanning alert fires). Otherwise rotate yearly.

## 8. Two-factor authentication

- Every Owner, Admin, and Reviewer must set up an authenticator app (Portal → Account security) before administration opens. Members may choose to.
- **Lost phone:** sign in with one of the ten backup codes, then create new codes and set up the new phone.
- **Lost phone and backup codes:** another Owner or Admin opens Admin → Members → the person → Reset two-factor authentication (their own password and the person's name are required). The person is signed out everywhere, emailed, and sets it up again at next sign-in.
- **Passkeys** (Portal → Account security) are optional and sign in without the password or code. If a device with a passkey is lost, remove the passkey from Account security on another device, or reset the person's two-factor authentication and ask them to remove it.
- **The only Owner lost both:** in the Neon SQL editor, run `delete from "twoFactor" where "userId" = (select id from "user" where email = 'owner@…'); update "user" set "twoFactorEnabled" = false where email = 'owner@…';` then sign in and set it up again straight away. Record why in the audit notes.

## 9. Disaster recovery

Targets: lose at most one day of data (in practice minutes, with point-in-time restore) and be back within four hours.

1. In Neon, create a branch from a point in time just before the problem.
2. Point a Vercel preview at that branch and check it.
3. Promote the branch (or restore into production), then update `DATABASE_URL` if the connection string changed.
4. Restore files from the latest R2 copy if any were lost.

Practise this once before launch and then yearly.

## 10. Incident response

1. **Detect.** Signs include security emails to members, unexpected audit log entries, Dependabot or secret-scanning alerts, and error spikes in Vercel logs.
2. **Contain.** Suspend affected accounts (this ends their sessions at once). Rotate `BETTER_AUTH_SECRET` to sign everyone out. Rotate any exposed key. Turn on Attack Challenge Mode. Post a site notice from Admin → Settings if people need to know.
3. **Investigate.** Use the audit log, Vercel logs, and Neon history. Record times and actions as you go.
4. **Fix and recover.** Patch the cause, redeploy, and restore data from a point in time if needed (section 9). If someone's authenticator may be compromised, reset their two-factor authentication (section 8).
5. **Notify.** Tell affected people what happened and what to do, and meet any legal notification duty that applies.
6. **Learn.** Write a short account of what happened and what changes as a result.

## 11. Regular maintenance

- Weekly: review and merge Dependabot pull requests once CI passes.
- Monthly: read the audit log and take a backup copy (sections 2 and 3).
- Quarterly: review member access (section 6).
- Before launch and after major changes: run an external scan (for example the OWASP ZAP baseline) against a preview deployment, and commission a penetration test when the budget allows.

## 12. Accounts behind the site, DNS, and email

Anyone who takes over one of these accounts can bypass every control in the code, so each needs its own protection:

- **Two-factor authentication**, ideally a passkey or security key, on GitHub, Vercel, Neon, Cloudflare, Resend, Upstash, and the domain registrar. Keep their recovery codes offline.
- **Registrar:** turn on the transfer lock and auto-renew, and use an address that is not on the domain itself for the registrar account.
- **Email authentication** for `sandhiresearch.org`, so nobody can send mail that looks like it came from the lab:
  - SPF: `v=spf1 include:<Resend's SPF host> -all` (exact value in Resend → Domains).
  - DKIM: the records Resend lists for the domain.
  - DMARC: start with `v=DMARC1; p=quarantine; rua=mailto:<an address you read>`, then move to `p=reject` once reports show only Resend sends for the domain.
- **CAA:** add `0 issue "letsencrypt.org"` (and any other authority Vercel lists) so no other authority may issue certificates for the domain.
- **Logs:** Vercel's logs show `[csp] violation` lines when a browser blocks a script; more than a trickle after a release means a bug or an injection attempt worth reading.
