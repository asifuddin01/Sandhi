import "server-only";

import { after } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { sendSecurityNotice } from "@/lib/email";
import {
  ALERT_COOLDOWN_MS,
  coarseNetwork,
  describeDevice,
  FAILED_ATTEMPT_WINDOW_MS,
  isNewSignIn,
  KNOWN_SIGN_IN_WINDOW_MS,
  shouldAlertFailedAttempts,
  type SignInFingerprint,
} from "@/lib/security-signals";
import { siteOrigin } from "@/lib/site-url";

/**
 * Account security events, written to the audit log (entity "User") so the
 * Owner and Admins can review them, and emailed to the account holder when
 * they may signal someone else using the account.
 */
export type SecurityAction =
  | "auth.sign_in"
  | "auth.sign_in_failed"
  | "auth.rate_limited"
  | "auth.password_reset_requested"
  | "auth.password_changed"
  | "auth.alert_sent"
  | "auth.session_revoked"
  | "auth.sessions_revoked"
  | "auth.reauth_failed";

export type SignInFailure = "password" | "unverified" | "suspended";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Dhaka",
});

function when(date = new Date()): string {
  return `${timeFormat.format(date)} (Dhaka time)`;
}

export function fingerprintFrom(
  ip: string | null | undefined,
  userAgent: string | null | undefined,
): SignInFingerprint {
  return { device: describeDevice(userAgent), network: coarseNetwork(ip) };
}

export function fingerprintFromHeaders(
  headers: Headers | undefined,
): SignInFingerprint {
  return fingerprintFrom(
    headers?.get("x-forwarded-for")?.split(",")[0] ?? headers?.get("x-real-ip"),
    headers?.get("user-agent"),
  );
}

async function record(
  action: SecurityAction,
  userId: string,
  details: Record<string, unknown>,
  actorId: string | null,
): Promise<void> {
  await getDb().auditLog.create({
    data: {
      action,
      entity: "User",
      entityId: userId,
      actorId,
      diff: details as Prisma.InputJsonValue,
    },
  });
}

/** Records an account event whose details need no further processing. */
export async function recordSecurityEvent(
  action: SecurityAction,
  userId: string,
  details: Record<string, unknown>,
  headers?: Headers,
): Promise<void> {
  await safely(action, () =>
    record(
      action,
      userId,
      { ...details, ...fingerprintFromHeaders(headers) },
      userId,
    ),
  );
}

/** Sends after the response when inside a request, so sign-in never waits. */
function sendLater(work: () => Promise<unknown>): void {
  const run = () =>
    work().catch((error) =>
      console.error("[security] notification failed:", error),
    );
  try {
    after(run);
  } catch {
    void run();
  }
}

/** Security logging must never stop someone signing in or out. */
async function safely(label: string, work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    console.error(`[security] ${label} not recorded:`, error);
  }
}

function toFingerprint(value: Prisma.JsonValue): SignInFingerprint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { device, network } = value as Record<string, unknown>;
  return typeof device === "string" && typeof network === "string"
    ? { device, network }
    : null;
}

