"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { encode } from "uqr";

import { getAuth } from "@/lib/auth";
import { getViewer } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  field,
  limited,
  passwordProblem,
  type AuthFormState,
} from "@/lib/portal-forms";
import { can } from "@/lib/permissions";
import { confirmPassword, ReauthenticationError } from "@/lib/reauth";
import {
  recordPasswordChanged,
  recordSecurityEvent,
  recordTwoFactorChange,
} from "@/lib/security-events";

const signedOut: AuthFormState = {
  status: "error",
  message: "Your session has ended. Sign in again.",
};

/** Needs the current password; every other session is signed out. */
export async function changePasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const viewer = await getViewer();
  if (!viewer) return signedOut;

  const currentPassword = field(formData, "currentPassword");
  const newPassword = field(formData, "newPassword");
  if (!currentPassword) {
    return { status: "error", message: "Enter your current password." };
  }
  const problem = passwordProblem(newPassword, field(formData, "confirmation"));
  if (problem) return { status: "error", message: problem };
  if (newPassword === currentPassword) {
    return {
      status: "error",
      message: "Choose a password different from your current one.",
    };
  }

  const requestHeaders = await headers();
  const blocked = await limited(requestHeaders, viewer.email);
  if (blocked) return blocked;

  try {
    // Better Auth's own revocation also replaces this session's cookie,
    // which reloads the page; ending the others directly keeps this one.
    await getAuth().api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: false },
      headers: requestHeaders,
    });
  } catch (error) {
    if (!(error instanceof APIError)) {
      console.error("[auth] password change failed:", error);
      return {
        status: "error",
        message: "The password could not be changed. Please try again.",
      };
    }
    const code = (error.body as { code?: unknown } | undefined)?.code;
    if (code === "PASSWORD_BREACHED") {
      return { status: "error", message: error.message };
    }
    if (code === "INVALID_PASSWORD") {
      await recordSecurityEvent(
        "auth.reauth_failed",
        viewer.userId,
        {},
        requestHeaders,
      );
      return {
        status: "error",
        message: "Your current password is not correct.",
      };
    }
    return {
      status: "error",
      message: "The password could not be changed. Please try again.",
    };
  }

  await getDb().session.deleteMany({
    where: { userId: viewer.userId, id: { not: viewer.sessionId } },
  });
  await recordPasswordChanged(
    { id: viewer.userId, email: viewer.email, name: viewer.name },
    requestHeaders,
  );
  revalidatePath("/portal/security");
  return {
    status: "success",
    message: "Password changed. Every other session was signed out.",
  };
}

/** Ends one other session, or every session except this one. */
export async function manageSessionsAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const viewer = await getViewer();
  if (!viewer) return signedOut;

  const requestHeaders = await headers();
  const operation = field(formData, "operation");
  const db = getDb();
  let result: AuthFormState;

  if (operation === "others") {
    const { count } = await db.session.deleteMany({
      where: { userId: viewer.userId, id: { not: viewer.sessionId } },
    });
    await recordSecurityEvent(
      "auth.sessions_revoked",
      viewer.userId,
      { count },
      requestHeaders,
    );
    result = {
      status: "success",
      message:
        count === 1
          ? "Signed out of 1 other session."
          : `Signed out of ${count} other sessions.`,
    };
  } else if (operation.startsWith("revoke:")) {
    const sessionId = operation.slice("revoke:".length);
    if (sessionId === viewer.sessionId) {
      return {
        status: "error",
        message: "To end this session, use Sign out.",
      };
    }
    // Scoped to the viewer, so nobody can end someone else's session.
    const { count } = await db.session.deleteMany({
      where: { id: sessionId, userId: viewer.userId },
    });
    if (count === 0) {
      result = {
        status: "success",
        message: "That session had already ended.",
      };
    } else {
      await recordSecurityEvent(
        "auth.session_revoked",
        viewer.userId,
        {},
        requestHeaders,
      );
      result = { status: "success", message: "Signed out of that session." };
    }
  } else {
    return { status: "error", message: "Choose a session." };
  }

  revalidatePath("/portal/security");
  return result;
}

export type TwoFactorSetup = {
  /** SVG path for the QR code, drawn on a square of `size` modules. */
  qrPath: string;
  size: number;
  /** The same secret, for typing into an app by hand. */
  key: string;
  backupCodes: string[];
};

export type TwoFactorState = AuthFormState & {
  setup?: TwoFactorSetup;
  backupCodes?: string[];
};

function qrFor(uri: string): { qrPath: string; size: number } {
  const { data, size } = encode(uri, { ecc: "M", border: 2 });
  let path = "";
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return { qrPath: path, size };
}

function apiErrorCode(error: unknown): string | null {
  if (!(error instanceof APIError)) return null;
  const code = (error.body as { code?: unknown } | undefined)?.code;
  return typeof code === "string" ? code : null;
}

async function wrongPassword(viewerId: string, requestHeaders: Headers) {
  await recordSecurityEvent("auth.reauth_failed", viewerId, {}, requestHeaders);
  return { status: "error", message: "That password is not correct." } as const;
}

