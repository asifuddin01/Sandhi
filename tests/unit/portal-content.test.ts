import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  memberFindUnique: vi.fn(),
  projectMemberFindMany: vi.fn(),
  announcementFindMany: vi.fn(),
  documentFindMany: vi.fn(),
  createPrivateDownloadUrl: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    member: { findUnique: mocks.memberFindUnique },
    projectMember: { findMany: mocks.projectMemberFindMany },
    announcement: { findMany: mocks.announcementFindMany },
    document: { findMany: mocks.documentFindMany },
  }),
  isDatabaseConfigured: () => true,
}));

vi.mock("@/lib/storage", () => ({
  createPrivateDownloadUrl: mocks.createPrivateDownloadUrl,
}));

import type { Viewer } from "@/lib/authz";
import {
  getMemberAnnouncements,
  getMemberDocuments,
  getMemberProjects,
  memberProjectIds,
  workspaceMemberId,
} from "@/lib/portal-content";

function viewer(overrides: Partial<Viewer["member"]> | null = {}): Viewer {
  return {
    userId: "user-1",
    sessionId: "session-1",
    sessionCreatedAt: new Date(),
    email: "member@sandhi.test",
    name: "A Member",
    role: "MEMBER",
    twoFactorEnabled: false,
    secondFactor: true,
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

describe("workspaceMemberId", () => {
  it("is the member id for an active member", () => {
    expect(workspaceMemberId(viewer())).toBe("member-1");
    expect(workspaceMemberId(viewer({ status: "ALUMNI" }))).toBe("member-1");
  });

  it("is nothing for an account with no member record, or a suspended one", () => {
    expect(workspaceMemberId(viewer(null))).toBeNull();
    expect(workspaceMemberId(viewer({ status: "SUSPENDED" }))).toBeNull();
  });
});

describe("the member workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.projectMemberFindMany.mockResolvedValue([]);
    mocks.announcementFindMany.mockResolvedValue([]);
    mocks.documentFindMany.mockResolvedValue([]);
    mocks.createPrivateDownloadUrl.mockReturnValue("https://signed.example/x");
  });

  it("reads nothing at all for an account with no member record", async () => {
    const account = viewer(null);
    await expect(getMemberProjects(account)).resolves.toEqual([]);
    await expect(getMemberAnnouncements(account)).resolves.toEqual([]);
    await expect(getMemberDocuments(account)).resolves.toEqual([]);
    expect(mocks.projectMemberFindMany).not.toHaveBeenCalled();
    expect(mocks.announcementFindMany).not.toHaveBeenCalled();
    expect(mocks.documentFindMany).not.toHaveBeenCalled();
  });

  it("keys every query on the viewer's own member id", async () => {
    await memberProjectIds(viewer());
    expect(mocks.projectMemberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { memberId: "member-1" } }),
    );
  });

  it("lists the viewer's projects whatever their publish state", async () => {
    mocks.projectMemberFindMany.mockResolvedValue([
      {
        role: "Lead",
        isLead: true,
        project: {
          id: "project-1",
          slug: "draft-project",
          title: "Draft project",
          gloss: "g",
          status: "ACTIVE",
          state: "DRAFT",
          startedAt: null,
          endedAt: null,
        },
      },
    ]);
    await expect(getMemberProjects(viewer())).resolves.toEqual([
      expect.objectContaining({
        slug: "draft-project",
        state: "DRAFT",
        role: "Lead",
        isLead: true,
      }),
    ]);
  });

  it("marks an announcement read from the viewer's own entry", async () => {
    mocks.announcementFindMany.mockResolvedValue([
      {
        id: "a1",
        title: "Seen",
        body: "b",
        pinned: true,
        createdAt: new Date(),
        readBy: ["member-1", "member-2"],
        author: null,
      },
      {
        id: "a2",
        title: "Unseen",
        body: "b",
        pinned: false,
        createdAt: new Date(),
        readBy: ["member-2"],
        author: null,
      },
    ]);
    const announcements = await getMemberAnnouncements(viewer());
    expect(announcements.map((item) => item.read)).toEqual([true, false]);
    // The other members' read list never leaves the server.
    expect(announcements[0]).not.toHaveProperty("readBy");
  });

  it("caps how many announcements one request can ask for", async () => {
    await getMemberAnnouncements(viewer(), 5000);
    expect(mocks.announcementFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it("asks only for documents on projects the viewer belongs to", async () => {
    mocks.projectMemberFindMany.mockResolvedValue([
      { projectId: "project-1" },
      { projectId: "project-2" },
    ]);
    await getMemberDocuments(viewer(), { projectSlug: "other-lab-project" });

    expect(mocks.documentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: { in: ["project-1", "project-2"] },
          project: { slug: "other-lab-project" },
        },
      }),
    );
  });

  it("never signs a link for a viewer with no projects", async () => {
    mocks.projectMemberFindMany.mockResolvedValue([]);
    await expect(getMemberDocuments(viewer())).resolves.toEqual([]);
    expect(mocks.documentFindMany).not.toHaveBeenCalled();
    expect(mocks.createPrivateDownloadUrl).not.toHaveBeenCalled();
  });

  it("signs private files and leaves external links alone", async () => {
    mocks.projectMemberFindMany.mockResolvedValue([{ projectId: "project-1" }]);
    mocks.documentFindMany.mockResolvedValue([
      {
        id: "d1",
        title: "Protocol",
        fileKey: "documents/project-1/protocol.pdf",
        url: null,
        createdAt: new Date(),
        project: { slug: "p", title: "P" },
        uploadedBy: null,
      },
      {
        id: "d2",
        title: "Shared sheet",
        fileKey: null,
        url: "https://example.org/sheet",
        createdAt: new Date(),
        project: { slug: "p", title: "P" },
        uploadedBy: null,
      },
    ]);

    const documents = await getMemberDocuments(viewer());
    expect(documents[0]).toMatchObject({
      url: "https://signed.example/x",
      expiring: true,
    });
    expect(documents[1]).toMatchObject({
      url: "https://example.org/sheet",
      expiring: false,
    });
    // The storage key itself is never handed to the client.
    expect(JSON.stringify(documents)).not.toContain("documents/project-1");
  });

  it("still lists a document when storage cannot sign a link", async () => {
    mocks.projectMemberFindMany.mockResolvedValue([{ projectId: "project-1" }]);
    mocks.createPrivateDownloadUrl.mockImplementation(() => {
      throw new Error("R2 is not configured");
    });
    mocks.documentFindMany.mockResolvedValue([
      {
        id: "d1",
        title: "Protocol",
        fileKey: "documents/project-1/protocol.pdf",
        url: null,
        createdAt: new Date(),
        project: { slug: "p", title: "P" },
        uploadedBy: null,
      },
    ]);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getMemberDocuments(viewer())).resolves.toEqual([
      expect.objectContaining({ url: null, expiring: false }),
    ]);
  });
});
