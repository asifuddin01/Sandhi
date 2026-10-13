/**
 * Which kinds of application the lab is taking, switched in Admin → Settings.
 * Pure so the form, the endpoint and the tests share one rule.
 */

import type { JoinInterestType } from "@/lib/forms";

/**
 * Only these can be closed. Project proposals and the two partnerships are
 * always open. Each value finishes "is not taking … at the moment".
 */
const notTaking = {
  RESEARCHER: "new researchers",
  INTERNSHIP: "research interns",
  COLLABORATION: "new research collaborations",
} as const satisfies Partial<Record<JoinInterestType, string>>;

export type IntakeType = keyof typeof notTaking;
export type Intake = Record<
  IntakeType,
  { open: boolean; deadline: string | null }
>;

export const intakeTypes = Object.keys(notTaking) as IntakeType[];

export const defaultIntake = Object.fromEntries(
  intakeTypes.map((type) => [type, { open: true, deadline: null }]),
) as Intake;

/** A real calendar day written YYYY-MM-DD, as `<input type="date">` sends it. */
export function isDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
}

/** Stored values are checked again on read; anything invalid means open. */
export function parseIntake(value: unknown): Intake {
  const stored =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    intakeTypes.map((type) => {
      const row =
        stored[type] && typeof stored[type] === "object"
          ? (stored[type] as Record<string, unknown>)
          : {};
      return [
        type,
        {
          open: row.open !== false,
          deadline: isDay(row.deadline) ? row.deadline : null,
        },
      ];
    }),
  ) as Intake;
}

const dayFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

export type IntakeStatus = Partial<
  Record<JoinInterestType, { deadline?: string; closed?: string }>
>;

/**
 * What the form says about each kind: the closing day while it is open, the
 * notice once it is switched off or the day has ended in Dhaka (UTC+6).
 */
export function intakeStatus(intake: Intake, now: Date): IntakeStatus {
  const status: IntakeStatus = {};
  for (const type of intakeTypes) {
    const { open, deadline } = intake[type];
    const ended =
      deadline !== null &&
      now.getTime() > Date.parse(`${deadline}T23:59:59.999+06:00`);
    if (!open || ended) {
      status[type] = {
        closed: `SANDHI Research Lab is not taking ${notTaking[type]} at the moment. Keep visiting — we will open applications again soon.`,
      };
    } else if (deadline) {
      status[type] = {
        deadline: `Apply by ${dayFormatter.format(new Date(`${deadline}T00:00:00Z`))}`,
      };
    }
  }
  return status;
}
