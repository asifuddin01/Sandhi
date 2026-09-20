import { describe, expect, it, vi } from "vitest";

import {
  sendApplicationDecisionEmail,
  sendProposalDecisionEmail,
} from "@/lib/email";
import { tellsApplicant } from "@/lib/applications";
import { tellsProposer } from "@/lib/proposals";

/** Every credential here is invented; nothing leaves the test. */
const env = {
  NODE_ENV: "test",
  RESEND_API_KEY: "fixture-key",
  EMAIL_FROM: "fixture@sandhi.test",
} as unknown as NodeJS.ProcessEnv;

function capture() {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ id: "fixture-id" }, { status: 200 }));
  const sent = () =>
    JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as {
      to: string;
      subject: string;
      text: string;
      html: string;
    };
  return { fetcher, sent };
}

describe("who is told what", () => {
  it("tells an applicant only the two answers they are owed", () => {
    expect(tellsApplicant("ACCEPTED")).toBe(true);
    expect(tellsApplicant("REJECTED")).toBe(true);
    // Being read, or shortlisted, is the lab talking to itself.
    for (const quiet of ["NEW", "IN_REVIEW", "SHORTLISTED", "INTERVIEW"]) {
      expect(tellsApplicant(quiet)).toBe(false);
    }
    // Somebody who withdrew does not need telling what they did.
    expect(tellsApplicant("WITHDRAWN")).toBe(false);
    // An invitation is its own email.
    expect(tellsApplicant("INVITED")).toBe(false);
  });

  it("tells a proposer only once there is an outcome", () => {
    expect(tellsProposer("APPROVED")).toBe(true);
    expect(tellsProposer("DECLINED")).toBe(true);
    for (const quiet of ["SUBMITTED", "IN_REVIEW", "QUEUED", "WITHDRAWN"]) {
      expect(tellsProposer(quiet)).toBe(false);
    }
  });
});

describe("sendApplicationDecisionEmail", () => {
  it("carries the administrator's own words to the applicant", async () => {
    const { fetcher, sent } = capture();
    await sendApplicationDecisionEmail(
      {
        to: "applicant@example.org",
        name: "A Person",
        accepted: false,
        message: "Do apply again after your thesis.",
      },
      { env, fetcher },
    );
    const body = sent();
    expect(body.to).toBe("applicant@example.org");
    expect(body.text).toContain("not able to take it further");
    expect(body.text).toContain("Do apply again after your thesis.");
  });

  /**
   * A refusal should not announce itself in a notification on somebody's
   * phone, so both outcomes share a subject.
   */
  it("uses the same subject whichever the answer is", async () => {
    const accepted = capture();
    await sendApplicationDecisionEmail(
      { to: "a@example.org", name: "A", accepted: true, message: null },
      { env, fetcher: accepted.fetcher },
    );
    const refused = capture();
    await sendApplicationDecisionEmail(
      { to: "a@example.org", name: "A", accepted: false, message: null },
      { env, fetcher: refused.fetcher },
    );
    expect(accepted.sent().subject).toBe(refused.sent().subject);
    expect(accepted.sent().text).toContain("would like you to join");
  });

  it("escapes what it puts in the HTML", async () => {
    const { fetcher, sent } = capture();
    await sendApplicationDecisionEmail(
      {
        to: "a@example.org",
        name: "<script>alert(1)</script>",
        accepted: false,
        message: "Regards & best <wishes>",
      },
      { env, fetcher },
    );
    const body = sent();
    expect(body.html).not.toContain("<script>");
    expect(body.html).toContain("&lt;script&gt;");
    expect(body.html).toContain("&amp;");
  });

  it("reads correctly with no message at all", async () => {
    const { fetcher, sent } = capture();
    await sendApplicationDecisionEmail(
      { to: "a@example.org", name: "A", accepted: false, message: null },
      { env, fetcher },
    );
    expect(sent().text).not.toContain("null");
    expect(sent().html).not.toContain("<p></p>");
  });
});

describe("sendProposalDecisionEmail", () => {
  it("names the idea it is about", async () => {
    const { fetcher, sent } = capture();
    await sendProposalDecisionEmail(
      {
        to: "proposer@example.org",
        name: "A Proposer",
        title: "Prosody and boundaries",
        approved: true,
        message: null,
        url: null,
      },
      { env, fetcher },
    );
    expect(sent().subject).toContain("Prosody and boundaries");
    expect(sent().text).toContain("now a project");
  });

  /**
   * An approved proposal becomes a draft project, so there is nothing the
   * proposer could open. No link is better than one that 404s.
   */
  it("sends no link when there is none to give", async () => {
    const { fetcher, sent } = capture();
    await sendProposalDecisionEmail(
      {
        to: "proposer@example.org",
        name: "A Proposer",
        title: "An idea",
        approved: true,
        message: null,
        url: null,
      },
      { env, fetcher },
    );
    expect(sent().html).not.toContain("<a href");
  });

  it("does not leak the decision note, only what was written for them", async () => {
    const { fetcher, sent } = capture();
    await sendProposalDecisionEmail(
      {
        to: "proposer@example.org",
        name: "A Proposer",
        title: "An idea",
        approved: false,
        message: "The question overlaps work already running here.",
        url: null,
      },
      { env, fetcher },
    );
    expect(sent().text).toContain("overlaps work already running");
    expect(sent().text).toContain("not taking it up");
  });
});
