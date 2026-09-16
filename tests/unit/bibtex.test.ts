import { describe, expect, it } from "vitest";

import {
  escapeLatex,
  generateBibtex,
  getBibtexEntryType,
  makeBibtexKey,
  type BibtexPublicationInput,
  type PublicationType,
} from "@/lib/bibtex";

const basePublication: BibtexPublicationInput = {
  title: "Hierarchical Reasoning for Reliable Models",
  type: "CONFERENCE",
  year: 2027,
  venueName: "Conference on Responsible AI",
  authors: [
    { position: 1, externalName: "Researcher, Second" },
    { position: 0, member: { name: "Md Asif Uddin" } },
  ],
};

const typeCases: ReadonlyArray<
  readonly [PublicationType, string, string | null]
> = [
  ["CONFERENCE", "inproceedings", "booktitle"],
  ["JOURNAL", "article", "journal"],
  ["WORKSHOP", "inproceedings", "booktitle"],
  ["PREPRINT", "misc", null],
  ["TECHNICAL_REPORT", "techreport", "institution"],
  ["DATASET", "misc", "howpublished"],
  ["BENCHMARK", "misc", "howpublished"],
  ["THESIS", "misc", "howpublished"],
];

describe("BibTeX publication type mapping", () => {
  it.each(typeCases)(
    "renders %s as @%s",
    (publicationType, expectedEntryType, venueField) => {
      const bibtex = generateBibtex({
        ...basePublication,
        type: publicationType,
        arxivId: publicationType === "PREPRINT" ? "arXiv:2701.01234v2" : null,
      });

      expect(getBibtexEntryType(publicationType)).toBe(expectedEntryType);
      expect(bibtex).toMatch(
        new RegExp(`^@${expectedEntryType}\\{uddin2027hierarchical,`),
      );
      expect(bibtex).toContain(
        "author = {Md Asif Uddin and Researcher, Second}",
      );

      if (venueField) {
        expect(bibtex).toContain(
          `${venueField} = {Conference on Responsible AI}`,
        );
      }
    },
  );

  it("adds the required arXiv fields to preprints", () => {
    const bibtex = generateBibtex({
      ...basePublication,
      type: "PREPRINT",
      arxivId: "arXiv:2701.01234v2",
    });

    expect(bibtex).toContain("eprint = {2701.01234v2}");
    expect(bibtex).toContain("archivePrefix = {arXiv}");
  });
});

describe("BibTeX values and keys", () => {
  it("escapes every LaTeX special character without double escaping", () => {
    expect(escapeLatex("\\{}$&#_%~^")).toBe(
      String.raw`\textbackslash{}\{\}\$\&\#\_\%\textasciitilde{}\textasciicircum{}`,
    );
  });

  it("escapes publication fields", () => {
    const bibtex = generateBibtex({
      ...basePublication,
      title: "Accuracy_1 & Safety: 95%",
      doi: "10.1000/a_b#c",
    });

    expect(bibtex).toContain("title = {Accuracy\\_1 \\& Safety: 95\\%}");
    expect(bibtex).toContain("doi = {10.1000/a\\_b\\#c}");
  });

  it("supports comma-form names and derives a missing year from publishedAt", () => {
    expect(
      makeBibtexKey({
        ...basePublication,
        authors: [{ externalName: "van Beethoven, Ludwig" }],
        year: null,
        publishedAt: "2028-03-20T00:00:00.000Z",
      }),
    ).toBe("vanbeethoven2028hierarchical");
  });

  it("uses stable fallbacks when author and year are absent", () => {
    expect(
      makeBibtexKey({
        title: "---",
        type: "DATASET",
      }),
    ).toBe("anonymousndwork");
  });

  it("returns a non-empty stored override without modifying it", () => {
    expect(
      generateBibtex({
        ...basePublication,
        bibtexOverride: "  @custom{manual,\n  note = {Keep me}\n}  ",
      }),
    ).toBe("@custom{manual,\n  note = {Keep me}\n}");
  });
});
