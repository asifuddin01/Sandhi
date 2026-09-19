/**
 * Reading a photographed or hand-drawn architecture diagram into an editable
 * model, with no service and no model behind it: everything here is ordinary
 * image processing over the pixels the browser already decoded, so the picture
 * never leaves the device.
 *
 * What it recovers is the **topology** — how many boxes there are, roughly
 * what shape each one is, and which boxes are joined. It does not read the
 * words: that would need OCR, and a wrong label is worse than an obvious
 * placeholder. The editor shows a crop of each box so the labels can be typed
 * back in at a glance.
 */

import {
  emptyModel,
  type DiagramEdge,
  type DiagramModel,
  type NodeShape,
} from "@/lib/diagrams/model";

export interface RasterImage {
  width: number;
  height: number;
  /** RGBA, as `CanvasRenderingContext2D.getImageData` returns it. */
  data: Uint8ClampedArray;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnalysedShape {
  id: string;
  shape: NodeShape;
  /** Where it sits in the image, so the editor can show a crop of it. */
  box: Box;
}

export interface Analysis {
  model: DiagramModel;
  shapes: AnalysedShape[];
  /** What the reading could not do, said plainly, for the editor to show. */
  notes: string[];
}

export interface AnalysisOptions {
  /** Ink threshold 0–255; derived from the image when not given. */
  threshold?: number;
  /** Components smaller than this share of the image are noise. */
  minAreaShare?: number;
  maxShapes?: number;
}

const DEFAULTS = { minAreaShare: 0.0008, maxShapes: 60 } as const;

/** Luminance per pixel, 0 (black) to 255 (white). */
export function toGrayscale(image: RasterImage): Uint8Array {
  const gray = new Uint8Array(image.width * image.height);
  for (let index = 0; index < gray.length; index += 1) {
    const at = index * 4;
    const alpha = image.data[at + 3]! / 255;
    const luma =
      0.2126 * image.data[at]! +
      0.7152 * image.data[at + 1]! +
      0.0722 * image.data[at + 2]!;
    // Transparent pixels are paper, not ink.
    gray[index] = Math.round(luma * alpha + 255 * (1 - alpha));
  }
  return gray;
}

/**
 * Otsu's method: the threshold that best separates the histogram into two
 * groups. It copes with a photograph of a whiteboard, where "white" is grey.
 */
export function otsuThreshold(gray: Uint8Array): number {
  const histogram = new Array<number>(256).fill(0);
  for (const value of gray) histogram[value] += 1;

  const total = gray.length;
  let sum = 0;
  for (let value = 0; value < 256; value += 1) sum += value * histogram[value]!;

  let sumBackground = 0;
  let weightBackground = 0;
  let bestVariance = -1;
  // A crisp black-on-white drawing has an empty middle, so every threshold in
  // it scores the same. Taking the middle of that run puts the cut between the
  // two groups instead of hard against the dark one, which is what keeps the
  // grey of an anti-aliased or photographed line on the ink side.
  let tiedFrom = 0;
  let tiedTo = 0;

  for (let value = 0; value < 256; value += 1) {
    weightBackground += histogram[value]!;
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += value * histogram[value]!;
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance =
      weightBackground *
      weightForeground *
      (meanBackground - meanForeground) ** 2;

    if (variance > bestVariance) {
      bestVariance = variance;
      tiedFrom = value;
      tiedTo = value;
    } else if (variance === bestVariance) {
      tiedTo = value;
    }
  }
  return Math.round((tiedFrom + tiedTo) / 2);
}

/** True where there is ink. */
export function toInkMask(image: RasterImage, threshold?: number): Uint8Array {
  const gray = toGrayscale(image);
  const cut = threshold ?? otsuThreshold(gray);
  const mask = new Uint8Array(gray.length);
  for (let index = 0; index < gray.length; index += 1) {
    mask[index] = gray[index]! <= cut ? 1 : 0;
  }
  return mask;
}

export interface Component {
  box: Box;
  /** How many ink pixels the component has. */
  area: number;
  /** Ink pixels as a share of the bounding box: an outline is low, a blob high. */
  density: number;
}

/**
 * Connected regions of ink, eight-connected so a hand-drawn line survives its
 * own gaps at the diagonal. Iterative, because a recursive flood fill
 * overflows the stack on a full-page drawing.
 */
export function findComponents(
  mask: Uint8Array,
  width: number,
  height: number,
): Component[] {
  const seen = new Uint8Array(mask.length);
  const components: Component[] = [];
  const queue = new Int32Array(mask.length);

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;

    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    seen[start] = 1;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let area = 0;

    while (head < tail) {
      const index = queue[head++]!;
      const x = index % width;
      const y = (index - x) / width;
      area += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbour = ny * width + nx;
          if (mask[neighbour] && !seen[neighbour]) {
            seen[neighbour] = 1;
            queue[tail++] = neighbour;
          }
        }
      }
    }

    const box = {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
    components.push({
      box,
      area,
      density: area / Math.max(1, box.width * box.height),
    });
  }

  return components;
}

/** A connector is long and thin; a box encloses area. */
export function isConnector(component: Component): boolean {
  const { width, height } = component.box;
  const thin = Math.min(width, height) / Math.max(width, height, 1);
  return thin < 0.22 && Math.max(width, height) > 12;
}

function hasInk(
  mask: Uint8Array,
  imageWidth: number,
  x: number,
  y: number,
  radius: number,
): boolean {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const index = (y + dy) * imageWidth + (x + dx);
      if (index >= 0 && index < mask.length && mask[index]) return true;
    }
  }
  return false;
}

