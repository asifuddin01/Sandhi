/**
 * Turning a rendered diagram into a file. Everything here runs in the browser:
 * the SVG is already on the page, so there is nothing to send anywhere and
 * nothing to render twice.
 */

import { buildPdf, type PdfOptions } from "@/lib/diagrams/pdf";

export type ExportFormat = "svg" | "png" | "jpeg" | "pdf";

export const EXPORT_FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: "svg", label: "SVG" },
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "pdf", label: "PDF" },
];

/** Raster exports are drawn at twice the size, so they stay sharp when scaled. */
export const RASTER_SCALE = 2;

export function fileName(title: string, format: ExportFormat): string {
  const stem =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, 60) || "diagram";
  return `${stem}.${format}`;
}

/**
 * A standalone copy of the rendered SVG: explicit size and namespace, so it
 * opens in anything rather than only inside this page.
 */
export function standaloneSvg(svg: SVGSVGElement): {
  markup: string;
  width: number;
  height: number;
} {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const box = svg.getBoundingClientRect();
  const viewBox = svg.getAttribute("viewBox")?.split(/[\s,]+/u).map(Number);
  const width = Math.max(1, Math.round(viewBox?.[2] || box.width || 800));
  const height = Math.max(1, Math.round(viewBox?.[3] || box.height || 600));

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  clone.style.removeProperty("max-width");

  return {
    markup: `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`,
    width,
    height,
  };
}

/** Draws the SVG onto a canvas. JPEG and PDF have no transparency, so they get paper. */
export async function rasterise(
  svg: SVGSVGElement,
  background: string | null,
): Promise<HTMLCanvasElement> {
  const { markup, width, height } = standaloneSvg(svg);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;

  const image = new Image();
  image.decoding = "sync";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The diagram could not be drawn."));
    image.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width * RASTER_SCALE;
  canvas.height = height * RASTER_SCALE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot export images.");
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("The export was empty.")),
      type,
      type === "image/jpeg" ? 0.94 : undefined,
    );
  });
}

/** RGB without the alpha channel, composited on white, as a PDF wants it. */
function toRgb(canvas: HTMLCanvasElement): Uint8Array {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot export images.");
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const rgb = new Uint8Array((data.length / 4) * 3);
  for (let pixel = 0, at = 0; pixel < data.length; pixel += 4, at += 3) {
    rgb[at] = data[pixel]!;
    rgb[at + 1] = data[pixel + 1]!;
    rgb[at + 2] = data[pixel + 2]!;
  }
  return rgb;
}

/** zlib, from the platform: a PDF's FlateDecode wants exactly this. */
async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function exportDiagram(
  svg: SVGSVGElement,
  format: ExportFormat,
  options: { title: string; background: string } & PdfOptions,
): Promise<Blob> {
  if (format === "svg") {
    return new Blob([standaloneSvg(svg).markup], {
      type: "image/svg+xml;charset=utf-8",
    });
  }

  // PNG keeps transparency; JPEG and PDF cannot, so they are given paper.
  const canvas = await rasterise(
    svg,
    format === "png" ? null : options.background,
  );

  if (format === "png") return canvasToBlob(canvas, "image/png");
  if (format === "jpeg") return canvasToBlob(canvas, "image/jpeg");

  return new Blob(
    [
      buildPdf(
        {
          width: canvas.width,
          height: canvas.height,
          deflated: await deflate(toRgb(canvas)),
        },
        { title: options.title },
      ) as BlobPart,
    ],
    { type: "application/pdf" },
  );
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next frame, so the click has already started the save.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}
