import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/portal/AuthForms";
import { PasskeySignIn } from "@/components/portal/PasskeyForms";
import styles from "@/components/portal/Portal.module.css";
import { getViewer, STAFF_SESSION_EXPIRED_MESSAGE } from "@/lib/authz";
import { safeAuthenticatedPath } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Sign in",
  alternates: { canonical: "/portal/sign-in" },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    reason?: string | string[];
  }>;
}) {
  const { next, reason } = await searchParams;
  const destination = safeAuthenticatedPath(
    Array.isArray(next) ? next[0] : next,
  );
  // Administration asks staff to sign in again after twelve hours, even
  // though their portal session is still valid.
  const expired = reason === "expired";
  if (!expired && (await getViewer())) redirect(destination);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>Sign in</h1>
        <p className={styles.lead}>
          For SANDHI members, reviewers, and administrators. Accounts are
          created by invitation.
        </p>
        {expired ? (
          <p className={styles.notice} role="status">
            {STAFF_SESSION_EXPIRED_MESSAGE}
          </p>
        ) : null}
      </header>
      <SignInForm next={destination} />
      <PasskeySignIn next={destination} />
    </div>
  );
}
