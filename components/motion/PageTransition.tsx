import { ViewTransition, type ReactNode } from "react";

/**
 * A route-level crossfade. Next.js navigations are React transitions, so the
 * browser animates this boundary when supported and otherwise swaps normally.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition name="sandhi-page" default="none" update="page-crossfade">
      {children}
    </ViewTransition>
  );
}
