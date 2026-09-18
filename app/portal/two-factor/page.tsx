import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { TwoFactorForm } from "@/components/portal/AuthForms";
import styles from "@/components/portal/Portal.module.css";
import { getViewer } from "@/lib/authz";
import { safeAuthenticatedPath } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Two-factor authentication",
};

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const destination = safeAuthenticatedPath(
    Array.isArray(next) ? next[0] : next,
  );
  if (await getViewer()) redirect(destination);

  // The challenge cookie is set when the password is accepted and lasts ten
  // minutes; without it there is nothing to verify.
  const pending = (await cookies())
    .getAll()
    .some(({ name }) => name.endsWith("better-auth.two_factor"));

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>Two-factor authentication</h1>
        <p className={styles.lead}>
          {pending
            ? "Your password was accepted. Enter a code to finish signing in."
            : "This sign-in has expired."}
        </p>
      </header>
      {pending ? (
        <TwoFactorForm next={destination} />
      ) : (
        <p className={styles.aside}>
          <Link
            href={`/portal/sign-in?next=${encodeURIComponent(destination)}`}
          >
            Sign in again
          </Link>
        </p>
      )}
    </div>
  );
}
