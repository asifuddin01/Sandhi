import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type ThemeName = "dark" | "light";
type TokenName =
  | "ink"
  | "ink-raised"
  | "ink-line"
  | "moonstone"
  | "mist"
  | "lamplight"
  | "lotus"
  | "signal-ok"
  | "signal-warn";

type ThemeTokens = Record<TokenName, string>;

interface ContrastPair {
  theme: ThemeName;
  foreground: TokenName;
  background: TokenName;
  minimum: number;
  role: string;
}

const SPECIFIED_TOKENS: Record<ThemeName, Partial<ThemeTokens>> = {
  dark: {
    ink: "#141a2e",
    "ink-raised": "#1b2340",
    "ink-line": "#2c3657",
    moonstone: "#d9dee8",
    mist: "#8c95ab",
    lamplight: "#c9a55c",
    lotus: "#9c8fb8",
    "signal-ok": "#7fa88f",
    "signal-warn": "#c98a6b",
  },
  light: {
    ink: "#eee8dc",
    "ink-raised": "#f7f1e6",
    "ink-line": "#d2c8b8",
    moonstone: "#1a2138",
    mist: "#56607a",
    lamplight: "#836323",
    lotus: "#5e5282",
  },
};

const CONTRAST_PAIRS: readonly ContrastPair[] = [
  // Normal text and links must meet WCAG AA at 4.5:1.
  ...(["dark", "light"] as const).flatMap((theme) =>
    (["ink", "ink-raised"] as const).flatMap((background) =>
      (["moonstone", "mist", "lotus"] as const).map((foreground) => ({
        theme,
        foreground,
        background,
        minimum: 4.5,
        role: foreground === "lotus" ? "link text" : "text",
      })),
    ),
  ),
  {
    theme: "dark",
    foreground: "signal-ok",
    background: "ink",
    minimum: 4.5,
    role: "status text",
  },
  {
    theme: "dark",
    foreground: "signal-warn",
    background: "ink",
    minimum: 4.5,
    role: "status text",
  },
  {
    theme: "dark",
    foreground: "signal-ok",
    background: "ink-raised",
    minimum: 4.5,
    role: "status text on panel",
  },
  {
    theme: "dark",
    foreground: "signal-warn",
    background: "ink-raised",
    minimum: 4.5,
    role: "status text on panel",
  },
  {
    theme: "dark",
    foreground: "ink",
    background: "lamplight",
    minimum: 4.5,
    role: "filled primary-button text",
  },
  {
    theme: "light",
    foreground: "ink-raised",
    background: "lamplight",
    minimum: 4.5,
    role: "filled primary-button text",
  },
  // Lamplight is UI emphasis/focus, not normal light-theme text (4.25:1).
  ...(["dark", "light"] as const).flatMap((theme) =>
    (["ink", "ink-raised"] as const).map((background) => ({
      theme,
      foreground: "lamplight" as const,
      background,
      minimum: 3,
      role: "focus indicator / meaningful UI graphic",
    })),
  ),
];

function declarationBlock(css: string, selector: string): string {
  const selectorIndex = css.indexOf(selector);
  const openingBrace = css.indexOf("{", selectorIndex);
  const closingBrace = css.indexOf("}", openingBrace);

  if (selectorIndex < 0 || openingBrace < 0 || closingBrace < 0) {
    throw new Error(`Could not find the ${selector} token block.`);
  }

  return css.slice(openingBrace + 1, closingBrace);
}

function tokensFromBlock(block: string): Partial<ThemeTokens> {
  const tokens: Partial<ThemeTokens> = {};
  const declaration = /--([a-z-]+)\s*:\s*(#[0-9a-f]{6})\s*;/gi;

  for (const match of block.matchAll(declaration)) {
    const token = match[1] as TokenName;
    const value = match[2];

    if (value) {
      tokens[token] = value.toLowerCase();
    }
  }

  return tokens;
}

function loadThemes(): Record<ThemeName, ThemeTokens> {
  const cssPath = resolve(process.cwd(), "styles/tokens.css");
  const css = readFileSync(cssPath, "utf8");
  const dark = tokensFromBlock(declarationBlock(css, ":root,"));
  const lightOverrides = tokensFromBlock(
    declarationBlock(css, ':root[data-theme="light"]'),
  );

  return {
    dark: dark as ThemeTokens,
    light: { ...dark, ...lightOverrides } as ThemeTokens,
  };
}

function channelToLinear(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hexColor: string): number {
  const normalized = hexColor.replace(/^#/, "");

  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    throw new Error(`Unsupported color value: ${hexColor}`);
  }

  const channels = normalized.match(/.{2}/g)?.map((part) => parseInt(part, 16));

  if (!channels || channels.length !== 3) {
    throw new Error(`Could not parse color value: ${hexColor}`);
  }

  const [red = 0, green = 0, blue = 0] = channels.map(channelToLinear);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function main(): void {
  const themes = loadThemes();
  const failures: string[] = [];

  for (const themeName of ["dark", "light"] as const) {
    for (const [token, expected] of Object.entries(
      SPECIFIED_TOKENS[themeName],
    )) {
      const actual = themes[themeName][token as TokenName];
      if (actual !== expected) {
        failures.push(
          `${themeName} --${token}: expected ${expected}, found ${actual ?? "missing"}`,
        );
      }
    }
  }

  for (const pair of CONTRAST_PAIRS) {
    const theme = themes[pair.theme];
    const ratio = contrastRatio(theme[pair.foreground], theme[pair.background]);
    const passed = ratio >= pair.minimum;
    const label = `${pair.theme} --${pair.foreground} on --${pair.background}`;
    console.log(
      `${passed ? "PASS" : "FAIL"} ${label}: ${ratio.toFixed(2)}:1 (minimum ${pair.minimum}:1, ${pair.role})`,
    );

    if (!passed) {
      failures.push(`${label} is ${ratio.toFixed(2)}:1`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Contrast verification failed:\n- ${failures.join("\n- ")}`,
    );
  }

  console.log(
    "Contrast verification passed. Light lamplight remains restricted to non-text UI/focus use.",
  );
}

main();
