export const PUBLICATION_TYPES = [
  "CONFERENCE",
  "JOURNAL",
  "WORKSHOP",
  "PREPRINT",
  "TECHNICAL_REPORT",
  "DATASET",
  "BENCHMARK",
  "THESIS",
] as const;

export type PublicationType = (typeof PUBLICATION_TYPES)[number];

export type BibtexEntryType =
  "inproceedings" | "article" | "misc" | "techreport";

export interface BibtexAuthorInput {
  position?: number | null;
  name?: string | null;
  externalName?: string | null;
  member?: { name: string } | null;
}

export interface BibtexPublicationInput {
  title: string;
  type: PublicationType;
  authors?: readonly BibtexAuthorInput[];
  year?: number | null;
  publishedAt?: Date | string | null;
  venueName?: string | null;
  doi?: string | null;
  arxivId?: string | null;
  pageUrl?: string | null;
  pdfUrl?: string | null;
  datasetUrl?: string | null;
  bibtexOverride?: string | null;
}

const ENTRY_TYPE_BY_PUBLICATION_TYPE: Record<PublicationType, BibtexEntryType> =
  {
    CONFERENCE: "inproceedings",
    JOURNAL: "article",
    WORKSHOP: "inproceedings",
    PREPRINT: "misc",
    TECHNICAL_REPORT: "techreport",
    DATASET: "misc",
    BENCHMARK: "misc",
    THESIS: "misc",
  };

const LATEX_ESCAPES: Readonly<Record<string, string>> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  $: "\\$",
  "&": "\\&",
  "#": "\\#",
  _: "\\_",
  "%": "\\%",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

/** Escape text for use inside a braced BibTeX value. */
export function escapeLatex(value: string): string {
  return Array.from(
    value,
    (character) => LATEX_ESCAPES[character] ?? character,
  ).join("");
}

export const escapeBibtexValue = escapeLatex;

export function getBibtexEntryType(type: PublicationType): BibtexEntryType {
  return ENTRY_TYPE_BY_PUBLICATION_TYPE[type];
}

function authorDisplayName(author: BibtexAuthorInput): string | null {
  const name = author.member?.name ?? author.externalName ?? author.name;
  const trimmedName = name?.trim();

  return trimmedName ? trimmedName : null;
}

function orderedAuthorNames(
  authors: readonly BibtexAuthorInput[] | undefined,
): string[] {
  return (authors ?? [])
    .map((author, index) => ({ author, index }))
    .sort(
      (left, right) =>
        (left.author.position ?? left.index) -
          (right.author.position ?? right.index) || left.index - right.index,
    )
    .map(({ author }) => authorDisplayName(author))
    .filter((name): name is string => name !== null);
}

function asciiKeyPart(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase();
  const parts = normalized.match(/[a-z0-9]+/g);

  return parts?.join("") || fallback;
}

function surnameForKey(authorName: string | undefined): string {
  if (!authorName) {
    return "anonymous";
  }

  if (authorName.includes(",")) {
    const familyName = authorName.split(",", 1)[0]?.trim() ?? "";
    return asciiKeyPart(familyName, "anonymous");
  }

  const words = authorName.trim().split(/\s+/);

  return asciiKeyPart(words?.at(-1) ?? "", "anonymous");
}

function firstTitleWordForKey(title: string): string {
  const firstWord = title
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .match(/[a-zA-Z0-9]+/u)?.[0];

  return asciiKeyPart(firstWord ?? "", "work");
}

function publicationYear(publication: BibtexPublicationInput): number | null {
  if (publication.year !== null && publication.year !== undefined) {
    return publication.year;
  }

  if (!publication.publishedAt) {
    return null;
  }

  const publishedAt =
    publication.publishedAt instanceof Date
      ? publication.publishedAt
      : new Date(publication.publishedAt);

  return Number.isNaN(publishedAt.getTime())
    ? null
    : publishedAt.getUTCFullYear();
}

export function makeBibtexKey(publication: BibtexPublicationInput): string {
  const authors = orderedAuthorNames(publication.authors);
  const lastName = surnameForKey(authors[0]);
  const year = publicationYear(publication)?.toString() ?? "nd";
  const firstTitleWord = firstTitleWordForKey(publication.title);

  return `${lastName}${year}${firstTitleWord}`;
}

function addField(
  fields: Array<readonly [name: string, value: string]>,
  name: string,
  value: string | number | null | undefined,
): void {
  if (value === null || value === undefined || String(value).trim() === "") {
    return;
  }

  fields.push([name, String(value)]);
}

function canonicalArxivId(arxivId: string): string {
  return arxivId.trim().replace(/^arxiv:\s*/i, "");
}

/** Generate deterministic BibTeX, or return a stored manual override verbatim. */
export function generateBibtex(publication: BibtexPublicationInput): string {
  if (publication.bibtexOverride?.trim()) {
    return publication.bibtexOverride.trim();
  }

  const entryType = getBibtexEntryType(publication.type);
  const fields: Array<readonly [name: string, value: string]> = [];
  const authorNames = orderedAuthorNames(publication.authors);
  const year = publicationYear(publication);

  addField(fields, "author", authorNames.join(" and "));
  addField(fields, "title", publication.title);

  if (publication.type === "CONFERENCE" || publication.type === "WORKSHOP") {
    addField(fields, "booktitle", publication.venueName);
  } else if (publication.type === "JOURNAL") {
    addField(fields, "journal", publication.venueName);
  } else if (publication.type === "TECHNICAL_REPORT") {
    addField(fields, "institution", publication.venueName);
  } else if (
    publication.type === "DATASET" ||
    publication.type === "BENCHMARK" ||
    publication.type === "THESIS"
  ) {
    addField(fields, "howpublished", publication.venueName);
  }

  addField(fields, "year", year);

  if (publication.type === "PREPRINT" && publication.arxivId) {
    addField(fields, "eprint", canonicalArxivId(publication.arxivId));
    addField(fields, "archivePrefix", "arXiv");
  }

  addField(fields, "doi", publication.doi);
  addField(
    fields,
    "url",
    publication.datasetUrl ?? publication.pageUrl ?? publication.pdfUrl,
  );

  const renderedFields = fields
    .map(([name, value]) => `  ${name} = {${escapeLatex(value)}}`)
    .join(",\n");

  return `@${entryType}{${makeBibtexKey(publication)},\n${renderedFields}\n}`;
}

export const generateBibTeX = generateBibtex;
