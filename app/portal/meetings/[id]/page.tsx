import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Prose } from "@/components/Prose";
import styles from "@/components/portal/Portal.module.css";
import { requireViewer } from "@/lib/authz";
import { getDb } from "@/lib/db";
import { LAB_TIME_ZONE } from "@/lib/portal/dashboard";
import { getMemberMeeting } from "@/lib/portal/meetings";

import { CallOff, EditMeeting } from "../MeetingForms";

export const metadata: Metadata = { title: "Meeting" };

const when = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: LAB_TIME_ZONE,
});

const justTime = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: LAB_TIME_ZONE,
});

export default async function PortalMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireViewer(`/portal/meetings/${id}`);
  const meeting = await getMemberMeeting(viewer, id);
  if (!meeting) notFound();

  // Only needed to draw the attendee checkboxes, so only fetched for
  // somebody who is going to see them.
  const team =
    meeting.editable && meeting.project
      ? await getDb()
          .projectMember.findMany({
            where: { project: { slug: meeting.project.slug } },
            orderBy: { member: { name: "asc" } },
            select: { memberId: true, member: { select: { name: true } } },
          })
          .then((rows) =>
            rows.map((row) => ({
              memberId: row.memberId,
              name: row.member.name,
            })),
          )
      : [];

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.aside}>
          <Link href="/portal/meetings">Meetings</Link>
        </p>
        <h1>{meeting.title}</h1>
        <p className={styles.lead}>
          <time dateTime={meeting.startsAt.toISOString()}>
            {when.format(meeting.startsAt)}
          </time>
          {meeting.endsAt ? ` – ${justTime.format(meeting.endsAt)}` : ""}
        </p>
        <div className={styles.actions}>
          <a
            className="button button-primary"
            href={`/portal/meetings/${meeting.id}/ics`}
          >
            Add to your calendar
          </a>
          {meeting.link ? (
            <a
              className={styles.textButton}
              href={meeting.link}
              rel="noreferrer noopener"
              target="_blank"
            >
              Join the meeting
            </a>
          ) : null}
        </div>
      </header>

      <section aria-labelledby="about" className={styles.section}>
        <h2 id="about">Who and what</h2>
        <dl className={styles.facts}>
          <div>
            <dt>About</dt>
            <dd>
              {meeting.project ? (
                <Link href={`/portal/projects/${meeting.project.slug}`}>
                  {meeting.project.title}
                </Link>
              ) : (
                "The whole lab"
              )}
            </dd>
          </div>
          <div>
            <dt>Expected</dt>
            <dd>
              {meeting.attendees.length > 0
                ? meeting.attendees.map((person) => person.name).join(", ")
                : "Everyone"}
            </dd>
          </div>
        </dl>
      </section>

      {meeting.agenda ? (
        <section aria-labelledby="agenda" className={styles.section}>
          <h2 id="agenda">Agenda</h2>
          <Prose>{meeting.agenda}</Prose>
        </section>
      ) : null}

      <section aria-labelledby="notes" className={styles.section}>
        <h2 id="notes">What happened</h2>
        {meeting.notes ? (
          <Prose>{meeting.notes}</Prose>
        ) : (
          <p className={styles.hint}>
            Not written up yet.
            {meeting.editable ? " You can do that below." : ""}
          </p>
        )}
      </section>

      {meeting.editable ? (
        <>
          <section aria-labelledby="edit" className={styles.section}>
            <h2 id="edit">Change this meeting</h2>
            <EditMeeting meeting={meeting} team={team} />
          </section>
          <section aria-labelledby="call-off" className={styles.section}>
            <h2 id="call-off">Call it off</h2>
            <p className={styles.hint}>
              This removes the meeting and its notes for everyone.
            </p>
            <CallOff meetingId={meeting.id} />
          </section>
        </>
      ) : null}
    </div>
  );
}
