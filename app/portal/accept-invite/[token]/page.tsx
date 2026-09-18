import type { Metadata } from "next";
import Link from "next/link";

import { AcceptInvitationForm } from "@/components/portal/AuthForms";
import styles from "@/components/portal/Portal.module.css";
import { isDatabaseConfigured } from "@/lib/db";
import { findOpenInvitation } from "@/lib/invitations";

export const metadata: Metadata = {
  title: "Accept invitation",
};

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = isDatabaseConfigured()
    ? await findOpenInvitation(token)
    : null;

  if (!invitation) {
    return (
      <div className={styles.page}>
        <header className={styles.intro}>
          <h1>Invitation unavailable</h1>
          <p className={styles.lead}>
            This invitation has expired, was already used, or was withdrawn. Ask
            the administrator who invited you for a new one.
          </p>
        </header>
        <p className={styles.aside}>
          <Link href="/portal/sign-in">Sign in with an existing account</Link>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>Join the SANDHI portal</h1>
        <p className={styles.lead}>
          Confirm your name and choose a password to create your account.
        </p>
      </header>
      <AcceptInvitationForm
        token={token}
        email={invitation.email}
        suggestedName={invitation.member?.name ?? ""}
      />
    </div>
  );
}
