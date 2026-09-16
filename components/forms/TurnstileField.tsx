"use client";

import { useEffect, useId, useRef } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: "auto";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const scriptSource =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function TurnstileField({
  siteKey,
  resetKey,
  onTokenChange,
}: {
  siteKey?: string;
  resetKey: number;
  onTokenChange: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const fieldId = useId();

  useEffect(() => {
    if (!siteKey) {
      onTokenChange(
        process.env.NODE_ENV === "production" ? "" : "development-bypass",
      );
      return;
    }

    let widgetId: string | undefined;
    let cancelled = false;

    const render = () => {
      if (cancelled || widgetId || !container.current || !window.turnstile)
        return;
      widgetId = window.turnstile.render(container.current, {
        sitekey: siteKey,
        theme: "auto",
        callback: onTokenChange,
        "expired-callback": () => onTokenChange(""),
        "error-callback": () => onTokenChange(""),
      });
    };

    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${scriptSource}"]`,
    );
    if (!script) {
      script = document.createElement("script");
      script.src = scriptSource;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }

    script.addEventListener("load", render);
    render();

    return () => {
      cancelled = true;
      script?.removeEventListener("load", render);
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      onTokenChange("");
    };
  }, [onTokenChange, resetKey, siteKey]);

  return (
    <div>
      <div
        id={fieldId}
        ref={container}
        role="group"
        aria-label="Anti-spam verification"
      />
      {!siteKey && process.env.NODE_ENV !== "production" ? (
        <p role="status">Anti-spam verification is in development mode.</p>
      ) : null}
      {!siteKey && process.env.NODE_ENV === "production" ? (
        <p role="alert">The anti-spam check is temporarily unavailable.</p>
      ) : null}
      <noscript>
        JavaScript is required to complete the anti-spam check.
      </noscript>
    </div>
  );
}