export async function recordSignIn(session: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await safely("sign-in", async () => {
    const db = getDb();
    const fingerprint = fingerprintFrom(session.ipAddress, session.userAgent);
    const previous = await db.auditLog.findMany({
      where: {
        action: "auth.sign_in",
        entityId: session.userId,
        createdAt: { gte: new Date(Date.now() - KNOWN_SIGN_IN_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { diff: true },
    });
    await record("auth.sign_in", session.userId, fingerprint, session.userId);

    const known = previous
      .map(({ diff }) => toFingerprint(diff))
      .filter((entry): entry is SignInFingerprint => entry !== null);
    if (!isNewSignIn(known, fingerprint)) return;

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { email: true, name: true },
    });
    if (!user) return;
    const origin = await siteOrigin();
    sendLater(() =>
      sendSecurityNotice({
        to: user.email,
        name: user.name,
        subject: "New sign-in to your SANDHI account",
        lines: [
          `Your account was signed in to from ${fingerprint.device} on a network we have not seen for you before (${fingerprint.network}), at ${when()}.`,
          "If this was you, there is nothing to do.",
          `If it was not, change your password now at ${origin}/portal/reset-password and tell an administrator.`,
        ],
      }),
    );
    await record(
      "auth.alert_sent",
      session.userId,
      { kind: "new-sign-in", ...fingerprint },
      null,
    );
  });
}

export async function recordSignInFailure(
  email: string,
  reason: SignInFailure,
  headers: Headers | undefined,
): Promise<void> {
  await safely("failed sign-in", async () => {
    const db = getDb();
    const user = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, name: true },
    });
    // Attempts on addresses without an account are left to the rate limiter.
    if (!user) return;

    const fingerprint = fingerprintFromHeaders(headers);
    await record(
      "auth.sign_in_failed",
      user.id,
      { reason, ...fingerprint },
      null,
    );
    if (reason !== "password") return;

    const now = new Date();
    const [failures, lastAlert] = await Promise.all([
      db.auditLog.count({
        where: {
          action: "auth.sign_in_failed",
          entityId: user.id,
          createdAt: {
            gte: new Date(now.getTime() - FAILED_ATTEMPT_WINDOW_MS),
          },
          diff: { path: ["reason"], equals: "password" },
        },
      }),
      db.auditLog.findFirst({
        where: {
          action: "auth.alert_sent",
          entityId: user.id,
          createdAt: { gte: new Date(now.getTime() - ALERT_COOLDOWN_MS) },
          diff: { path: ["kind"], equals: "failed-attempts" },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);
    if (
      !shouldAlertFailedAttempts(failures, lastAlert?.createdAt ?? null, now)
    ) {
      return;
    }

    const origin = await siteOrigin();
    sendLater(() =>
      sendSecurityNotice({
        to: user.email,
        name: user.name,
        subject: "Failed attempts to sign in to your SANDHI account",
        lines: [
          `There were ${failures} failed attempts to sign in to your account in the last 15 minutes, most recently from ${fingerprint.device} (${fingerprint.network}) at ${when(now)}.`,
          "If this was you, there is nothing to do. Your account is protected: after 10 attempts, sign-in pauses for 15 minutes.",
          `If it was not, your password has not been guessed. If you use it anywhere else, change it at ${origin}/portal/reset-password.`,
        ],
      }),
    );
    await record(
      "auth.alert_sent",
      user.id,
      { kind: "failed-attempts", attempts: failures, ...fingerprint },
      null,
    );
  });
}

/** One entry per account per window, however many attempts are blocked. */
export async function recordRateLimited(
  email: string,
  headers: Headers | undefined,
): Promise<void> {
  await safely("rate limit", async () => {
    const db = getDb();
    const user = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!user) return;
    const recent = await db.auditLog.count({
      where: {
        action: "auth.rate_limited",
        entityId: user.id,
        createdAt: { gte: new Date(Date.now() - FAILED_ATTEMPT_WINDOW_MS) },
      },
    });
    if (recent > 0) return;
    await record(
      "auth.rate_limited",
      user.id,
      fingerprintFromHeaders(headers),
      null,
    );
  });
}

export async function recordPasswordResetRequested(
  userId: string,
  headers: Headers | undefined,
): Promise<void> {
  await safely("reset request", () =>
    record(
      "auth.password_reset_requested",
      userId,
      fingerprintFromHeaders(headers),
      null,
    ),
  );
}

export async function recordPasswordChanged(
  user: { id: string; email: string; name: string },
  headers: Headers | undefined,
): Promise<void> {
  await safely("password change", async () => {
    const fingerprint = fingerprintFromHeaders(headers);
    await record("auth.password_changed", user.id, fingerprint, user.id);
    const origin = await siteOrigin();
    sendLater(() =>
      sendSecurityNotice({
        to: user.email,
        name: user.name,
        subject: "Your SANDHI password was changed",
        lines: [
          `The password for your account was changed at ${when()} from ${fingerprint.device}. Every other session was signed out.`,
          `If you did not do this, reset your password now at ${origin}/portal/reset-password and tell an administrator.`,
        ],
      }),
    );
  });
}

/** Tells a member their role changed, and who changed it. */
export function notifyAccessChanged(input: {
  to: string;
  name: string;
  from: string;
  toRole: string;
  changedBy: string;
}): void {
  sendLater(() =>
    sendSecurityNotice({
      to: input.to,
      name: input.name,
      subject: "Your SANDHI access changed",
      lines: [
        `${input.changedBy} changed your role from ${input.from} to ${input.toRole} at ${when()}.`,
        "If you did not expect this, tell the lab's Owner.",
      ],
    }),
  );
}

/** Tells the Owner whenever someone else grants administrator access. */
export async function notifyOwnersOfAdminGrant(input: {
  memberName: string;
  grantedBy: string;
  grantedById: string;
}): Promise<void> {
  await safely("administrator grant notice", async () => {
    const owners = await getDb().user.findMany({
      where: { role: "OWNER", id: { not: input.grantedById } },
      select: { email: true, name: true },
    });
    for (const owner of owners) {
      sendLater(() =>
        sendSecurityNotice({
          to: owner.email,
          name: owner.name,
          subject: "A new SANDHI administrator",
          lines: [
            `${input.grantedBy} made ${input.memberName} an Administrator at ${when()}.`,
            "Administrators can manage members, settings, and every public section. If you did not expect this, review it in Admin → Members.",
          ],
        }),
      );
    }
  });
}
