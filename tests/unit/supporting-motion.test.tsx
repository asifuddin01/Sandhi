import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { publicationFilterHref } from "@/components/entries/PublicationFilterForm";
import { ProjectRelationshipThreads } from "@/components/entries/ProjectRelationshipThreads";
import { entityTitleTransitionName } from "@/components/motion/SharedEntityTitle";

describe("supporting motion primitives", () => {
  it("keeps publication filters shareable while omitting blank controls", () => {
    const formData = new FormData();
    formData.set("q", " causal inference ");
    formData.set("year", "2026");
    formData.set("venue", "");

    expect(publicationFilterHref(formData)).toBe(
      "/publications?q=causal+inference&year=2026",
    );
  });

  it("uses a stable shared-title identity for the same entity", () => {
    expect(entityTitleTransitionName("publication", "joined-systems")).toBe(
      "entity-title-publication-joined-systems",
    );
  });

  it("draws relationship branches from actual project links", () => {
    const html = renderToStaticMarkup(
      <ProjectRelationshipThreads areaCount={2} researcherCount={1} />,
    );

    expect(html).toContain('data-relationship-kind="areas"');
    expect(html).toContain("2 areas");
    expect(html).toContain('data-relationship-kind="researchers"');
    expect(html).toContain("1 researcher");
  });

  it("renders no connector when a project has no linked relationships", () => {
    expect(
      renderToStaticMarkup(
        <ProjectRelationshipThreads areaCount={0} researcherCount={0} />,
      ),
    ).toBe("");
  });
});
