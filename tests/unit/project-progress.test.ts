import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  projectMemberFindMany: vi.fn(),
  projectUpdateFindUnique: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    project: { findFirst: mocks.projectFindFirst },
    projectMember: { findMany: mocks.projectMemberFindMany },
    projectUpdate: { findUnique: mocks.projectUpdateFindUnique },
  }),
  isDatabaseConfigured: () => true,
}));

import type { Viewer } from "@/lib/authz";
import {
  canEditUpdate,
  getProjectProgress,
  onProject,
} from "@/lib/portal/progress";

function viewer(
  overrides: Partial<NonNullable<Viewer["member"]>> | null = {},
): Viewer {
  return {
    userId: "user-1",
    sessionId: "session-1",
    sessionCreatedAt: new Date(),
    email: "member@sandhi.test",
    name: "A Member",
    role: "MEMBER",
    twoFactorEnabled: false,
    member: overrides
      ? {
          id: "member-1",
          slug: "a-member",
          name: "A Member",
          rank: "RESEARCHER",
          status: "ACTIVE",
          ...overrides,
        }
      : null,
  };
}

function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    slug: "quiet-signals",
    title: "Quiet Signals",
    gloss: "Listening to what is not said.",
    status: "ACTIVE",
    state: "DRAFT",
    members: [{ role: "Researcher", isLead: false }],
    updates: [],
    ...overrides,
  };
}

describe("getProjectProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.projectFindFirst.mockResolvedValue(projectRow());
  });

  it("asks only for projects the viewer is on", async () => {
    await getProjectProgress(viewer(), "quiet-signals");

    const [{ where }] = mocks.projectFindFirst.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(where).toMatchObject({
      slug: "quiet-signals",
      members: { some: { memberId: "member-1" } },
    });
  });

  it("reads nothing for an account with no member record, or a suspended one", async () => {
    expect(await getProjectProgress(viewer(null), "quiet-signals")).toBeNull();
    expect(
      await getProjectProgress(
        viewer({ status: "SUSPENDED" }),
        "quiet-signals",
      ),
    ).toBeNull();
    expect(mocks.projectFindFirst).not.toHaveBeenCalled();
  });

  it("marks which updates the viewer wrote", async () => {
    mocks.projectFindFirst.mockResolvedValue(
      projectRow({
        updates: [
          {
            id: "update-1",
            title: "Pilot run",
            body: "Ran the pilot.",
            nextUp: null,
            isPublic: false,
            stage: "ACTIVE",
            createdAt: new Date("2026-09-19T00:00:00.000Z"),
            authorId: "member-1",
            author: { slug: "a-member", name: "A Member" },
          },
          {
            id: "update-2",
            title: "Kick-off",
            body: "Started.",
            nextUp: "Collect data",
            isPublic: true,
            stage: "PROPOSED",
            createdAt: new Date("2026-09-01T00:00:00.000Z"),
            authorId: "member-2",
            author: { slug: "someone-else", name: "Someone Else" },
          },
        ],
      }),
    );

    const progress = await getProjectProgress(viewer(), "quiet-signals");

    expect(progress?.updates.map((update) => update.mine)).toEqual([
      true,
      false,
    ]);
    // The author id is an internal handle and does not leave the read model.
    expect(progress?.updates[0]).not.toHaveProperty("authorId");
  });

  it("carries the membership the page needs to decide what to offer", async () => {
    mocks.projectFindFirst.mockResolvedValue(
      projectRow({
        members: [{ role: "Principal investigator", isLead: true }],
      }),
    );

    const progress = await getProjectProgress(viewer(), "quiet-signals");

    expect(progress).toMatchObject({
      role: "Principal investigator",
      isLead: true,
      state: "DRAFT",
    });
  });
});

describe("onProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is true only for a project the viewer belongs to", async () => {
    mocks.projectMemberFindMany.mockResolvedValue([{ projectId: "project-1" }]);

    expect(await onProject(viewer(), "project-1")).toBe(true);
    expect(await onProject(viewer(), "project-2")).toBe(false);
  });
});

describe("canEditUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function update(authorId: string, membership: Array<{ isLead: boolean }>) {
    return {
      authorId,
      projectId: "project-1",
      project: { members: membership },
    };
  }

  it("lets the author change their own update", async () => {
    mocks.projectUpdateFindUnique.mockResolvedValue(
      update("member-1", [{ isLead: false }]),
    );

    expect(await canEditUpdate(viewer(), "update-1")).toEqual({
      allowed: true,
      projectId: "project-1",
    });
  });

  it("lets a project lead change anyone's update", async () => {
    mocks.projectUpdateFindUnique.mockResolvedValue(
      update("member-2", [{ isLead: true }]),
    );

    expect(await canEditUpdate(viewer(), "update-1")).toMatchObject({
      allowed: true,
    });
  });

  it("refuses a teammate who neither wrote it nor leads the project", async () => {
    mocks.projectUpdateFindUnique.mockResolvedValue(
      update("member-2", [{ isLead: false }]),
    );

    expect(await canEditUpdate(viewer(), "update-1")).toMatchObject({
      allowed: false,
    });
  });

  it("refuses someone who is not on the project at all", async () => {
    mocks.projectUpdateFindUnique.mockResolvedValue(update("member-2", []));

    expect(await canEditUpdate(viewer(), "update-1")).toMatchObject({
      allowed: false,
    });
  });

  it("refuses an update that does not exist", async () => {
    mocks.projectUpdateFindUnique.mockResolvedValue(null);

    expect(await canEditUpdate(viewer(), "missing")).toEqual({
      allowed: false,
      projectId: null,
    });
  });
});
