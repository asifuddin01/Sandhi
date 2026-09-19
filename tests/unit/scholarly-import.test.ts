import { describe, expect, it, vi } from "vitest";

import {
  fromArxivAtom,
  fromCrossref,
  importByArxiv,
  importByDoi,
  ImportError,
  normalizeArxivId,
  normalizeDoi,
} from "@/lib/scholarly-import";

const crossrefWork = {
  type: "journal-article",
  title: ["Deep learning"],
  "container-title": ["Nature"],
  issued: { "date-parts": [[2015, 5, 27]] },
  author: [
    { given: "Yann", family: "LeCun" },
    { given: "Yoshua", family: "Bengio" },
    { name: "The Consortium" },
  ],
  abstract:
    "<jats:p>Deep learning allows <jats:italic>models</jats:italic> &amp; more.</jats:p>",
  DOI: "10.1038/nature14539",
};

const arxivFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>https://arxiv.org/api/query</id>
  <title>arXiv Query: id_list=1706.03762</title>
  <entry>
    <id>http://arxiv.org/abs/1706.03762v7</id>
    <title>Attention Is All
      You Need</title>
    <summary>The dominant sequence transduction models &amp; more.</summary>
    <published>2017-06-12T17:57:34Z</published>
    <author><name>Ashish Vaswani</name></author>
    <author><name>Noam Shazeer</name></author>
    <arxiv:doi xmlns:arxiv="http://arxiv.org/schemas/atom">10.48550/arXiv.1706.03762</arxiv:doi>
  </entry>
</feed>`;

describe("identifiers", () => {
  it("accepts DOIs in their common written forms", () => {
    for (const input of [
      "10.1038/nature14539",
      " https://doi.org/10.1038/nature14539 ",
      "https://dx.doi.org/10.1038/nature14539",
      "doi:10.1038/nature14539",
    ]) {
      expect(normalizeDoi(input), input).toBe("10.1038/nature14539");
    }
    expect(normalizeDoi("nature14539")).toBeNull();
    expect(normalizeDoi("10.1/x")).toBeNull();
  });

  it("accepts new and old arXiv ids and links", () => {
    expect(normalizeArxivId("1706.03762")).toBe("1706.03762");
    expect(normalizeArxivId("arXiv:2401.01234v2")).toBe("2401.01234v2");
    expect(normalizeArxivId("https://arxiv.org/abs/1706.03762v7")).toBe(
      "1706.03762v7",
    );
    expect(normalizeArxivId("https://arxiv.org/pdf/1706.03762.pdf")).toBe(
      "1706.03762",
    );
    expect(normalizeArxivId("cs/0112017")).toBe("cs/0112017");
    expect(normalizeArxivId("../../etc/passwd")).toBeNull();
    expect(normalizeArxivId("1706.03762&id_list=1")).toBeNull();
  });
});

describe("fromCrossref", () => {
  it("fills title, authors, venue, year, and a plain abstract", () => {
    expect(fromCrossref(crossrefWork)).toEqual({
      title: "Deep learning",
      abstract: "Deep learning allows models & more.",
      type: "JOURNAL",
      venueName: "Nature",
      year: 2015,
      publishedOn: "2015-05-27",
      doi: "10.1038/nature14539",
      arxivId: null,
      pdfUrl: null,
      authors: ["Yann LeCun", "Yoshua Bengio", "The Consortium"],
    });
  });

  it("maps conference papers and tolerates partial dates", () => {
    const paper = fromCrossref({
      ...crossrefWork,
      type: "proceedings-article",
      issued: { "date-parts": [[2024]] },
    });
    expect(paper.type).toBe("CONFERENCE");
    expect(paper.year).toBe(2024);
    expect(paper.publishedOn).toBeNull();
  });

  it("refuses a record without a title", () => {
    expect(() => fromCrossref({ ...crossrefWork, title: [] })).toThrow(
      ImportError,
    );
  });
});

describe("fromArxivAtom", () => {
  it("reads the first entry, not the feed's own title", () => {
    expect(fromArxivAtom(arxivFeed)).toEqual({
      title: "Attention Is All You Need",
      abstract: "The dominant sequence transduction models & more.",
      type: "PREPRINT",
      venueName: "arXiv",
      year: 2017,
      publishedOn: "2017-06-12",
      doi: "10.48550/arXiv.1706.03762",
      arxivId: "1706.03762v7",
      pdfUrl: "https://arxiv.org/pdf/1706.03762v7",
      authors: ["Ashish Vaswani", "Noam Shazeer"],
    });
  });

  it("refuses a feed with no entry", () => {
    expect(() => fromArxivAtom("<feed></feed>")).toThrow(/no paper/u);
  });
});

describe("importing", () => {
  it("asks only Crossref and arXiv, with the identifier encoded", async () => {
    const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async (url) =>
        url.startsWith("https://api.crossref.org/")
          ? new Response(JSON.stringify({ message: crossrefWork }))
          : new Response(arxivFeed),
    );
    await importByDoi("https://doi.org/10.1038/nature14539", fetcher);
    await importByArxiv("1706.03762", fetcher);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "https://api.crossref.org/works/10.1038%2Fnature14539",
      "https://export.arxiv.org/api/query?id_list=1706.03762",
    ]);
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ redirect: "error" });
  });

  it("explains missing records, outages, and bad input", async () => {
    const missing = vi.fn(async () => new Response("", { status: 404 }));
    await expect(importByDoi("10.1038/none", missing)).rejects.toThrow(
      /no record/u,
    );
    const down = vi.fn(async () => {
      throw new TypeError("offline");
    });
    await expect(importByArxiv("1706.03762", down)).rejects.toThrow(
      /did not answer/u,
    );
    const unused = vi.fn();
    await expect(importByDoi("not a doi", unused)).rejects.toThrow(
      /Enter a DOI/u,
    );
    expect(unused).not.toHaveBeenCalled();
  });

  it("refuses answers that are too large", async () => {
    const huge = vi.fn(async () => new Response("x".repeat(1024 * 1024 + 1)));
    await expect(importByArxiv("1706.03762", huge)).rejects.toThrow(
      /too large/u,
    );
  });
});
