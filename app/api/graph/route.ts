import { NextResponse } from "next/server";

import { getPublicGraph } from "@/lib/public-graph";

export const dynamic = "force-dynamic";

export async function GET() {
  const graph = await getPublicGraph();

  return NextResponse.json(graph, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
