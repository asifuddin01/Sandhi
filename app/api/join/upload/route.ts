import { uploadRequestSchema } from "@/lib/forms";
import {
  rateLimitResponse,
  readJson,
  serviceErrorResponse,
} from "@/lib/forms-http";
import { requestIdentifier } from "@/lib/forms-services";
import { checkRateLimit } from "@/lib/ratelimit";
import { createPrivateUploadIntent } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rateLimit = await checkRateLimit({
      scope: "join-upload",
      identifier: requestIdentifier(request),
      limit: 20,
      windowSeconds: 60 * 60,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch {
      return Response.json(
        { message: "Send valid JSON upload details." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const parsed = uploadRequestSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.name.toLowerCase().endsWith(".pdf")) {
      return Response.json(
        { message: "Choose a PDF within the allowed size limit." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const intent = createPrivateUploadIntent(parsed.data);
    return Response.json(intent, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return (
      serviceErrorResponse(error) ??
      Response.json(
        { message: "The upload could not be prepared." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      )
    );
  }
}
