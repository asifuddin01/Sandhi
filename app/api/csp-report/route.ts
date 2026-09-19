import { MAX_CSP_REPORT_BYTES, summarizeCspReports } from "@/lib/csp-reports";
import { requestIdentifier } from "@/lib/forms-services";
import { checkRateLimit } from "@/lib/ratelimit";

const accepted = new Response(null, { status: 204 });

/** Reads at most `limit` bytes; null when the body is larger. */
async function boundedText(request: Request, limit: number) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * Browsers report blocked scripts and resources here. A violation of the
 * enforced policy means a bug or an attempted injection, so each one is
 * logged, briefly and without query strings, for the hosting logs.
 */
export async function POST(request: Request) {
  const body = await boundedText(request, MAX_CSP_REPORT_BYTES);
  if (body === null) return new Response(null, { status: 413 });

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  const violations = summarizeCspReports(payload);
  if (violations.length === 0) return accepted.clone();

  try {
    const decision = await checkRateLimit({
      scope: "csp-report",
      identifier: requestIdentifier(request),
      limit: 30,
      windowSeconds: 60,
    });
    if (!decision.allowed) return accepted.clone();
  } catch {
    // Without the limiter, reports are dropped rather than logged unbounded.
    return accepted.clone();
  }

  for (const violation of violations) {
    console.warn("[csp] violation", JSON.stringify(violation));
  }
  return accepted.clone();
}
