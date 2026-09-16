import { createPrismaClient } from "../lib/db-runtime";

function assertFixtureDatabase(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Fixture data is disabled when NODE_ENV=production.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");

  const host = new URL(databaseUrl).hostname.toLowerCase();
  const productionMarkers = [
    "sandhiresearch.org",
    "neon.tech",
    "production",
    "prod-db",
  ];

  if (productionMarkers.some((marker) => host.includes(marker))) {
    throw new Error(`Fixture data is disabled for database host ${host}.`);
  }
}

async function main(): Promise<void> {
  assertFixtureDatabase();
  const db = createPrismaClient();

  try {
    const area = await db.researchArea.findFirst({
      where: { state: "PUBLISHED" },
      orderBy: { sortOrder: "asc" },
    });

    if (!area) {
      throw new Error("Run pnpm seed before pnpm seed:fixtures.");
    }

    const member = await db.member.upsert({
      where: { slug: "fixture-researcher-a" },
      update: {},
      create: {
        slug: "fixture-researcher-a",
        name: "Fixture Researcher A",
        rank: "RESEARCHER",
        status: "ACTIVE",
        isPublic: true,
        interests: [area.name],
        areas: { create: { areaId: area.id } },
      },
    });

    const privateMember = await db.member.upsert({
      where: { slug: "fixture-private-researcher" },
      update: { isPublic: false },
      create: {
        slug: "fixture-private-researcher",
        name: "Fixture Private Researcher",
        rank: "RESEARCHER",
        status: "ACTIVE",
        isPublic: false,
        interests: [area.name],
        areas: { create: { areaId: area.id } },
      },
    });

    const project = await db.project.upsert({
      where: { slug: "fixture-public-project" },
      update: {},
      create: {
        slug: "fixture-public-project",
        title: "[Fixture] Public project",
        gloss: "Fixture content used only by automated tests.",
        abstract: "Fixture content used only by automated tests.",
        question: "Can fixture visibility be tested safely?",
        status: "ACTIVE",
        state: "PUBLISHED",
        featured: true,
        results: "Private fixture result.",
        resultsPublic: false,
        areas: { create: { areaId: area.id } },
        members: {
          create: {
            memberId: member.id,
            role: "Fixture researcher",
            isLead: true,
          },
        },
      },
    });

    await db.project.upsert({
      where: { slug: "fixture-private-project" },
      update: {},
      create: {
        slug: "fixture-private-project",
        title: "[Fixture] Private project",
        gloss: "Fixture content used only by automated tests.",
        abstract: "Fixture content used only by automated tests.",
        question: "Does unpublished fixture content stay private?",
        status: "PROPOSED",
        state: "DRAFT",
      },
    });

    await db.publication.upsert({
      where: { slug: "fixture-publication" },
      update: {},
      create: {
        slug: "fixture-publication",
        title: "[Fixture] Visibility testing",
        abstract: "Fixture content used only by automated tests.",
        type: "PREPRINT",
        stage: "SUBMITTED",
        state: "PUBLISHED",
        arxivId: "fixture:0000.00000",
        projectId: project.id,
        authors: {
          create: { position: 0, memberId: member.id },
        },
        areas: { create: { areaId: area.id } },
      },
    });

    await db.publication.upsert({
      where: { slug: "fixture-private-publication" },
      update: { state: "DRAFT" },
      create: {
        slug: "fixture-private-publication",
        title: "[Fixture] Private publication",
        abstract: "Fixture content used only by automated tests.",
        type: "JOURNAL",
        stage: "DRAFT",
        state: "DRAFT",
        authors: {
          create: { position: 0, memberId: privateMember.id },
        },
        areas: { create: { areaId: area.id } },
      },
    });

    await db.newsPost.upsert({
      where: { slug: "fixture-private-news" },
      update: { state: "DRAFT" },
      create: {
        slug: "fixture-private-news",
        title: "[Fixture] Private news",
        excerpt: "Fixture content used only by automated tests.",
        body: "Fixture content used only by automated tests.",
        category: "RESEARCH",
        state: "DRAFT",
      },
    });

    await db.siteSetting.upsert({
      where: { key: "features.showNumbers" },
      update: { value: true },
      create: { key: "features.showNumbers", value: true },
    });
  } finally {
    await db.$disconnect();
  }
}

await main();