/**
 * Which shape an outline is, from whether its ink reaches the corners of its
 * bounding box: a rectangle's does, a rounded one's does not.
 *
 * It does not try to tell a diamond from an ellipse. Both leave the corners
 * empty, and separating them by hand-drawn curvature is guesswork — a wrong
 * shape the person has to notice is worse than an obvious one they change in
 * a click, so the editor offers the shape as a choice.
 */
export function classifyShape(
  component: Component,
  mask: Uint8Array,
  imageWidth: number,
): NodeShape {
  const { x, y, width, height } = component.box;
  // A patch anchored at the corner itself. Insetting it would step over the
  // very stroke it is looking for.
  const patch = Math.max(2, Math.round(Math.min(width, height) * 0.12));
  const half = Math.max(1, Math.floor(patch / 2));

  const corners = [
    [x + half, y + half],
    [x + width - 1 - half, y + half],
    [x + half, y + height - 1 - half],
    [x + width - 1 - half, y + height - 1 - half],
  ] as const;
  const inked = corners.filter(([cx, cy]) =>
    hasInk(mask, imageWidth, cx, cy, half),
  ).length;

  if (inked >= 3) return "rectangle";
  const square = Math.min(width, height) / Math.max(width, height, 1) > 0.82;
  return square ? "circle" : "rounded";
}

function centre(box: Box): [number, number] {
  return [box.x + box.width / 2, box.y + box.height / 2];
}

/** The two ends of a connector, along whichever axis it runs. */
function connectorEnds(box: Box): [[number, number], [number, number]] {
  return box.width >= box.height
    ? [
        [box.x, box.y + box.height / 2],
        [box.x + box.width, box.y + box.height / 2],
      ]
    : [
        [box.x + box.width / 2, box.y],
        [box.x + box.width / 2, box.y + box.height],
      ];
}

function nearestShape(
  point: [number, number],
  shapes: AnalysedShape[],
): { index: number; distance: number } | null {
  let best: { index: number; distance: number } | null = null;
  shapes.forEach((shape, index) => {
    const [cx, cy] = centre(shape.box);
    // Distance to the box, not to its middle: a wide box is near along its edge.
    const dx = Math.max(
      Math.abs(point[0] - cx) - shape.box.width / 2,
      0,
    );
    const dy = Math.max(
      Math.abs(point[1] - cy) - shape.box.height / 2,
      0,
    );
    const distance = Math.hypot(dx, dy);
    if (!best || distance < best.distance) best = { index, distance };
  });
  return best;
}

/** Reads an image into a diagram. */
export function analyseImage(
  image: RasterImage,
  options: AnalysisOptions = {},
): Analysis {
  const { minAreaShare, maxShapes } = { ...DEFAULTS, ...options };
  const mask = toInkMask(image, options.threshold);
  const components = findComponents(mask, image.width, image.height);
  const minArea = Math.max(24, image.width * image.height * minAreaShare);
  const kept = components.filter((component) => component.area >= minArea);

  const notes: string[] = [];
  const connectors = kept.filter(isConnector);
  const boxes = kept
    .filter((component) => !isConnector(component))
    // Reading order: down the page, then across.
    .sort(
      (left, right) =>
        left.box.y - right.box.y || left.box.x - right.box.x,
    )
    .slice(0, maxShapes);

  if (boxes.length === 0) {
    return {
      model: { ...emptyModel },
      shapes: [],
      notes: [
        "No shapes could be made out. A photograph works best when it is cropped to the drawing, evenly lit, and the lines are dark.",
      ],
    };
  }
  if (kept.filter((component) => !isConnector(component)).length > maxShapes) {
    notes.push(`Only the first ${maxShapes} shapes were read.`);
  }

  const shapes: AnalysedShape[] = boxes.map((component, index) => ({
    id: `box_${index + 1}`,
    shape: classifyShape(component, mask, image.width),
    box: component.box,
  }));

  // A connector joins the shapes nearest each of its ends. A gap wider than
  // this is a line that goes nowhere, and is left out rather than guessed.
  const reach = Math.max(image.width, image.height) * 0.12;
  const edges: DiagramEdge[] = [];
  const seen = new Set<string>();

  for (const connector of connectors) {
    const [start, end] = connectorEnds(connector.box);
    const from = nearestShape(start, shapes);
    const to = nearestShape(end, shapes);
    if (!from || !to || from.index === to.index) continue;
    if (from.distance > reach || to.distance > reach) continue;

    const key = `${from.index}->${to.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({
      from: shapes[from.index]!.id,
      to: shapes[to.index]!.id,
      label: null,
      kind: "arrow",
    });
  }

  if (connectors.length > 0 && edges.length === 0) {
    notes.push(
      "Lines were found but none clearly joined two shapes, so no connections were added.",
    );
  }
  notes.push(
    "The words were not read from the image. Each box is numbered, with a crop of it beside the name, so you can type the labels back in.",
  );
  notes.push("Shapes are a guess; change any of them in the list below.");
  // Arrowheads are not detected, so direction is a guess the person corrects.
  if (edges.length > 0) {
    notes.push("Every connection points one way; reverse any that are wrong.");
  }

  return {
    model: {
      direction: "TD",
      nodes: shapes.map((shape, index) => ({
        id: shape.id,
        label: `Box ${index + 1}`,
        shape: shape.shape,
        className: null,
      })),
      edges,
      residual: [],
    },
    shapes,
    notes,
  };
}
