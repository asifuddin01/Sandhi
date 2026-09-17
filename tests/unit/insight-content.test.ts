import { describe, expect, it } from "vitest";

import {
  estimateInsightReadingMinutes,
  extractInsightHeadings,
  generateInsightBibtex,
} from "@/lib/insight-content";

describe("insight reading helpers", () => {
  it("extracts unique h2/h3 anchors for the desktop table of contents", () => {
    expect(
      extractInsightHeadings(
        "# Title\n\n## Method\n\n### Setup\n\n## Method\n\n#### Not included",
      ),
    ).toEqual([
      { depth: 2, id: "method", label: "Method" },
      { depth: 3, id: "setup", label: "Setup" },
      { depth: 2, id: "method-2", label: "Method" },
    ]);
  });

  it("reports at least one minute and excludes fenced code from prose time", () => {
    expect(estimateInsightReadingMinutes("A short note.")).toBe(1);
    expect(
      estimateInsightReadingMinutes(
        `A short note.\n\n\`\`\`txt\n${"token ".repeat(800)}\n\`\`\``,
      ),
    ).toBe(1);
  });

  it("creates a deterministic note citation", () => {
    const bibtex = generateInsightBibtex({
      slug: "measuring-errors",
      title: "Measuring errors & uncertainty",
      authors: ["Asha Sen", "Rafi Noor"],
      publishedAt: new Date("2026-09-16T00:00:00.000Z"),
    });

    expect(bibtex).toContain("@misc{sandhi2026measuringerrors");
    expect(bibtex).toContain("author = {Asha Sen and Rafi Noor}");
    expect(bibtex).toContain("Measuring errors \\& uncertainty");
    expect(bibtex).toContain(
      "url = {https://sandhiresearch.org/insights/measuring-errors}",
    );
  });
});
