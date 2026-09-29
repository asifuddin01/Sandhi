import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { LAB_TIME_ZONE } from "@/lib/portal/dashboard";
import { getMemberMeetings, type MemberMeeting } from "@/lib/portal/meetings";

import { CallMeeting } from "./MeetingForms";

export const metadata: Metadata = { title: "Meetings" };

const when = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: LAB_TIME_ZONE,
});

function MeetingCard({ meeting }: { meeting: MemberMeeting }) {
  return (
    <li className={styles.card}>
      <h3>
        <Link href={`/portal/meetings/${meeting.id}`}>{meeting.title}</Link>
      </h3>
      <p className={styles.cardMeta}>
        <time dateTime={meeting.startsAt.toISOString()}>
          {when.format(meeting.startsAt)}
        </time>
        {" · "}
        {meeting.project ? meeting.project.title : "The whole lab"}
        {meeting.notes ? " · Written up" : ""}
      </p>
      {meeting.expected ? (
        <p className={styles.cardMeta}>
          <span className={styles.badge}>You are expected</span>
        </p>
      ) : null}
    </li>
  );
}

export default async function PortalMeetingsPage() {
  const viewer = await requireViewer("/portal/meetings");
  const meetings = await getMemberMeetings(viewer);
  const mayCall =
    Boolean(meetings) &&
    (meetings!.canCallLabWide || meetings!.canCallFor.length > 0);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.aside}>
          <Link href="/portal">Portal</Link>
        </p>
        <h1>Meetings</h1>
        <p className={styles.lead}>
          Your projects&rsquo; meetings and the lab&rsquo;s, with what was
          decided in the ones that have happened.
        </p>
      </header>

      <section aria-labelledby="upcoming" className={styles.section}>
        <h2 id="upcoming">Coming up</h2>
        {meetings && meetings.upcoming.length > 0 ? (
          <ul className={styles.cardList}>
            {meetings.upcoming.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>Nothing in the diary.</p>
        )}
      </section>

      <section aria-labelledby="past" className={styles.section}>
        <h2 id="past">Already held</h2>
        {meetings && meetings.past.length > 0 ? (
          <ul className={styles.cardList}>
            {meetings.past.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>Nothing yet.</p>
        )}
      </section>

      {/* Only shown to somebody who could actually call one: an empty form
          that always refuses is worse than no form. */}
      {mayCall ? (
        <section aria-labelledby="call" className={styles.section}>
          <h2 id="call">Call a meeting</h2>
          <CallMeeting
            canCallLabWide={meetings!.canCallLabWide}
            projects={meetings!.canCallFor}
          />
        </section>
      ) : null}
    </div>
  );
}
