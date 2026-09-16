import { ViewTransition, type ReactElement } from "react";

export type EntityKind = "project" | "publication";

interface SharedEntityTitleProps {
  children: ReactElement;
  kind: EntityKind;
  slug: string;
}

export function entityTitleTransitionName(kind: EntityKind, slug: string) {
  return `entity-title-${kind}-${slug}`;
}

/**
 * Preserves an entity title when the same project or publication moves from a
 * list entry to its detail heading. Browsers without View Transitions render
 * the child normally.
 */
export function SharedEntityTitle({
  children,
  kind,
  slug,
}: SharedEntityTitleProps) {
  return (
    <ViewTransition
      name={entityTitleTransitionName(kind, slug)}
      default="none"
      share="entity-title-share"
    >
      {children}
    </ViewTransition>
  );
}
