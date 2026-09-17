import { assertEmailConfigured, sendContactEmail } from "@/lib/email";
import { contactSubmissionSchema, flattenZodErrors } from "@/lib/forms";
import { getContactRecipient } from "@/lib/forms-contact";
import {
  crossSiteResponse,
  isSameOriginRequest,
  rateLimitResponse,
  readJson,
  serviceErrorResponse,
} from "@/lib/forms-http";
import { requestIdentifier, requestIp } from "@/lib/forms-services";
import { checkRateLimit } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return crossSiteResponse("This inquiry was not accepted.");
    }

    const rateLimit = await checkRateLimit({
      scope: "contact-submit",
      identifier: requestIdentifier(request),
      limit: 5,
      windowSeconds: 60 * 60,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch {
      return Response.json(
        { message: "Send a valid inquiry." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const parsed = contactSubmissionSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          message: "Please check the highlighted fields.",
          errors: flattenZodErrors(parsed.error),
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const turnstile = await verifyTurnstile({
      token: parsed.data.turnstileToken,
      remoteIp: requestIp(request),
    });
    if (!turnstile.success) {
      return Response.json(
        {
          message: "The anti-spam check was not accepted. Please try again.",
          errors: { turnstileToken: "Complete the anti-spam check again." },
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    assertEmailConfigured();
    const recipient = await getContactRecipient(parsed.data.topic);
    await sendContactEmail(parsed.data, recipient);

    return Response.json(
      { message: "Message sent. Thank you for getting in touch." },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return (
      serviceErrorResponse(error) ??
      Response.json(
        { message: "Your message could not be sent. Please try again." },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      )
    );
  }
}
