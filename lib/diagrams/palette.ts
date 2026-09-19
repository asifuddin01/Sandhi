/**
 * Colour for diagrams. The named classes are the site's own palette, so a
 * diagram dropped into a page or a paper still looks like SANDHI; a custom
 * colour is allowed for the cases the palette does not cover.
 *
 * Colours are emitted as Mermaid `classDef` lines, which means they live in
 * the saved source and survive an export, rather than being applied by
 * stylesheet only where this site renders them.
 */

export interface DiagramClass {
  name: string;
  label: string;
  fill: string;
  stroke: string;
  text: string;
}

/** Drawn from `styles/tokens.css`; kept literal because it leaves the site. */
export const DIAGRAM_CLASSES: DiagramClass[] = [
  {
    name: "plain",
    label: "Plain",
    fill: "#141b26",
    stroke: "#2b3647",
    text: "#e8ecf2",
  },
  {
    name: "accent",
    label: "Lamplight",
    fill: "#2a1f12",
    stroke: "#c98f4b",
    text: "#f3e3cd",
  },
  {
    name: "store",
    label: "Data",
    fill: "#10221f",
    stroke: "#4b9c8a",
    text: "#d8f0ea",
  },
  {
    name: "external",
    label: "External",
    fill: "#1b1620",
    stroke: "#8b7bb0",
    text: "#e9e2f5",
  },
  {
    name: "warn",
    label: "Attention",
    fill: "#261519",
    stroke: "#c4636f",
    text: "#f7dde1",
  },
];

const HEX = /^#[0-9a-f]{6}$/iu;

export function isHexColour(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value.trim());
}

export function findClass(name: string | null): DiagramClass | null {
  return DIAGRAM_CLASSES.find((entry) => entry.name === name) ?? null;
}

/** The `classDef` lines a diagram needs, for the classes it actually uses. */
export function classDefinitions(used: Iterable<string>): string[] {
  const names = new Set(used);
  return DIAGRAM_CLASSES.filter((entry) => names.has(entry.name)).map(
    (entry) =>
      `  classDef ${entry.name} fill:${entry.fill},stroke:${entry.stroke},color:${entry.text},stroke-width:1px`,
  );
}

/**
 * A custom colour becomes its own class, named after the colour so the same
 * colour used twice does not produce two definitions.
 */
export function customClassName(hex: string): string | null {
  return isHexColour(hex) ? `c${hex.trim().slice(1).toLowerCase()}` : null;
}

export function customClassDefinition(hex: string): string | null {
  const name = customClassName(hex);
  if (!name) return null;
  return `  classDef ${name} fill:${hex.toLowerCase()},stroke:${hex.toLowerCase()},color:#ffffff,stroke-width:1px`;
}
