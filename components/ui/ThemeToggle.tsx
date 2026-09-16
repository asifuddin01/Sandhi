"use client";

import { useLayoutEffect, useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "sandhi-theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function savedTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" || stored === "light" ? stored : systemTheme();
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useLayoutEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => {
      const next = savedTheme();
      root.dataset.theme = next;
      setTheme(next);
    };

    syncTheme();

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handleSystemChange = () => {
      if (!window.localStorage.getItem(STORAGE_KEY)) syncTheme();
    };

    media.addEventListener("change", handleSystemChange);
    return () => media.removeEventListener("change", handleSystemChange);
  }, []);

  function toggleTheme() {
    // Read the applied theme instead of relying on React state. The inline
    // preference script can update the document before this component has
    // finished hydrating, so the state may briefly lag behind the page.
    const current: Theme =
      document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const next: Theme = current === "dark" ? "light" : "dark";
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }

  const label = theme === "dark" ? "Use light theme" : "Use dark theme";

  return (
    <button
      className="icon-button theme-toggle"
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={theme === "light"}
      onClick={toggleTheme}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3 7 7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19.7 15.2A8 8 0 0 1 8.8 4.3 8 8 0 1 0 19.7 15.2Z" />
        </svg>
      )}
    </button>
  );
}
