import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createPrismaClient } from "../../lib/db-runtime";

import { signIn } from "./support/auth";

test.skip(
  process.env.E2E_FIXTURES_READY !== "true" || !process.env.DATABASE_URL,
  "Needs the fixture database and DATABASE_URL.",
);

async function forgetDiagrams(prefix: string) {
  const db = createPrismaClient();
  try {
    await db.diagram.deleteMany({ where: { title: { startsWith: prefix } } });
  } finally {
    await db.$disconnect();
  }
}

/**
 * The canvas is driven by pointer events, which is what unifies mouse, touch
 * and pen. Playwright's mouse sends them, so a drag here is the same sequence
 * a person's hand produces.
 */
async function dragBy(
  page: Page,
  from: { x: number; y: number },
  dx: number,
  dy: number,
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 4 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 4 });
  await page.mouse.up();
}

async function centreOf(page: Page, label: string) {
  const box = await page
    .locator(`svg[role="application"] g`, { hasText: label })
    .first()
    .boundingBox();
  if (!box) throw new Error(`No shape labelled ${label}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("a member draws on the canvas, and the Mermaid follows", async ({
  page,
}) => {
  test.slow();
  const prefix = `Fixture diagram ${Date.now()}`;

  try {
    await signIn(page, "fixture-member@sandhi.test", "/portal/diagrams");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Diagrams",
    );

    await page.getByRole("link", { name: "New diagram" }).click();
    await expect(page.locator('svg[role="application"]')).toBeVisible();

    const source = page.locator("#diagram-source");
    await expect(source).toHaveValue(/flowchart TD/u);

    // Moving a shape changes where it is, and nothing else.
    const before = await centreOf(page, "Edge");
    await dragBy(page, before, 160, 60);
    const after = await centreOf(page, "Edge");
    expect(Math.round(after.x - before.x)).toBeGreaterThan(100);
    await expect(source).toHaveValue(/edge\(\["Edge"\]\)/u);

    // A shape added from the palette appears in the text too.
    await page.getByRole("button", { name: "Hexagon" }).click();
    await expect(source).toHaveValue(/\{\{"Hexagon"\}\}/u);

    // The style panel edits the selection.
    await expect(
      page.getByRole("complementary", { name: "Shape style" }),
    ).toBeVisible();
    await page.getByLabel("Text", { exact: true }).fill("Message queue");
    await expect(source).toHaveValue(/\{\{"Message queue"\}\}/u);

    await page.getByLabel("Shape", { exact: true }).selectOption("cylinder");
    await expect(source).toHaveValue(/\[\("Message queue"\)\]/u);

    // Saving keeps the name, the text, and where everything was put.
    await page.getByLabel("Name").fill(prefix);
    await page.getByRole("button", { name: "Save diagram" }).click();
    // `new` is also one path segment, so it has to be excluded explicitly.
    await page.waitForURL(/\/portal\/diagrams\/(?!new$)[^/]+$/u, {
      timeout: 30_000,
    });

    const saved = new URL(page.url()).pathname;
    await page.goto(saved);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(prefix);
    await expect(page.locator("#diagram-source")).toHaveValue(
      /\[\("Message queue"\)\]/u,
    );

    // The position survived the round trip, not just the text.
    const reopened = await centreOf(page, "Edge");
    expect(Math.abs(reopened.x - after.x)).toBeLessThan(4);

    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.map(({ id }) => id)).toEqual([]);
  } finally {
    await forgetDiagrams(prefix);
  }
});

test("pasted Mermaid is laid out, and bad Mermaid is explained", async ({
  page,
}) => {
  await signIn(page, "fixture-member@sandhi.test", "/portal/diagrams/new");

  await page.locator("#diagram-source").fill(`flowchart LR
  one["One"] --> two["Two"]
  two --> three["Three"]
`);
  // Mermaid carries no coordinates, so the pasted diagram gets positions.
  await expect(
    page.locator('svg[role="application"] g', { hasText: "Three" }).first(),
  ).toBeVisible();
  const one = await centreOf(page, "One");
  const two = await centreOf(page, "Two");
  expect(two.x).toBeGreaterThan(one.x);

  await page.locator("#diagram-source").fill("sequenceDiagram\n  A->>B: hi");
  await expect(
    page.getByText(/Visual editing understands flowcharts/u),
  ).toBeVisible();
});

test("a diagram belongs to whoever made it", async ({ page }) => {
  const prefix = `Fixture private ${Date.now()}`;
  const db = createPrismaClient();
  let id = "";
  try {
    const owner = await db.member.findFirst({
      where: { user: { email: "fixture-staff@sandhi.test" } },
      select: { id: true },
    });
    const made = await db.diagram.create({
      data: {
        title: prefix,
        source: 'flowchart TD\n  a["A"]\n',
        ownerId: owner!.id,
      },
      select: { id: true },
    });
    id = made.id;
    await db.$disconnect();

    // Someone else's diagram, with no project between them, is not there.
    await signIn(page, "fixture-member@sandhi.test", "/portal/diagrams");
    await expect(page.getByText(prefix)).toHaveCount(0);
    expect((await page.request.get(`/portal/diagrams/${id}`)).status()).toBe(
      404,
    );
  } finally {
    const cleanup = createPrismaClient();
    await cleanup.diagram.deleteMany({
      where: { title: { startsWith: prefix } },
    });
    await cleanup.$disconnect();
  }
});

test("a signed-out visitor cannot reach the diagrams at all", async ({
  request,
}) => {
  const response = await request.get("/portal/diagrams", {
    maxRedirects: 0,
  });
  expect([302, 307]).toContain(response.status());
  expect(response.headers().location).toContain("/portal/sign-in");
});
