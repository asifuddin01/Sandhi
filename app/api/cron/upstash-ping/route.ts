import { timingSafeEqual } from "node:crypto";
import { pasted } from "@/lib/ratelimit";

type UpstashResult = { result?: unknown; error?: unknown };

export const maxDuration = 10;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization ?? "");
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    return new Response(null, { status: 401 });
  }

  const url = pasted(process.env.UPSTASH_REDIS_REST_URL)?.replace(/\/$/u, "");
  const token = pasted(process.env.UPSTASH_REDIS_REST_TOKEN);
  if (!url || !token || !/^https:\/\/[a-z0-9.-]+$/iu.test(url)) {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }

  try {
    const response = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([["PING"]]),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });

    if (!response.ok) {
      return Response.json({ error: "upstream_unavailable" }, { status: 502 });
    }

    const result = (await response.json()) as UpstashResult[];
    if (
      !Array.isArray(result) ||
      result[0]?.error ||
      result[0]?.result !== "PONG"
    ) {
      return Response.json({ error: "upstream_unavailable" }, { status: 502 });
    }
  } catch {
    return Response.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  return Response.json({ ok: true });
}
