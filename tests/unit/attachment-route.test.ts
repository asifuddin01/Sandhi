import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  attachmentFindUnique: vi.fn(),
  projectMemberFindUnique: vi.fn(),
  getViewer: vi.fn(),
  createPrivateDownloadUrl: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    updateAttachment: { findUnique: mocks.attachmentFindUnique },
    projectMember: { findUnique: mocks.projectMemberFindUnique },
  }),
  isDatabaseConfigured: () => true,
}));

vi.mock("@/lib/authz", () => ({ getViewer: mocks.getViewer }));

vi.mock("@/lib/storage", () => ({
  createPrivateDownloadUrl: mocks.createPrivateDownloadUrl,
  PRIVATE_DOWNLOAD_SECONDS: 600,
}));

import { GET } from "@/app/files/updates/[id]/route";

function attachment(overrides: { isPublic: boolean; state: string }) {
  return {
    fileKey: "projects/updates/x/figure.png",
    contentType: "image/png",
    update: {
      isPublic: overrides.isPublic,
      projectId: "project-1",
      project: { state: overrides.state },
    },
  };
}

function viewer(memberId: string | null) {
  return {
    userId: "user-1",
    sessionId: "session-1",
    sessionCreatedAt: new Date(),
    email: "member@sandhi.test",
    name: "A Member",
    role: "MEMBER" as const,
    twoFactorEnabled: false,
    member: memberId
      ? {
          id: memberId,
          slug: "a-member",
          name: "A Member",
          rank: "RESEARCHER",
          status: "ACTIVE",
        }
      : null,
  };
}

async function get() {
  return GET(new Request("http://localhost/files/updates/file-1"), {
    params: Promise.resolve({ id: "file-1" }),
  });
}

describe("reading one attachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPrivateDownloadUrl.mockReturnValue("https://signed.example/x");
  });

  it("sends anyone to the file when the update and its project are public", async () => {
    mocks.attachmentFindUnique.mockResolvedValue(
      attachment({ isPublic: true, state: "PUBLISHED" }),
    );
    mocks.getViewer.mockResolvedValue(null);

    const response = await get();

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://signed.example/x");
    expect(mocks.getViewer).not.toHaveBeenCalled();
  });

  it("refuses a published update on a project that is not published", async () => {
    // Both halves matter: a note marked public on a draft project is not one.
    mocks.attachmentFindUnique.mockResolvedValue(
      attachment({ isPublic: true, state: "DRAFT" }),
    );
    mocks.getViewer.mockResolvedValue(null);

    expect((await get()).status).toBe(404);
  });

  it("refuses a signed-out reader an internal attachment", async () => {
    mocks.attachmentFindUnique.mockResolvedValue(
      attachment({ isPublic: false, state: "PUBLISHED" }),
    );
    mocks.getViewer.mockResolvedValue(null);

    expect((await get()).status).toBe(404);
  });

  it("refuses a member who is not on that project", async () => {
    mocks.attachmentFindUnique.mockResolvedValue(
      attachment({ isPublic: false, state: "PUBLISHED" }),
    );
    mocks.getViewer.mockResolvedValue(viewer("member-1"));
    mocks.projectMemberFindUnique.mockResolvedValue(null);

    const response = await get();

    expect(response.status).toBe(404);
    expect(mocks.createPrivateDownloadUrl).not.toHaveBeenCalled();
  });

  it("lets someone on the project read their team's internal attachment", async () => {
    mocks.attachmentFindUnique.mockResolvedValue(
      attachment({ isPublic: false, state: "PUBLISHED" }),
    );
    mocks.getViewer.mockResolvedValue(viewer("member-1"));
    mocks.projectMemberFindUnique.mockResolvedValue({ memberId: "member-1" });

    const response = await get();

    expect(response.status).toBe(302);
    // Nothing internal is cached: withdrawing it must take effect at once.
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers the same way for a file that does not exist", async () => {
    mocks.attachmentFindUnique.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });
});
