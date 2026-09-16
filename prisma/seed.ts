import { hashPassword } from "better-auth/crypto";

import { createPrismaClient } from "../lib/db-runtime";

const themes = [
  {
    slug: "perception",
    name: "Perception",
    gloss: "How machines see",
    sortOrder: 0,
    areas: [
      {
        slug: "computer-vision",
        name: "Computer Vision",
        summary:
          "Visual understanding, image analysis, medical imaging, segmentation, recognition, and generation.",
        sortOrder: 0,
      },
    ],
  },
  {
    slug: "language",
    name: "Language",
    gloss: "How machines read, reason, and speak",
    sortOrder: 1,
    areas: [
      {
        slug: "language-models-and-nlp",
        name: "Language Models & NLP",
        summary:
          "Language understanding, generation, retrieval, reasoning, and knowledge-intensive systems.",
        sortOrder: 0,
      },
    ],
  },
  {
    slug: "junction",
    name: "Junction",
    gloss: "Where modalities meet",
    sortOrder: 2,
    areas: [
      {
        slug: "vision-language-models",
        name: "Vision-Language Models",
        summary:
          "Models that ground language in images and images in language.",
        sortOrder: 0,
      },
      {
        slug: "multimodal-ai",
        name: "Multimodal AI",
        summary:
          "Systems that connect visual, textual, and other modalities, with a focus on multimodal understanding and reasoning.",
        sortOrder: 1,
      },
    ],
  },
  {
    slug: "understanding",
    name: "Understanding",
    gloss: "What is learned, and why it holds",
    sortOrder: 3,
    areas: [
      {
        slug: "representation-learning",
        name: "Representation Learning",
        summary:
          "Deep learning, generative models, evaluation, and new learning methods; the study of what models learn internally.",
        sortOrder: 0,
      },
      {
        slug: "causal-inference",
        name: "Causal Inference",
        summary:
          "Relationships, interventions, and mechanisms beyond correlation.",
        sortOrder: 1,
      },
    ],
  },
  {
    slug: "discovery",
    name: "Discovery",
    gloss: "Computation in service of science",
    sortOrder: 4,
    areas: [
      {
        slug: "ai-for-science",
        name: "AI for Science",
        summary:
          "Computational intelligence applied to problems in biology, medicine, and other scientific disciplines.",
        sortOrder: 0,
      },
      {
        slug: "computational-biology",
        name: "Computational Biology",
        summary:
          "Machine learning and computational approaches for biological and biomedical research.",
        sortOrder: 1,
      },
    ],
  },
] as const;

const contactSettings = {
  "contact.general": "contact@sandhiresearch.org",
  "contact.research": "research@sandhiresearch.org",
  "contact.collaborations": "collaborate@sandhiresearch.org",
  "contact.applications": "join@sandhiresearch.org",
} as const;

function slugifyName(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/\p{Mark}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "owner"
  );
}

async function seedOwner(required: boolean): Promise<void> {
  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;
  const name = process.env.SEED_OWNER_NAME?.trim() || "Asif Uddin";

  if (!email || !password) {
    if (required) {
      throw new Error(
        "SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD are required for seed:owner.",
      );
    }
    console.info("Owner seed skipped because owner credentials are not set.");
    return;
  }

  if (password.length < 12) {
    throw new Error("SEED_OWNER_PASSWORD must be at least 12 characters.");
  }

  const db = createPrismaClient();
  const passwordHash = await hashPassword(password);

  try {
    await db.$transaction(async (transaction) => {
      const user = await transaction.user.upsert({
        where: { email },
        update: { name, role: "OWNER", emailVerified: true },
        create: { name, email, role: "OWNER", emailVerified: true },
      });

      await transaction.account.upsert({
        where: {
          providerId_accountId: {
            providerId: "credential",
            accountId: user.id,
          },
        },
        update: { password: passwordHash },
        create: {
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: passwordHash,
        },
      });

      await transaction.member.upsert({
        where: { userId: user.id },
        update: {
          name,
          rank: "DIRECTOR",
          status: "ACTIVE",
          isPublic: false,
        },
        create: {
          userId: user.id,
          slug: slugifyName(name),
          name,
          rank: "DIRECTOR",
          status: "ACTIVE",
          isPublic: false,
          joinedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      });
    });
  } finally {
    await db.$disconnect();
  }
}

async function seedFoundation(): Promise<void> {
  const db = createPrismaClient();

  try {
    for (const theme of themes) {
      const storedTheme = await db.researchTheme.upsert({
        where: { slug: theme.slug },
        update: {
          name: theme.name,
          gloss: theme.gloss,
          sortOrder: theme.sortOrder,
          state: "PUBLISHED",
        },
        create: {
          slug: theme.slug,
          name: theme.name,
          gloss: theme.gloss,
          sortOrder: theme.sortOrder,
          state: "PUBLISHED",
        },
      });

      for (const area of theme.areas) {
        await db.researchArea.upsert({
          where: { slug: area.slug },
          update: {
            name: area.name,
            summary: area.summary,
            sortOrder: area.sortOrder,
            state: "PUBLISHED",
            themeId: storedTheme.id,
          },
          create: {
            ...area,
            state: "PUBLISHED",
            themeId: storedTheme.id,
          },
        });
      }
    }

    const foundingDate = new Date("2026-01-01T00:00:00.000Z");
    const existingMilestone = await db.milestone.findFirst({
      where: { title: "2026: SANDHI Research Lab founded" },
    });

    if (existingMilestone) {
      await db.milestone.update({
        where: { id: existingMilestone.id },
        data: { date: foundingDate, isPublic: true },
      });
    } else {
      await db.milestone.create({
        data: {
          date: foundingDate,
          title: "2026: SANDHI Research Lab founded",
          isPublic: true,
        },
      });
    }

    for (const [key, value] of Object.entries(contactSettings)) {
      await db.siteSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }
  } finally {
    await db.$disconnect();
  }
}

const ownerOnly = process.argv.includes("--owner-only");

if (!ownerOnly) await seedFoundation();
await seedOwner(ownerOnly);
