import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface Point {
  x: number;
  y: number;
}

const root = process.cwd();
const sourcePath = path.join(root, "public", "field", "sandhi-glyph.svg");
const outputPath = path.join(root, "public", "field", "sandhi-points.json");
const spacing = 13;

function distance(left: Point, right: Point): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function linePoints(from: Point, to: Point): Point[] {
  const steps = Math.max(1, Math.ceil(distance(from, to) / spacing));
  return Array.from({ length: steps }, (_, index) => {
    const t = (index + 1) / steps;
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };
  });
}

function quadraticPoints(from: Point, control: Point, to: Point): Point[] {
  const estimate = distance(from, control) + distance(control, to);
  const steps = Math.max(3, Math.ceil(estimate / spacing));
  return Array.from({ length: steps }, (_, index) => {
    const t = (index + 1) / steps;
    const inverse = 1 - t;
    return {
      x:
        inverse * inverse * from.x + 2 * inverse * t * control.x + t * t * to.x,
      y:
        inverse * inverse * from.y + 2 * inverse * t * control.y + t * t * to.y,
    };
  });
}

function samplePath(data: string, xOffset: number): Point[] {
  const tokens = data.match(/[MLQZ]|-?(?:\d+\.?\d*|\.\d+)/gu);
  if (!tokens) throw new Error("The glyph source contains an empty path.");

  const points: Point[] = [];
  let cursor = 0;
  let current: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };

  const number = () => {
    const value = Number(tokens[cursor++]);
    if (!Number.isFinite(value)) throw new Error("Invalid glyph path number.");
    return value;
  };

  while (cursor < tokens.length) {
    const command = tokens[cursor++];
    if (command === "M") {
      current = { x: number() + xOffset, y: number() };
      start = current;
      points.push(current);
    } else if (command === "L") {
      const next = { x: number() + xOffset, y: number() };
      points.push(...linePoints(current, next));
      current = next;
    } else if (command === "Q") {
      const control = { x: number() + xOffset, y: number() };
      const next = { x: number() + xOffset, y: number() };
      points.push(...quadraticPoints(current, control, next));
      current = next;
    } else if (command === "Z") {
      points.push(...linePoints(current, start));
      current = start;
    } else {
      throw new Error(`Unsupported glyph path command: ${command}`);
    }
  }

  return points;
}

function round(value: number): number {
  return Number(value.toFixed(5));
}

const svg = await readFile(sourcePath, "utf8");
const pathPattern = /<path\s+data-x="([^"]+)"\s+d="([^"]+)"\s*\/>/gu;
const points: Point[] = [];
const breaks: number[] = [];

for (const match of svg.matchAll(pathPattern)) {
  breaks.push(points.length);
  points.push(...samplePath(match[2], Number(match[1])));
}

if (points.length < 100) {
  throw new Error("The glyph source did not yield enough outline points.");
}

const minX = Math.min(...points.map((point) => point.x));
const maxX = Math.max(...points.map((point) => point.x));
const minY = Math.min(...points.map((point) => point.y));
const maxY = Math.max(...points.map((point) => point.y));
const centerX = (minX + maxX) / 2;
const centerY = (minY + maxY) / 2;
const scale = Math.max(maxX - minX, maxY - minY) / 2;
const normalized = points.map((point) => [
  round((point.x - centerX) / scale),
  round((point.y - centerY) / scale),
]);

await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      glyph: "सन्धि",
      font: "Tiro Devanagari Sanskrit 400",
      source: "/field/sandhi-glyph.svg",
      bounds: {
        minX: round(minX),
        minY: round(minY),
        maxX: round(maxX),
        maxY: round(maxY),
      },
      breaks,
      points: normalized,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Wrote ${normalized.length} glyph points to ${outputPath}`);
