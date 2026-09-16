import {
  ExternalServiceError,
  isProductionEnvironment,
  ServiceConfigurationError,
} from "@/lib/forms-services";

type Fetcher = typeof fetch;

type TurnstileResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export type TurnstileVerification = {
  success: boolean;
  mode: "verified" | "development-bypass";
};

export async function verifyTurnstile(
  input: { token: string; remoteIp?: string },
  dependencies: {
    fetcher?: Fetcher;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<TurnstileVerification> {
  const env = dependencies.env ?? process.env;
  const secret = env.TURNSTILE_SECRET_KEY?.trim();

  if (!secret) {
    if (isProductionEnvironment(env)) {
      throw new ServiceConfigurationError(
        "Turnstile",
        "TURNSTILE_SECRET_KEY is required in production.",
      );
    }

    return {
      success: input.token === "development-bypass",
      mode: "development-bypass",
    };
  }

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", input.token);
  if (input.remoteIp) form.set("remoteip", input.remoteIp);

  let response: Response;
  try {
    response = await (dependencies.fetcher ?? fetch)(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch (error) {
    throw new ExternalServiceError(
      "Turnstile",
      `Turnstile could not be reached: ${
        error instanceof Error ? error.message : "network error"
      }`,
    );
  }

  if (!response.ok) {
    throw new ExternalServiceError(
      "Turnstile",
      `Turnstile returned HTTP ${response.status}.`,
    );
  }

  const result = (await response.json()) as TurnstileResponse;
  return { success: result.success === true, mode: "verified" };
}
