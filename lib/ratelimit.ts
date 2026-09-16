import {
  ExternalServiceError,
  isProductionEnvironment,
  ServiceConfigurationError,
} from "@/lib/forms-services";

type Fetcher = typeof fetch;

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
  mode: "upstash" | "development-bypass";
};

type UpstashResult = { result?: number | string | null; error?: string };

export async function checkRateLimit(
  input: {
    scope: string;
    identifier: string;
    limit: number;
    windowSeconds: number;
  },
  dependencies: {
    fetcher?: Fetcher;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<RateLimitDecision> {
  const env = dependencies.env ?? process.env;
  const url = env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    if (isProductionEnvironment(env)) {
      throw new ServiceConfigurationError(
        "Upstash",
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production.",
      );
    }

    return {
      allowed: true,
      limit: input.limit,
      remaining: input.limit,
      retryAfter: 0,
      mode: "development-bypass",
    };
  }

  const key = `sandhi:public-form:${input.scope}:${input.identifier}`;
  let response: Response;

  try {
    response = await (dependencies.fetcher ?? fetch)(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, input.windowSeconds, "NX"],
        ["TTL", key],
      ]),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    throw new ExternalServiceError(
      "Upstash",
      `Rate limiting could not be checked: ${
        error instanceof Error ? error.message : "network error"
      }`,
    );
  }

  if (!response.ok) {
    throw new ExternalServiceError(
      "Upstash",
      `Rate limiting returned HTTP ${response.status}.`,
    );
  }

  const result = (await response.json()) as UpstashResult[];
  if (!Array.isArray(result) || result.some((item) => item.error)) {
    throw new ExternalServiceError(
      "Upstash",
      "Rate limiting returned an invalid response.",
    );
  }

  const count = Number(result[0]?.result);
  const ttl = Number(result[2]?.result);
  if (!Number.isFinite(count)) {
    throw new ExternalServiceError(
      "Upstash",
      "Rate limiting did not return a count.",
    );
  }

  return {
    allowed: count <= input.limit,
    limit: input.limit,
    remaining: Math.max(0, input.limit - count),
    retryAfter:
      count > input.limit
        ? Number.isFinite(ttl) && ttl > 0
          ? Math.ceil(ttl)
          : input.windowSeconds
        : 0,
    mode: "upstash",
  };
}
