import { describe, expect, it } from "vitest";

import { defaultIntake, intakeStatus, isDay, parseIntake } from "@/lib/intake";

const day = "2026-10-30";
const withDeadline = {
  ...defaultIntake,
  RESEARCHER: { open: true, deadline: day },
};

describe("application intake", () => {
  it("is open with nothing to show until an admin says otherwise", () => {
    expect(parseIntake(undefined)).toEqual(defaultIntake);
    expect(
      parseIntake({ RESEARCHER: { open: "no", deadline: "soon" } }),
    ).toEqual(defaultIntake);
    expect(intakeStatus(defaultIntake, new Date())).toEqual({});
  });

  it("shows the closing day until that day ends in Dhaka, then closes", () => {
    // 23:59 on the day in Dhaka is 17:59 UTC.
    expect(
      intakeStatus(withDeadline, new Date("2026-10-30T17:59:00Z")),
    ).toEqual({ RESEARCHER: { deadline: "Apply by October 30, 2026" } });
    expect(
      intakeStatus(withDeadline, new Date("2026-10-30T18:00:00Z")).RESEARCHER
        ?.closed,
    ).toContain("not taking new researchers");
  });

  it("closes a kind that is switched off and never the always-open ones", () => {
    const status = intakeStatus(
      parseIntake({ INTERNSHIP: { open: false, deadline: null } }),
      new Date(),
    );
    expect(Object.keys(status)).toEqual(["INTERNSHIP"]);
    expect(status.INTERNSHIP?.closed).toContain("research interns");
  });

  it("accepts only real days", () => {
    expect(isDay(day)).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("30/10/2026")).toBe(false);
  });
});
