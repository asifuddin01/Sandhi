import styles from "./Entries.module.css";

function relationshipLabel(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function ProjectRelationshipThreads({
  areaCount,
  researcherCount,
}: {
  areaCount: number;
  researcherCount: number;
}) {
  const relationships = [
    areaCount > 0
      ? {
          kind: "areas",
          label: relationshipLabel(areaCount, "area"),
        }
      : null,
    researcherCount > 0
      ? {
          kind: "researchers",
          label: relationshipLabel(researcherCount, "researcher"),
        }
      : null,
  ].filter((relationship) => relationship !== null);

  if (relationships.length === 0) return null;

  return (
    <div className={styles.projectRelationships} aria-hidden="true">
      {relationships.map((relationship) => (
        <div
          className={styles.relationshipBranch}
          data-relationship-kind={relationship.kind}
          key={relationship.kind}
        >
          <span className={styles.relationshipTrack}>
            <span className={styles.relationshipActive} />
            <span className={styles.relationshipEndpoint} />
          </span>
          <span className={styles.relationshipLabel}>{relationship.label}</span>
        </div>
      ))}
    </div>
  );
}
