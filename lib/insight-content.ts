import { escapeLatex } from "@/lib/bibtex";
import { markdownHeadingId } from "@/lib/markdown";

export const INSIGHT_KINDS = [
  "TECHNICAL_NOTE",
  "EXPLAINER",
  "TUTORIAL",
  "BENCHMARK_ANALYSIS",
  "FINDING",
  "REPRODUCIBILITY",
  "LITERATURE_REVIEW",
] as const;

export type InsightKind = (typeof INSIGHT_KINDS)[number];

export const INSIGHT_KIND_LABELS: Record<InsightKind, string> = {
  TECHNICAL_NOTE: "Technical note",
  EXPLAINER: "Explainer",
  TUTORIAL: "Tutorial",
  BENCHMARK_ANALYSIS: "Benchmark analysis",
  FINDING: "Experimental finding",
  REPRODUCIBILITY: "Reproducibility report",
  LITERATURE_REVIEW: "Literature review",
};

export interface InsightHeading {
  depth: 2 | 3;
  id: string;
  label: string;
}

function plainHeading(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/[`*_~]/gu, "")
    .trim();
}

export function extractInsightHeadings(markdown: string): InsightHeading[] {
  const headings: InsightHeading[] = [];
  const occurrences = new Map<string, number>();

  for (const match of markdown.matchAll(/^(#{2,3})\s+(.+?)\s*#*\s*$/gmu)) {
    const label = plainHeading(match[2] ?? "");
    if (!label) continue;

    const base = markdownHeadingId(label);
    const occurrence = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, occurrence);
    headings.push({
      depth: (match[1]?.length ?? 2) as 2 | 3,
      id: occurrence === 1 ? base : `${base}-${occurrence}`,
      label,
    });
  }

  return headings;
}

export function estimateInsightReadingMinutes(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/`[^`]*`/gu, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/[#>*_~|\[\]()-]/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 220));
}

function citationKey(slug: string, year: number): string {
  const safeSlug = slug.toLocaleLowerCase("en").replace(/[^a-z0-9]+/gu, "");
  return `sandhi${year}${safeSlug || "insight"}`;
}

export function generateInsightBibtex(input: {
  slug: string;
  title: string;
  authors: readonly string[];
  publishedAt: Date | null;
}): string {
  const year = input.publishedAt?.getUTCFullYear() ?? new Date().getUTCFullYear();
  const fields = [
    input.authors.length > 0
      ? `  author = {${escapeLatex(input.authors.join(" and "))}}`
      : null,
    `  title = {${escapeLatex(input.title)}}`,
    `  year = {${year}}`,
    "  publisher = {SANDHI Research Lab}",
    `  url = {https://sandhiresearch.org/insights/${encodeURIComponent(input.slug)}}`,
  ].filter((field): field is string => field !== null);

  return `@misc{${citationKey(input.slug, year)},\n${fields.join(",\n")}\n}`;
}
