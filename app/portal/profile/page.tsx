import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/portal/Portal.module.css";
import { signOutAction } from "@/app/portal/actions";
import { requireViewer } from "@/lib/authz";
import { getEditableProfile } from "@/lib/portal/profile";
import {
  GAP_LABELS,
  profileGaps,
  type ProfileGap,
} from "@/lib/portal/profile-fields";

import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = {
  title: "Your profile",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string | string[] }>;
}) {
  const viewer = await requireViewer("/portal/profile");
  const { setup } = await searchParams;
  const profile = await getEditableProfile(viewer);
  // An account with no member record has no profile to write. That is a
  // configuration problem for an administrator, not a page.
  if (!profile) notFound();

  const gaps: ProfileGap[] = profileGaps(profile);
  const firstTime = setup === "profile" && gaps.length > 0;

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.aside}>
          <Link href="/portal">Portal</Link>
        </p>
        <h1>Your profile</h1>
        <p className={styles.lead}>
          {firstTime
            ? "One last thing before the portal opens: tell the lab who you are."
            : "How you appear to the rest of the lab, and on the public site."}
        </p>
        {gaps.length > 0 ? (
          <div className={styles.notice} role="status">
            <p>Still needed:</p>
            <ul className={styles.gapList}>
              {gaps.map((gap) => (
                <li key={gap}>{GAP_LABELS[gap]}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className={styles.hint}>
          {profile.isPublic
            ? "Your profile is published, so what you write here appears on the people pages."
            : "Your profile is not published yet. An administrator decides that; what you write here is ready for when they do."}
        </p>
        {/* People are held here until this is filled in, so the way out has
            to be on the page. Being stuck on a form with no exit is how an
            account gets abandoned. */}
        <form action={signOutAction}>
          <button className={styles.textButton} type="submit">
            Sign out
          </button>
        </form>
      </header>

      <section className={styles.section} aria-labelledby="profile-heading">
        <h2 id="profile-heading">About you</h2>
        <ProfileForm profile={profile} />
      </section>
    </div>
  );
}
