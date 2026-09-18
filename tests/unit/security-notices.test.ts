import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendSecurityNotice: vi.fn(),
  findOwners: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({
  // Run deferred work at once so the test can observe it.
  after: (work: () => unknown) => void work(),
}));
vi.mock("@/lib/email", () => ({
  sendSecurityNotice: mocks.sendSecurityNotice,
}));
vi.mock("@/lib/db", () => ({
  getDb: () => ({ user: { findMany: mocks.findOwners } }),
}));
vi.mock("@/lib/site-url", () => ({
  siteOrigin: async () => "https://sandhiresearch.org",
}));

import {
  notifyAccessChanged,
  notifyOwnersOfAdminGrant,
} from "@/lib/security-events";

describe("security notices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendSecurityNotice.mockResolvedValue({ mode: "development-bypass" });
  });

  it("tells a member their role changed and who changed it", () => {
    notifyAccessChanged({
      to: "member@sandhi.test",
      name: "Fixture Member",
      from: "Member",
      toRole: "Reviewer",
      changedBy: "Fixture Admin",
    });

    expect(mocks.sendSecurityNotice).toHaveBeenCalledOnce();
    const notice = mocks.sendSecurityNotice.mock.calls[0]![0];
    expect(notice.to).toBe("member@sandhi.test");
    expect(notice.subject).toBe("Your SANDHI access changed");
    expect(notice.lines[0]).toMatch(
      /^Fixture Admin changed your role from Member to Reviewer at .+ \(Dhaka time\)\.$/u,
    );
  });

  it("tells every other Owner when someone is made an Administrator", async () => {
    mocks.findOwners.mockResolvedValue([
      { email: "owner@sandhi.test", name: "Fixture Owner" },
    ]);

    await notifyOwnersOfAdminGrant({
      memberName: "Fixture Staff",
      grantedBy: "Fixture Admin",
      grantedById: "admin-id",
    });

    expect(mocks.findOwners).toHaveBeenCalledWith({
      where: { role: "OWNER", id: { not: "admin-id" } },
      select: { email: true, name: true },
    });
    const notice = mocks.sendSecurityNotice.mock.calls[0]![0];
    expect(notice.to).toBe("owner@sandhi.test");
    expect(notice.lines[0]).toMatch(
      /^Fixture Admin made Fixture Staff an Administrator/u,
    );
  });

  it("never lets a failed notice stop the change that caused it", async () => {
    mocks.findOwners.mockRejectedValue(new Error("database unavailable"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      notifyOwnersOfAdminGrant({
        memberName: "Fixture Staff",
        grantedBy: "Fixture Admin",
        grantedById: "admin-id",
      }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
