import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { can } from "@/lib/permissions";

import { signOutAction } from "./actions";

export const metadata: Metadata = {
  title: "Portal",
};

const roleNames = {
  OWNER: "Owner",
  ADMIN: "Administrator",
  REVIEWER: "Reviewer",
  MEMBER: "Member",
} as const;

export default async function PortalPage() {
  const viewer = await requireViewer("/portal");

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>Welcome, {viewer.member?.name ?? viewer.name}</h1>
        <p className={styles.lead}>
          Signed in as {viewer.email} · {roleNames[viewer.role]}
        </p>
      </header>
      <section className={styles.panel} aria-label="Account">
        <p>
          The member dashboard, profile, projects, and publications arrive with
          the member portal.
        </p>
        <div className={styles.actions}>
          {can(viewer.role, "admin:access") ? (
            <Link className="button button-primary" href="/admin">
              Open administration
            </Link>
          ) : null}
          <form action={signOutAction}>
            <button className={styles.textButton} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
