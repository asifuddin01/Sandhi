import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  opportunityFindMany: vi.fn(),
  researchAreaFindMany: vi.fn(),
  resourceFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    opportunity: { findMany: mocks.opportunityFindMany },
    researchArea: { findMany: mocks.researchAreaFindMany },
    resource: { findMany: mocks.resourceFindMany },
  }),
  isDatabaseConfigured: () => true,
}));

import {
  daysUntilDeadline,
  getPublicOpportunities,
  OPPORTUNITIES_EMPTY,
  OPPORTUNITIES_LEAD,
  OPPORTUNITY_KIND_LABELS,
  OPPORTUNITY_KINDS,
  opportunityClosingLabel,
} from "@/lib/public-opportunities";
import {
  getPublicResources,
  RESOURCES_EMPTY,
  RESOURCE_KIND_LABELS,
  RESOURCE_KINDS,
  safeResourceUrl,
} from "@/lib/public-resources";
import {
  isOpportunityPublic,
  publicResourceWhere,
} from "@/lib/visibility";

describe("opportunity public visibility", () => {
  const now = new Date("2026-09-16T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.opportunityFindMany.mockResolvedValue([]);
    mocks.researchAreaFindMany.mockResolvedValue([]);
    mocks.resourceFindMany.mockResolvedValue([]);
  });

  it("excludes expired opportunities and includes the deadline boundary", () => {
    expect(
      isOpportunityPublic(
        {
          state: "PUBLISHED",
          deadline: "2026-09-16T11:59:59.999Z",
        },
        now,
      ),
    ).toBe(false);
    expect(
      isOpportunityPublic(
        { state: "PUBLISHED", deadline: "2026-09-16T12:00:00.000Z" },
        now,
      ),
    ).toBe(true);
    expect(
      isOpportunityPublic(
        { state: "DRAFT", deadline: "2026-10-01T00:00:00.000Z" },
        now,
      ),
    ).toBe(false);
  });

  it("computes the required closing label by rounding partial days up", () => {
    const deadline = new Date("2026-09-18T11:00:00.000Z");
    expect(daysUntilDeadline(deadline, now)).toBe(2);
    expect(opportunityClosingLabel(deadline, now)).toBe("Closes in 2 days");
    expect(opportunityClosingLabel(now, now)).toBe("Closes in 0 days");
  });

  /**
   * The index is cached, so the query cannot carry the clock — a cached
   * entry would freeze whatever `now` was when it was filled and go on
   * offering an opportunity that had since closed. The query reads every
   * published one and `isOpportunityPublic` decides per request, which is
   * what this checks: the guarantee, not the shape of the query.
   */
  it("leaves an opportunity out once its deadline has passed", async () => {
    const row = {
      title: "Role",
      kind: "RESEARCH_POSITION",
      areaSlugs: [],
      description: "Description",
      responsibilities: [],
      requirements: [],
      duration: null,
      location: null,
      isRemote: true,
    };
    mocks.opportunityFindMany.mockResolvedValue([
      {
        ...row,
        slug: "still-open",
        deadline: new Date("2026-09-18T00:00:00.000Z"),
      },
      {
        ...row,
        slug: "closed",
        deadline: new Date("2026-09-15T00:00:00.000Z"),
      },
      { ...row, slug: "no-deadline", deadline: null },
    ]);

    const listed = await getPublicOpportunities(now);
    expect(listed.map((opportunity) => opportunity.slug)).toEqual([
      "still-open",
      "no-deadline",
    ]);

    // The query itself asks for every published one, clock and all left out.
    expect(mocks.opportunityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { state: "PUBLISHED" } }),
    );
  });

  it("resolves public areas once for the full opportunity index", async () => {
    mocks.opportunityFindMany.mockResolvedValue([
      {
        slug: "research-role",
        title: "Research role",
        kind: "RESEARCH_POSITION",
        areaSlugs: ["vision"],
        description: "Description",
        responsibilities: [],
        requirements: [],
        duration: null,
        location: null,
        isRemote: true,
        deadline: null,
      },
      {
        slug: "internship",
        title: "Internship",
        kind: "INTERNSHIP",
        areaSlugs: ["vision"],
        description: "Description",
        responsibilities: [],
        requirements: [],
        duration: null,
        location: null,
        isRemote: true,
        deadline: null,
      },
    ]);
    mocks.researchAreaFindMany.mockResolvedValue([
      { slug: "vision", name: "Computer Vision" },
    ]);

    const opportunities = await getPublicOpportunities(now);

    expect(mocks.researchAreaFindMany).toHaveBeenCalledTimes(1);
    expect(opportunities).toHaveLength(2);
    expect(opportunities[0]?.areas).toEqual([
      { slug: "vision", name: "Computer Vision" },
    ]);
  });

  it("defines all four required opportunity sections", () => {
    expect(OPPORTUNITY_KINDS).toEqual([
      "RESEARCH_POSITION",
      "INTERNSHIP",
      "COLLABORATION",
      "PROJECT_OPENING",
    ]);
    expect(
      OPPORTUNITY_KINDS.map((kind) => OPPORTUNITY_KIND_LABELS[kind]),
    ).toEqual([
      "Research positions",
      "Internships",
      "Collaborations",
      "Project-specific openings",
    ]);
  });

  it("keeps the specified opportunity lead and empty copy exact", () => {
    expect(OPPORTUNITIES_LEAD).toBe(
      "Openings for researchers, interns, and collaborators.",
    );
    expect(OPPORTUNITIES_EMPTY).toBe(
      "There are no open positions right now. You can still introduce yourself through Join SANDHI.",
    );
  });
});

describe("resource public visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resourceFindMany.mockResolvedValue([]);
  });

  it("uses the centralized published-resource predicate in the index query", async () => {
    await getPublicResources();

    expect(mocks.resourceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: publicResourceWhere }),
    );
  });

  it("defines all seven resource kinds with public labels", () => {
    expect(RESOURCE_KINDS).toEqual([
      "DATASET",
      "BENCHMARK",
      "CODE",
      "MODEL",
      "TOOL",
      "TUTORIAL",
      "REPORT",
    ]);
    expect(RESOURCE_KINDS.map((kind) => RESOURCE_KIND_LABELS[kind])).toEqual([
      "Datasets",
      "Benchmarks",
      "Code",
      "Models",
      "Tools",
      "Tutorials",
      "Technical reports",
    ]);
  });

  it("allows only http and https resource links", () => {
    expect(safeResourceUrl("https://example.org/data?id=1")).toBe(
      "https://example.org/data?id=1",
    );
    expect(safeResourceUrl("http://example.org/repository")).toBe(
      "http://example.org/repository",
    );
    expect(safeResourceUrl("javascript:alert(1)")).toBeNull();
    expect(safeResourceUrl("not a URL")).toBeNull();
  });

  it("keeps the specified resource empty copy exact", () => {
    expect(RESOURCES_EMPTY).toBe(
      "Datasets, code, and models will be released here alongside our publications.",
    );
  });
});
