import { getPublicFeedItems, humanizeEnum } from "@/lib/public-content";

export const dynamic = "force-dynamic";

const origin = "https://sandhiresearch.org";

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/gu, (character) => {
    switch (character) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

export async function GET() {
  const items = await getPublicFeedItems();
  const latestUpdate = items
    .map((item) => item.updatedAt)
    .toSorted((left, right) => right.getTime() - left.getTime())[0];
  const renderedItems = items
    .map((item) => {
      const path = item.kind === "news" ? "news" : "insights";
      const url = `${origin}/${path}/${encodeURIComponent(item.slug)}`;

      return [
        "    <item>",
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <description>${escapeXml(item.description)}</description>`,
        `      <category>${escapeXml(humanizeEnum(item.category))}</category>`,
        `      <pubDate>${item.publishedAt.toUTCString()}</pubDate>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>SANDHI Research Lab</title>",
    `    <link>${origin}</link>`,
    "    <description>Research news and insights from SANDHI Research Lab.</description>",
    "    <language>en</language>",
    `    <atom:link href="${origin}/feed.xml" rel="self" type="application/rss+xml" />`,
    ...(latestUpdate
      ? [`    <lastBuildDate>${latestUpdate.toUTCString()}</lastBuildDate>`]
      : []),
    ...(renderedItems ? [renderedItems] : []),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400",
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
