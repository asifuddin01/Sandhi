/**
 * Filling a publication from its DOI (Crossref) or arXiv id. Only these two
 * fixed hosts are ever contacted, with a timeout and a size limit, so the
 * import cannot be turned against other servers.
 */

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
export type PublicationTypeValue = (typeof PUBLICATION_TYPES)[number];

export type ImportedPublication = {
  title: string;
  abstract: string;
  type: PublicationTypeValue;
  venueName: string | null;
  year: number | null;
  /** ISO date (YYYY-MM-DD), when known to the day. */
  publishedOn: string | null;
  doi: string | null;
  arxivId: string | null;
  pdfUrl: string | null;
  authors: string[];
};

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const MAX_RESPONSE_BYTES = 1024 * 1024;
const TIMEOUT_MS = 8000;

export class ImportError extends Error {}

const doiPattern = /^10\.\d{4,9}\/\S{1,300}$/u;

/** "https://doi.org/10.1038/X" or "doi:10.1038/X" → "10.1038/X". */
export function normalizeDoi(input: string): string | null {
  const value = input
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//iu, "")
    .replace(/^doi:\s*/iu, "");
  return doiPattern.test(value) ? value : null;
}

const newArxiv = /^\d{4}\.\d{4,5}(v\d+)?$/u;
const oldArxiv = /^[a-z-]+(\.[a-z]{2})?\/\d{7}(v\d+)?$/iu;

/** "arXiv:2401.01234v2" or an abs/pdf link → "2401.01234v2". */
export function normalizeArxivId(input: string): string | null {
  const value = input
    .trim()
    .replace(/^https?:\/\/(www\.)?arxiv\.org\/(abs|pdf)\//iu, "")
    .replace(/\.pdf$/iu, "")
    .replace(/^arxiv:\s*/iu, "");
  return newArxiv.test(value) || oldArxiv.test(value) ? value : null;
}

function clean(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/giu,
    (whole, name: string) => {
      if (name.startsWith("#x") || name.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
      }
      if (name.startsWith("#"))
        return String.fromCodePoint(Number(name.slice(1)));
      return entities[name.toLowerCase()] ?? whole;
    },
  );
}

/** Crossref abstracts are JATS XML; keep only the words. */
function stripTags(text: string): string {
  return clean(decodeEntities(text.replace(/<[^>]*>/gu, " ")));
}

const crossrefTypes: Record<string, PublicationTypeValue> = {
  "journal-article": "JOURNAL",
  "proceedings-article": "CONFERENCE",
  "posted-content": "PREPRINT",
  report: "TECHNICAL_REPORT",
  dataset: "DATASET",
  dissertation: "THESIS",
};

type CrossrefWork = {
  type?: string;
  title?: string[];
  abstract?: string;
  "container-title"?: string[];
  issued?: { "date-parts"?: number[][] };
  author?: Array<{ given?: string; family?: string; name?: string }>;
  DOI?: string;
};

export function fromCrossref(work: CrossrefWork): ImportedPublication {
  const title = clean(work.title?.[0] ?? "");
  if (!title) throw new ImportError("That DOI has no title in Crossref.");
  const [year, month, day] = work.issued?.["date-parts"]?.[0] ?? [];
  const publishedOn =
    year && month && day
      ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : null;
  return {
    title,
    abstract: work.abstract ? stripTags(work.abstract) : "",
    type: crossrefTypes[work.type ?? ""] ?? "JOURNAL",
    venueName: clean(work["container-title"]?.[0] ?? "") || null,
    year: typeof year === "number" ? year : null,
    publishedOn,
    doi: work.DOI ?? null,
    arxivId: null,
    pdfUrl: null,
    authors: (work.author ?? [])
      .map((author) =>
        clean(
          author.name ??
            [author.given, author.family].filter(Boolean).join(" "),
        ),
      )
      .filter(Boolean),
  };
}

function tag(xml: string, name: string): string | null {
  const match = new RegExp(
    `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`,
    "u",
  ).exec(xml);
  return match ? decodeEntities(match[1]!) : null;
}

/** The first entry of an arXiv Atom feed. */
export function fromArxivAtom(xml: string): ImportedPublication {
  const entry = /<entry>([\s\S]*?)<\/entry>/u.exec(xml)?.[1];
  if (!entry) throw new ImportError("arXiv has no paper with that id.");
  const id = tag(entry, "id") ?? "";
  const arxivId = normalizeArxivId(
    id.replace(/^https?:\/\/arxiv\.org\/abs\//u, ""),
  );
  const title = clean(tag(entry, "title") ?? "");
  if (!arxivId || !title)
    throw new ImportError("arXiv has no paper with that id.");
  const published = tag(entry, "published");
  const doi = tag(entry, "arxiv:doi");
  return {
    title,
    abstract: clean(tag(entry, "summary") ?? ""),
    type: "PREPRINT",
    venueName: "arXiv",
    year: published ? Number(published.slice(0, 4)) : null,
    publishedOn: published ? published.slice(0, 10) : null,
    doi: doi ? normalizeDoi(doi) : null,
    arxivId,
    pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
    authors: Array.from(entry.matchAll(/<name>([\s\S]*?)<\/name>/gu), (match) =>
      clean(decodeEntities(match[1]!)),
    ).filter(Boolean),
  };
}

async function fetchText(
  url: string,
  fetcher: Fetcher,
): Promise<string | null> {
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { "User-Agent": "SANDHI Research Lab" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    throw new ImportError("The lookup did not answer. Try again in a moment.");
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new ImportError("The lookup did not answer. Try again in a moment.");
  }
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new ImportError("The answer was too large to read.");
  }
  return text;
}

export async function importByDoi(
  input: string,
  fetcher: Fetcher = fetch,
): Promise<ImportedPublication> {
  const doi = normalizeDoi(input);
  if (!doi) throw new ImportError("Enter a DOI such as 10.1038/nature14539.");
  const text = await fetchText(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    fetcher,
  );
  if (!text) throw new ImportError("Crossref has no record of that DOI.");
  let work: CrossrefWork;
  try {
    work = (JSON.parse(text) as { message: CrossrefWork }).message;
  } catch {
    throw new ImportError("Crossref's answer could not be read.");
  }
  return fromCrossref({ ...work, DOI: work.DOI ?? doi });
}

export async function importByArxiv(
  input: string,
  fetcher: Fetcher = fetch,
): Promise<ImportedPublication> {
  const id = normalizeArxivId(input);
  if (!id) throw new ImportError("Enter an arXiv id such as 1706.03762.");
  const text = await fetchText(
    `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`,
    fetcher,
  );
  if (!text) throw new ImportError("arXiv has no paper with that id.");
  return fromArxivAtom(text);
}
