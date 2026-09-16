export type PublicMetricCounts = {
  researchers: number;
  projects: number;
  publications: number;
  areas: number;
};

export function shouldShowPublicMetrics(
  enabled: boolean,
  counts: PublicMetricCounts,
): boolean {
  return (
    enabled &&
    counts.publications >= 3 &&
    Object.values(counts).every((value) => value >= 1)
  );
}
