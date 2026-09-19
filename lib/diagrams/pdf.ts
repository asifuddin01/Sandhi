/**
 * A one-page PDF wrapping a single image, written by hand.
 *
 * A dependency is not worth it for this: the file is a handful of objects and
 * an offset table, and the project already hand-writes what it only needs a
 * little of (the R2 request signer). The pixels arrive already zlib-deflated,
 * which is exactly what a PDF's FlateDecode filter wants, so the image goes in
 * losslessly and the caller does the compressing where `CompressionStream`
 * lives.
 */

export interface PdfImage {
  width: number;
  height: number;
  /** Zlib-deflated RGB, three bytes per pixel, no alpha. */
  deflated: Uint8Array;
}

/** A4 at 72 points to the inch, the unit PDF measures in. */
export const A4_LANDSCAPE = { width: 842, height: 595 } as const;
export const A4_PORTRAIT = { width: 595, height: 842 } as const;
const MARGIN = 28;

export interface PdfOptions {
  /** Defaults to whichever way round suits the image. */
  page?: { width: number; height: number };
  title?: string;
}

/** Escapes a string for a PDF text object. */
function pdfString(value: string): string {
  return `(${value.replace(/([\\()])/gu, "\\$1").replace(/[\r\n]/gu, " ")})`;
}

/** The image, centred and scaled to fit inside the margins without cropping. */
export function fitImage(
  image: { width: number; height: number },
  page: { width: number; height: number },
): { width: number; height: number; x: number; y: number } {
  const available = {
    width: page.width - MARGIN * 2,
    height: page.height - MARGIN * 2,
  };
  const scale = Math.min(
    available.width / image.width,
    available.height / image.height,
    // Never blow a small diagram up past its own pixels.
    1,
  );
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    width,
    height,
    x: (page.width - width) / 2,
    y: (page.height - height) / 2,
  };
}

export function buildPdf(image: PdfImage, options: PdfOptions = {}): Uint8Array {
  const page =
    options.page ??
    (image.width >= image.height ? A4_LANDSCAPE : A4_PORTRAIT);
  const placed = fitImage(image, page);

  const content = `q\n${placed.width.toFixed(2)} 0 0 ${placed.height.toFixed(
    2,
  )} ${placed.x.toFixed(2)} ${placed.y.toFixed(2)} cm\n/Im0 Do\nQ\n`;

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const startObject = (number: number) => {
    offsets[number] = length;
    push(`${number} 0 obj\n`);
  };

  push("%PDF-1.7\n");
  // A comment of high bytes marks the file as binary for anything that
  // still transfers files as text.
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  startObject(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  startObject(2);
  push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  startObject(3);
  push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] ` +
      `/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`,
  );

  startObject(4);
  push(`<< /Length ${encoder.encode(content).length} >>\nstream\n`);
  push(content);
  push("endstream\nendobj\n");

  startObject(5);
  push(
    `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ` +
      `/Length ${image.deflated.length} >>\nstream\n`,
  );
  push(image.deflated);
  push("\nendstream\nendobj\n");

  startObject(6);
  push(
    `<< /Title ${pdfString(options.title ?? "Diagram")} /Producer ${pdfString(
      "SANDHI Research Lab",
    )} >>\nendobj\n`,
  );

  const xref = length;
  const count = 7;
  push(`xref\n0 ${count}\n`);
  push("0000000000 65535 f \n");
  for (let number = 1; number < count; number += 1) {
    push(`${String(offsets[number] ?? 0).padStart(10, "0")} 00000 n \n`);
  }
  push(
    `trailer\n<< /Size ${count} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );

  const pdf = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    pdf.set(part, at);
    at += part.length;
  }
  return pdf;
}
