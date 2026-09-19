import { describe, expect, it } from "vitest";

import {
  analyseImage,
  classifyShape,
  findComponents,
  isConnector,
  otsuThreshold,
  toGrayscale,
  toInkMask,
  type RasterImage,
} from "@/lib/diagrams/image-to-mermaid";

/** A white page to draw black shapes on, as a canvas would hand us. */
function page(width: number, height: number): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  return { width, height, data };
}

function ink(image: RasterImage, x: number, y: number) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const at = (y * image.width + x) * 4;
  image.data[at] = 0;
  image.data[at + 1] = 0;
  image.data[at + 2] = 0;
  image.data[at + 3] = 255;
}

function strokeRect(
  image: RasterImage,
  x: number,
  y: number,
  width: number,
  height: number,
  weight = 2,
) {
  for (let w = 0; w < weight; w += 1) {
    for (let i = 0; i < width; i += 1) {
      ink(image, x + i, y + w);
      ink(image, x + i, y + height - 1 - w);
    }
    for (let i = 0; i < height; i += 1) {
      ink(image, x + w, y + i);
      ink(image, x + width - 1 - w, y + i);
    }
  }
}

function strokeEllipse(
  image: RasterImage,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  for (let angle = 0; angle < 360; angle += 0.25) {
    const radians = (angle * Math.PI) / 180;
    const x = Math.round(cx + rx * Math.cos(radians));
    const y = Math.round(cy + ry * Math.sin(radians));
    for (let w = 0; w < 2; w += 1) ink(image, x, y + w);
  }
}

function strokeLine(
  image: RasterImage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = Math.round(x1 + (x2 - x1) * t);
    const y = Math.round(y1 + (y2 - y1) * t);
    ink(image, x, y);
    ink(image, x, y + 1);
  }
}

describe("reading the pixels", () => {
  it("treats a transparent pixel as paper, not ink", () => {
    const image = page(2, 1);
    image.data.set([0, 0, 0, 0], 0);
    expect(toGrayscale(image)[0]).toBe(255);
  });

  it("finds a threshold between the two groups of a real histogram", () => {
    const image = page(40, 40);
    strokeRect(image, 5, 5, 30, 30, 3);
    const threshold = otsuThreshold(toGrayscale(image));
    expect(threshold).toBeGreaterThan(0);
    expect(threshold).toBeLessThan(255);
  });

  it("counts separate drawings as separate components", () => {
    const image = page(200, 120);
    strokeRect(image, 10, 10, 60, 40);
    strokeRect(image, 120, 60, 60, 40);
    const mask = toInkMask(image);
    const components = findComponents(mask, image.width, image.height);
    expect(components).toHaveLength(2);
    expect(components[0]!.box).toEqual({ x: 10, y: 10, width: 60, height: 40 });
    // An outline is mostly empty inside; a filled blob would not be.
    expect(components[0]!.density).toBeLessThan(0.3);
  });
});

describe("telling shapes from connectors", () => {
  it("calls a long thin run a connector and a box a box", () => {
    const image = page(200, 120);
    strokeRect(image, 10, 10, 60, 40);
    strokeLine(image, 75, 30, 160, 30);
    const mask = toInkMask(image);
    const [box, line] = findComponents(mask, image.width, image.height).sort(
      (a, b) => a.box.x - b.box.x,
    );
    expect(isConnector(box!)).toBe(false);
    expect(isConnector(line!)).toBe(true);
  });

  it("reads a rectangle from its corners, and a round shape from their absence", () => {
    const rectangle = page(120, 90);
    strokeRect(rectangle, 10, 10, 90, 60, 2);
    const rectMask = toInkMask(rectangle);
    const rectComponent = findComponents(rectMask, 120, 90)[0]!;
    expect(classifyShape(rectComponent, rectMask, 120)).toBe("rectangle");

    const round = page(120, 120);
    strokeEllipse(round, 60, 60, 45, 45);
    const roundMask = toInkMask(round);
    const roundComponent = findComponents(roundMask, 120, 120)[0]!;
    expect(classifyShape(roundComponent, roundMask, 120)).toBe("circle");
  });
});

describe("analyseImage", () => {
  it("recovers two boxes joined by a line", () => {
    const image = page(400, 200);
    strokeRect(image, 20, 70, 100, 60);
    strokeRect(image, 260, 70, 100, 60);
    strokeLine(image, 122, 100, 258, 100);

    const { model, shapes, notes } = analyseImage(image);
    expect(model.nodes).toHaveLength(2);
    expect(shapes.map((shape) => shape.shape)).toEqual([
      "rectangle",
      "rectangle",
    ]);
    expect(model.edges).toEqual([
      { from: "box_1", to: "box_2", label: null, kind: "arrow" },
    ]);
    // Every box keeps where it was, so the editor can show a crop of it.
    expect(shapes[0]!.box).toMatchObject({ x: 20, y: 70 });
    expect(notes.join(" ")).toMatch(/words were not read/u);
  });

  it("numbers boxes down the page, then across", () => {
    const image = page(400, 400);
    strokeRect(image, 250, 20, 80, 50);
    strokeRect(image, 30, 20, 80, 50);
    strokeRect(image, 30, 300, 80, 50);
    const { shapes } = analyseImage(image);
    expect(shapes.map((shape) => [shape.box.x, shape.box.y])).toEqual([
      [30, 20],
      [250, 20],
      [30, 300],
    ]);
  });

  it("leaves out a line that joins nothing rather than guessing", () => {
    const image = page(400, 300);
    strokeRect(image, 20, 20, 80, 50);
    strokeRect(image, 20, 220, 80, 50);
    // A stray line far from both boxes.
    strokeLine(image, 300, 140, 380, 140);
    const { model, notes } = analyseImage(image);
    expect(model.nodes).toHaveLength(2);
    expect(model.edges).toEqual([]);
    expect(notes.join(" ")).toMatch(/none clearly joined/u);
  });

  it("says it found nothing rather than inventing a diagram", () => {
    const { model, shapes, notes } = analyseImage(page(300, 200));
    expect(model.nodes).toEqual([]);
    expect(shapes).toEqual([]);
    expect(notes[0]).toMatch(/No shapes could be made out/u);
  });

  it("ignores specks of noise", () => {
    const image = page(400, 300);
    strokeRect(image, 20, 20, 120, 80);
    for (let i = 0; i < 40; i += 1) ink(image, 200 + (i % 7), 200 + i);
    expect(analyseImage(image).model.nodes).toHaveLength(1);
  });
});
