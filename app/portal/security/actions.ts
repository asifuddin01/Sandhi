"use server";

import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getAuth } from "@/lib/auth";
import { getViewer } from "@/lib/authz";
import { getDb } from "@/lib/db";
import {
  field,
  limited,
  passwordProblem,
  type AuthFormState,
} from "@/lib/portal-forms";
import {
  recordPasswordChanged,
  recordSecurityEvent,
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
