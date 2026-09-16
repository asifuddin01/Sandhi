import Link from "next/link";

import styles from "./ConnectionsMini.module.css";

export interface MiniConnection {
  label: string;
  href: string;
}

export interface MiniConnectionGroup {
  label: string;
  connections: MiniConnection[];
}

export function ConnectionsMini({
  center,
  groups,
}: {
  center: MiniConnection;
  groups: MiniConnectionGroup[];
}) {
  const visibleGroups = groups.filter((group) => group.connections.length > 0);
  const relationshipCount = visibleGroups.reduce(
    (total, group) => total + group.connections.length,
    0,
  );

  if (relationshipCount === 0) return null;

  return (
    <figure
      className={styles.figure}
      aria-label={`${center.label} connects to ${relationshipCount} public ${
        relationshipCount === 1 ? "record" : "records"
      }.`}
    >
      <div className={styles.center}>
        <Link href={center.href}>{center.label}</Link>
      </div>
      <div className={styles.groups}>
        {visibleGroups.map((group) => (
          <section className={styles.group} key={group.label}>
            <h3>{group.label}</h3>
            <ul>
              {group.connections.map((connection) => (
                <li key={`${group.label}-${connection.href}`}>
                  <Link href={connection.href}>{connection.label}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </figure>
  );
}