/** Step one: the password, then a secret, QR code, and backup codes. */
export async function startTwoFactorSetupAction(
  _previous: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  const viewer = await getViewer();
  if (!viewer) return signedOut;
  if (viewer.twoFactorEnabled) {
    return {
      status: "error",
      message: "Two-factor authentication is already on.",
    };
  }
  const password = field(formData, "password");
  if (!password) return { status: "error", message: "Enter your password." };

  const requestHeaders = await headers();
  const blocked = await limited(requestHeaders, viewer.email);
  if (blocked) return blocked;

  try {
    const enabled = await getAuth().api.enableTwoFactor({
      body: { password, method: "totp" },
      headers: requestHeaders,
    });
    if (enabled.method !== "totp") throw new Error("No authenticator secret");
    const { totpURI, backupCodes } = enabled;
    const key = new URL(totpURI).searchParams.get("secret") ?? "";
    return {
      status: "success",
      message:
        "Scan the code or type the key into your authenticator app, save your backup codes, then enter the code the app shows.",
      setup: { ...qrFor(totpURI), key, backupCodes },
    };
  } catch (error) {
    if (apiErrorCode(error) === "INVALID_PASSWORD") {
      return wrongPassword(viewer.userId, requestHeaders);
    }
    console.error("[auth] two-factor setup failed:", error);
    return {
      status: "error",
      message: "Two-factor authentication could not be set up. Try again.",
    };
  }
}

/** Step two: a code from the app proves it was set up correctly. */
export async function confirmTwoFactorSetupAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const viewer = await getViewer();
  if (!viewer) return signedOut;
  const code = field(formData, "code").replace(/\s/gu, "");
  if (!/^\d{6}$/u.test(code)) {
    return {
      status: "error",
      message: "Enter the six-digit code from your authenticator app.",
    };
  }

  const requestHeaders = await headers();
  const blocked = await limited(requestHeaders, viewer.email);
  if (blocked) return blocked;

  try {
    await getAuth().api.verifyTOTP({
      body: { code },
      headers: requestHeaders,
    });
  } catch (error) {
    if (apiErrorCode(error) === "INVALID_CODE") {
      return {
        status: "error",
        message:
          "That code is not correct. Check that your phone's clock is right, then try the next code.",
      };
    }
    console.error("[auth] two-factor confirmation failed:", error);
    return {
      status: "error",
      message: "The code could not be checked. Start again.",
    };
  }

  await recordTwoFactorChange(
    "auth.two_factor_enabled",
    { id: viewer.userId, email: viewer.email, name: viewer.name },
    requestHeaders,
  );
  revalidatePath("/portal/security");
  return { status: "success", message: "Two-factor authentication is on." };
}

/** New backup codes replace every old one. */
export async function regenerateBackupCodesAction(
  _previous: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  const viewer = await getViewer();
  if (!viewer) return signedOut;
  const password = field(formData, "password");
  if (!password) return { status: "error", message: "Enter your password." };

  const requestHeaders = await headers();
  const blocked = await limited(requestHeaders, viewer.email);
  if (blocked) return blocked;

  try {
    const { backupCodes } = await getAuth().api.generateBackupCodes({
      body: { password },
      headers: requestHeaders,
    });
    await recordTwoFactorChange(
      "auth.backup_codes_regenerated",
      { id: viewer.userId, email: viewer.email, name: viewer.name },
      requestHeaders,
    );
    return {
      status: "success",
      message: "New backup codes are ready. The old ones no longer work.",
      backupCodes,
    };
  } catch (error) {
    if (apiErrorCode(error) === "INVALID_PASSWORD") {
      return wrongPassword(viewer.userId, requestHeaders);
    }
    console.error("[auth] backup code generation failed:", error);
    return {
      status: "error",
      message: "New backup codes could not be made. Try again.",
    };
  }
}

/** Members may turn it off; staff roles cannot. */
export async function disableTwoFactorAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const viewer = await getViewer();
  if (!viewer) return signedOut;
  if (can(viewer.role, "admin:access")) {
    return {
      status: "error",
      message: "Your role requires two-factor authentication.",
    };
  }
  if (!viewer.twoFactorEnabled) {
    return { status: "success", message: "Two-factor authentication is off." };
  }

  try {
    await confirmPassword(viewer, field(formData, "password"));
  } catch (error) {
    if (error instanceof ReauthenticationError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  const requestHeaders = await headers();
  await getDb().$transaction([
    getDb().twoFactor.deleteMany({ where: { userId: viewer.userId } }),
    getDb().user.update({
      where: { id: viewer.userId },
      data: { twoFactorEnabled: false },
    }),
  ]);
  await recordTwoFactorChange(
    "auth.two_factor_disabled",
    { id: viewer.userId, email: viewer.email, name: viewer.name },
    requestHeaders,
  );
  revalidatePath("/portal/security");
  return { status: "success", message: "Two-factor authentication is off." };
}
