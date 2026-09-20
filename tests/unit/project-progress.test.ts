import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  projectMemberFindMany: vi.fn(),
  projectMemberFindUnique: vi.fn(),
  projectUpdateFindUnique: vi.fn(),
  projectSectionFindUnique: vi.fn(),
  taskFindUnique: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    project: { findFirst: mocks.projectFindFirst },
    projectMember: {
      findMany: mocks.projectMemberFindMany,
      findUnique: mocks.projectMemberFindUnique,
    },
    projectUpdate: { findUnique: mocks.projectUpdateFindUnique },
    projectSection: { findUnique: mocks.projectSectionFindUnique },
    task: { findUnique: mocks.taskFindUnique },
  }),
  isDatabaseConfigured: () => true,
}));

import type { Viewer } from "@/lib/authz";
import {
  canEditSection,
  canEditUpdate,
  getProjectProgress,
  leadsProject,
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
    members: [
      {
        memberId: "member-1",
        role: "Researcher",
        isLead: false,
        isAssistantLead: false,
        member: { slug: "a-member", name: "A Member" },
      },
    ],
    tasks: [],
    sections: [],
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
        members: [
          {
            memberId: "member-1",
            role: "Principal investigator",
            isLead: true,
            isAssistantLead: false,
            member: { slug: "a-member", name: "A Member" },
          },
          {
            memberId: "member-2",
            role: "Researcher",
            isLead: false,
            isAssistantLead: true,
            member: { slug: "someone-else", name: "Someone Else" },
          },
        ],
      }),
    );

    const progress = await getProjectProgress(viewer(), "quiet-signals");

    expect(progress).toMatchObject({
      role: "Principal investigator",
      isLead: true,
      leads: true,
      state: "DRAFT",
    });
    // The whole team travels, marked so the page knows which row is the
    // viewer's own and cannot offer them controls over themselves.
    expect(progress?.team).toEqual([
      {
        memberId: "member-1",
        slug: "a-member",
        name: "A Member",
        role: "Principal investigator",
        isLead: true,
        isAssistantLead: false,
        isMe: true,
      },
      {
        memberId: "member-2",
        slug: "someone-else",
        name: "Someone Else",
        role: "Researcher",
        isLead: false,
        isAssistantLead: true,
        isMe: false,
      },
    ]);
  });

  it("counts an assistant lead as leading, and a plain member as not", async () => {
    const membership = (extra: Record<string, unknown>) =>
      projectRow({
        members: [
          {
            memberId: "member-1",
            role: "Researcher",
            isLead: false,
            isAssistantLead: false,
            member: { slug: "a-member", name: "A Member" },
            ...extra,
          },
        ],
      });

    mocks.projectFindFirst.mockResolvedValue(membership({}));
    expect((await getProjectProgress(viewer(), "quiet-signals"))?.leads).toBe(
      false,
    );

    mocks.projectFindFirst.mockResolvedValue(
      membership({ isAssistantLead: true }),
    );
    expect((await getProjectProgress(viewer(), "quiet-signals"))?.leads).toBe(
      true,
    );
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

describe("who leads a project", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is the research lead", async () => {
    mocks.projectMemberFindUnique.mockResolvedValue({
      isLead: true,
      isAssistantLead: false,
    });
    expect(await leadsProject(viewer(), "project-1")).toBe(true);
  });

  it("is an assistant research lead, who does everything the lead does", async () => {
    mocks.projectMemberFindUnique.mockResolvedValue({
      isLead: false,
      isAssistantLead: true,
    });
    expect(await leadsProject(viewer(), "project-1")).toBe(true);
  });

  it("is not an ordinary member of the team", async () => {
    mocks.projectMemberFindUnique.mockResolvedValue({
      isLead: false,
      isAssistantLead: false,
    });
    expect(await leadsProject(viewer(), "project-1")).toBe(false);
  });

  it("is nobody who is not on the project, or has no lab profile", async () => {
    mocks.projectMemberFindUnique.mockResolvedValue(null);
    expect(await leadsProject(viewer(), "project-1")).toBe(false);

    expect(await leadsProject(viewer(null), "project-1")).toBe(false);
    expect(
      await leadsProject(viewer({ status: "SUSPENDED" }), "project-1"),
    ).toBe(false);
  });
});

describe("canEditSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets anyone on the project change the shared account of the work", async () => {
    // A section is not one person's post, unlike an update, so it is not
    // owned the way an update is.
    mocks.projectSectionFindUnique.mockResolvedValue({
      projectId: "project-1",
      project: { members: [{ memberId: "member-1" }] },
    });

    expect(await canEditSection(viewer(), "section-1")).toEqual({
      allowed: true,
      projectId: "project-1",
    });
  });

  it("refuses someone who is not on the project", async () => {
    mocks.projectSectionFindUnique.mockResolvedValue({
      projectId: "project-1",
      project: { members: [] },
    });

    expect(await canEditSection(viewer(), "section-1")).toMatchObject({
      allowed: false,
    });
  });
});
