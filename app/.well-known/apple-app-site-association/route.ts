import { buildAppleAppSiteAssociation } from "@/lib/app-links";

export const dynamic = "force-dynamic";

/**
 * iOS Universal Links. Apple fetches this without following redirects and
 * expects `application/json`, whatever the file's extension-less name.
 */
export function GET() {
  const association = buildAppleAppSiteAssociation();
  if (!association) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  }

  return new Response(JSON.stringify(association), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
