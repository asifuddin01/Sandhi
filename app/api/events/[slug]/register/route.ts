import { getDb, isDatabaseConfigured } from "@/lib/db";
import { eventRegistrationSchema } from "@/lib/forms-event";
import {
  isSameOriginRequest,
  rateLimitResponse,
  readJson,
  serviceErrorResponse,
} from "@/lib/forms-http";
import { requestIdentifier, requestIp } from "@/lib/forms-services";
import { checkRateLimit } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { publicEventWhere } from "@/lib/visibility";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string }> };

function errorResponse(
  message: string,
  status: number,
  errors?: Record<string, string>,
): Response {
  return Response.json(
    { message, ...(errors ? { errors } : {}) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isUniqueRegistrationError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isSameOriginRequest(request)) {
      return errorResponse("This registration request was not accepted.", 403);
    }

    const rateLimit = await checkRateLimit({
      scope: "event-registration",
      identifier: requestIdentifier(request),
      limit: 5,
      windowSeconds: 10 * 60,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter);

    let raw: unknown;
    try {
      raw = await readJson(request);
    } catch {
      return errorResponse("Send a valid event registration.", 400);
    }

    const parsed = eventRegistrationSchema.safeParse(raw);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "form");
        errors[field] ??= issue.message;
      }
      return errorResponse("Please check the highlighted fields.", 400, errors);
    }

    const turnstile = await verifyTurnstile({
      token: parsed.data.turnstileToken,
      remoteIp: requestIp(request),
    });
    if (!turnstile.success) {
      return errorResponse(
        "The anti-spam check was not accepted. Please try again.",
        400,
        { turnstileToken: "Complete the anti-spam check again." },
      );
    }

    if (!isDatabaseConfigured()) {
      return errorResponse(
        "Event registration is temporarily unavailable.",
        503,
      );
    }

    const { slug } = await context.params;
    const db = getDb();
    const event = await db.event.findFirst({
      where: {
        AND: [
          publicEventWhere(),
          {
            slug,
            allowRegistration: true,
            registerUrl: null,
            startsAt: { gt: new Date() },
          },
        ],
      },
      select: { id: true },
    });
    if (!event) {
      return errorResponse("Registration is not open for this event.", 404);
    }

    try {
      await db.eventRegistration.create({
        data: {
          eventId: event.id,
          name: parsed.data.name,
          email: parsed.data.email,
          affiliation: parsed.data.affiliation || null,
        },
        select: { id: true },
      });
    } catch (error) {
      if (isUniqueRegistrationError(error)) {
        return errorResponse(
          "This email is already registered for the event.",
          409,
          { email: "This email is already registered." },
        );
      }
      throw error;
    }

    return Response.json(
      { message: "Registration received." },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return (
      serviceErrorResponse(error) ??
      errorResponse(
        "Registration could not be submitted. Please try again.",
        500,
      )
    );
  }
}
