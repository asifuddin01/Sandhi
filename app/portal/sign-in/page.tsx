import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/portal/AuthForms";
import styles from "@/components/portal/Portal.module.css";
import { getViewer } from "@/lib/authz";
import { safeAuthenticatedPath } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Sign in",
  alternates: { canonical: "/portal/sign-in" },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const destination = safeAuthenticatedPath(
    Array.isArray(next) ? next[0] : next,
  );
  if (await getViewer()) redirect(destination);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>Sign in</h1>
        <p className={styles.lead}>
          For SANDHI members, reviewers, and administrators. Accounts are
          created by invitation.
        </p>
      </header>
      <SignInForm next={destination} />
    </div>
  );
}
