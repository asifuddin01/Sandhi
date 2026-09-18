import type { Metadata } from "next";
import Link from "next/link";

import {
  PasskeyManager,
  type PasskeyRow,
} from "@/components/portal/PasskeyForms";
import {
  ChangePasswordForm,
  SessionList,
  TwoFactorSection,
  type SessionRow,
} from "@/components/portal/SecurityForms";
import styles from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { getDb } from "@/lib/db";
import { coarseNetwork, describeDevice } from "@/lib/security-signals";

export const metadata: Metadata = {
  title: "Account security",
};

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});

const eventLabels: Record<string, string> = {
  "auth.sign_in": "Signed in",
  "auth.sign_in_failed": "Failed sign-in attempt",
  "auth.rate_limited": "Sign-in paused after too many attempts",
  "auth.password_reset_requested": "Password reset link requested",
  "auth.password_changed": "Password changed",
  "auth.alert_sent": "Security email sent to you",
  "auth.session_revoked": "Signed out another session",
  "auth.sessions_revoked": "Signed out every other session",
  "auth.reauth_failed": "Wrong password when confirming an action",
  "auth.two_factor_enabled": "Two-factor authentication turned on",
  "auth.two_factor_disabled": "Two-factor authentication turned off",
  "auth.two_factor_failed": "Incorrect two-factor code",
  "auth.backup_codes_regenerated": "New backup codes created",
  "auth.backup_code_used": "Signed in with a backup code",
  "auth.passkey_added": "Passkey added",
  "auth.passkey_removed": "Passkey removed",
};

function detail(diff: unknown): string {
  if (!diff || typeof diff !== "object") return "";
  const { device, network } = diff as { device?: unknown; network?: unknown };
  return [device, network]
    .filter((part): part is string => typeof part === "string")
    .join(" · ");
}

export default async function AccountSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string | string[] }>;
}) {
  const viewer = await requireViewer("/portal/security");
  const { setup } = await searchParams;
  const twoFactorRequired = can(viewer.role, "admin:access");
  const db = getDb();
  const [sessions, events, passkeys] = await Promise.all([
    db.session.findMany({
      where: { userId: viewer.userId, expiresAt: { gt: new Date() } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.auditLog.findMany({
      where: { entityId: viewer.userId, action: { startsWith: "auth." } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, action: true, diff: true, createdAt: true },
    }),
    db.passkey.findMany({
      where: { userId: viewer.userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, createdAt: true, backedUp: true },
    }),
  ]);
  const passkeyRows: PasskeyRow[] = passkeys.map((passkey) => ({
    id: passkey.id,
    name: passkey.name ?? "Passkey",
    added: passkey.createdAt ? timeFormat.format(passkey.createdAt) : "",
    synced: passkey.backedUp,
  }));

  const rows: SessionRow[] = sessions.map((session) => ({
    id: session.id,
    device: describeDevice(session.userAgent),
    network: coarseNetwork(session.ipAddress),
    signedIn: timeFormat.format(session.createdAt),
    lastActive: timeFormat.format(session.updatedAt),
    current: session.id === viewer.sessionId,
  }));

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.aside}>
          <Link href="/portal">Portal</Link>
        </p>
        <h1>Account security</h1>
        <p className={styles.lead}>
          Your password, where you are signed in, and recent activity on your
          account.
        </p>
      </header>

      <section className={styles.section} aria-labelledby="password-heading">
        <h2 id="password-heading">Password</h2>
        <ChangePasswordForm />
      </section>

      <section className={styles.section} aria-labelledby="two-factor-heading">
        <h2 id="two-factor-heading">Two-factor authentication</h2>
        {setup === "two-factor" && !viewer.twoFactorEnabled ? (
          <p className={styles.notice} role="status">
            Your role needs two-factor authentication before administration
            opens. Set it up below; it takes about a minute.
          </p>
        ) : null}
        {viewer.twoFactorEnabled ? null : (
          <p className={styles.hint}>
            A code from an authenticator app (such as 1Password, Google
            Authenticator, or Microsoft Authenticator) is needed after your
            password, so a stolen password alone cannot open your account.
            {twoFactorRequired ? " Your role requires it." : ""}
          </p>
        )}
        <TwoFactorSection
          enabled={viewer.twoFactorEnabled}
          required={twoFactorRequired}
        />
      </section>

      <section className={styles.section} aria-labelledby="passkeys-heading">
        <h2 id="passkeys-heading">Passkeys</h2>
        <p className={styles.hint}>
          A passkey signs you in with your fingerprint, face, or device PIN
          instead of your password and code. It cannot be phished, because it
          works only on this site.
        </p>
        <PasskeyManager passkeys={passkeyRows} />
      </section>

      <section className={styles.section} aria-labelledby="sessions-heading">
        <h2 id="sessions-heading">Where you are signed in</h2>
        <SessionList sessions={rows} />
      </section>

      <section className={styles.section} aria-labelledby="activity-heading">
        <h2 id="activity-heading">Recent activity</h2>
        {events.length > 0 ? (
          <ul className={styles.activity}>
            {events.map((event) => (
              <li key={event.id}>
                <span>{eventLabels[event.action] ?? event.action}</span>
                <span className={styles.hint}>
                  <time dateTime={event.createdAt.toISOString()}>
                    {timeFormat.format(event.createdAt)}
                  </time>
                  {detail(event.diff) ? ` · ${detail(event.diff)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>No account activity yet.</p>
        )}
        <p className={styles.hint}>
          If you see something you did not do, change your password and tell an
          administrator.
        </p>
      </section>
    </div>
  );
}
