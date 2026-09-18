import type { Metadata } from "next";
import Link from "next/link";

import {
  ChangePasswordForm,
  SessionList,
  type SessionRow,
} from "@/components/portal/SecurityForms";
import styles from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
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
};

function detail(diff: unknown): string {
  if (!diff || typeof diff !== "object") return "";
  const { device, network } = diff as { device?: unknown; network?: unknown };
  return [device, network]
    .filter((part): part is string => typeof part === "string")
    .join(" · ");
}

export default async function AccountSecurityPage() {
  const viewer = await requireViewer("/portal/security");
  const db = getDb();
  const [sessions, events] = await Promise.all([
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
  ]);

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
