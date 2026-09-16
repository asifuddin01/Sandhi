import { expect, test, type APIRequestContext } from "@playwright/test";

interface GraphNode {
  id: string;
  kind: "theme" | "area" | "project" | "person" | "publication";
  label: string;
  href: string;
  themeSlugs: string[];
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  themes: Array<{ slug: string; name: string }>;
  summary: string;
  sparse: boolean;
}

async function fetchGraph(request: APIRequestContext): Promise<GraphData> {
  const response = await request.get("/api/graph");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(response.headers()["cache-control"]).toContain("max-age=60");
  return (await response.json()) as GraphData;
}

test("the graph API returns a referentially complete public graph", async ({
  request,
}) => {
  const graph = await fetchGraph(request);
  const nodeIds = new Set(graph.nodes.map((node) => node.id));

  expect(graph.nodes.length).toBeGreaterThan(0);
  expect(graph.themes.length).toBeGreaterThan(0);
  expect(graph.summary).toMatch(/^SANDHI research connections map\./u);
  expect(new Set(graph.nodes.map((node) => node.id)).size).toBe(
    graph.nodes.length,
  );
  expect(new Set(graph.edges.map((edge) => edge.id)).size).toBe(
    graph.edges.length,
  );

  for (const node of graph.nodes) {
    expect(node.href).toMatch(
      /^\/(?:research|projects|people|publications)\//u,
    );
    expect(node.themeSlugs.length).toBeGreaterThan(0);
  }

  for (const edge of graph.edges) {
    expect(nodeIds.has(edge.source)).toBe(true);
    expect(nodeIds.has(edge.target)).toBe(true);
  }
});

test("the map exposes pointer details and a keyboard-readable list containing every relationship", async ({
  page,
  request,
}) => {
  const graph = await fetchGraph(request);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/research");

  const map = page.getByRole("img", {
    name: /SANDHI research connections map\./u,
  });
  await expect(map).toBeVisible();

  await map.locator("g[data-kind] circle").first().click();
  await expect(
    page.getByRole("complementary").getByRole("heading", { level: 3 }),
  ).toHaveText(graph.nodes[0].label);

  await page.getByRole("button", { name: "View as list" }).click();
  const list = page.locator('[aria-label="Research connections list"]');
  await expect(list).toBeVisible();
  await expect(list.locator(":scope > ul > li > ul > li")).toHaveCount(
    graph.edges.length * 2,
  );

  for (const node of graph.nodes) {
    await expect(
      list.getByRole("link", { name: node.label, exact: true }).first(),
    ).toBeVisible();
  }

  const firstListLink = list.getByRole("link").first();
  await firstListLink.focus();
  await expect(firstListLink).toBeFocused();
});

test("a sparse graph uses the required note and contains themes and areas only", async ({
  page,
  request,
}) => {
  const graph = await fetchGraph(request);
  test.skip(
    !graph.sparse,
    "The configured database has eight or more public graph entities.",
  );

  expect(
    graph.nodes.every((node) => ["theme", "area"].includes(node.kind)),
  ).toBe(true);
  await page.goto("/research");
  await expect(
    page.getByText(
      "Projects and papers will appear here as they are published.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
});

test.describe("connections without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the complete nested relationship list readable", async ({
    page,
    request,
  }) => {
    const graph = await fetchGraph(request);
    const response = await page.goto("/research");

    expect(response?.ok()).toBe(true);
    const list = page.locator('[aria-label="Research connections list"]');
    await expect(list).toBeVisible();
    await expect(list.locator(":scope > ul > li > ul > li")).toHaveCount(
      graph.edges.length * 2,
    );
    await expect(page.getByRole("img")).toHaveCount(0);
  });
});
