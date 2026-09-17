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

  await page.getByRole("button", { name: "View as map" }).click();
  const restoredMap = page.getByRole("img", {
    name: /SANDHI research connections map\./u,
  });
  await expect(restoredMap).toBeVisible();
  await expect
    .poll(async () =>
      restoredMap.evaluate((element) => {
        const svg = element as unknown as SVGSVGElement;
        return Math.abs(
          svg.viewBox.baseVal.width - svg.getBoundingClientRect().width,
        );
      }),
    )
    .toBeLessThanOrEqual(2);
});

test("the map aligns each layer and sends signals only when motion is allowed", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/research");
  const map = page.getByRole("img", {
    name: /SANDHI research connections map\./u,
  });
  await map.scrollIntoViewIfNeeded();

  const columnsPerKind = await map.evaluate((element) => {
    const columns = new Map<string, Set<number>>();
    for (const group of element.querySelectorAll<SVGGElement>("g[data-kind]")) {
      const x = group.transform.baseVal.consolidate()?.matrix.e;
      const kind = group.dataset.kind!;
      columns.set(kind, (columns.get(kind) ?? new Set()).add(Number(x)));
    }
    return [...columns.values()].map((positions) => positions.size);
  });
  expect(columnsPerKind.length).toBeGreaterThan(1);
  expect(columnsPerKind.every((count) => count === 1)).toBe(true);

  const signals = map.locator('g[data-layer="signals"] > g');
  await expect
    .poll(() => signals.count(), { timeout: 10_000 })
    .toBeGreaterThan(0);
  await expect
    .poll(() => map.locator('g[data-firing="true"]').count(), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await map.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2_500);
  await expect(signals).toHaveCount(0);
  await expect(map.locator('g[data-firing="true"]')).toHaveCount(0);
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
  test.skip(
    !graph.nodes.some((node) => node.kind === "theme") ||
      !graph.nodes.some((node) => node.kind === "area"),
    "Column spacing requires at least one theme and one research area.",
  );

  expect(
    graph.nodes.every((node) => ["theme", "area"].includes(node.kind)),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/research");
  await expect(
    page.getByText(
      "Projects and papers will appear here as they are published.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();

  const map = page.getByRole("img", {
    name: /SANDHI research connections map\./u,
  });
  const layout = await map.evaluate((element) => {
    const svg = element as unknown as SVGSVGElement;
    const xPositions = (kind: string) =>
      Array.from(svg.querySelectorAll<SVGGElement>(`g[data-kind="${kind}"]`))
        .map((node) => node.transform.baseVal.consolidate()?.matrix.e)
        .filter((position): position is number => position !== undefined);
    const themePositions = xPositions("theme");
    const areaPositions = xPositions("area");

    const shell = svg.closest("div")!.parentElement!;
    const panel = shell.querySelector("aside")!;

    return {
      gap: Math.min(...areaPositions) - Math.max(...themePositions),
      drawingWidth: svg.getBoundingClientRect().width,
      panelWidth: panel.getBoundingClientRect().width,
      labelFontSize: Number.parseFloat(
        window.getComputedStyle(svg.querySelector("g[data-kind] text")!)
          .fontSize,
      ),
    };
  });

  // Two layers sit a readable gap apart instead of stretching across the
  // width; the detail panel receives the room the drawing does not need.
  expect(layout.gap).toBeGreaterThanOrEqual(128);
  expect(layout.gap).toBeLessThanOrEqual(300.5);
  expect(layout.panelWidth).toBeGreaterThanOrEqual(288);
  expect(layout.drawingWidth).toBeLessThan(760);
  expect(layout.labelFontSize).toBeGreaterThanOrEqual(13);
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
