"use client";

import { useRef, useState } from "react";

import {
  analyseImage,
  type AnalysedShape,
} from "@/lib/diagrams/image-to-mermaid";
import type { DiagramModel } from "@/lib/diagrams/model";

import styles from "./Diagrams.module.css";

/** Big enough to read the shapes, small enough to analyse in a moment. */
const WORKING_EDGE = 1000;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

export interface ImportedDrawing {
  model: DiagramModel;
  shapes: AnalysedShape[];
  notes: string[];
  /** A crop of each shape, keyed by node id, for naming them afterwards. */
  crops: Record<string, string>;
}

/**
 * Reads a photograph or a sketch into a diagram, entirely in this browser:
 * the file is decoded onto a canvas and analysed here, so the picture is never
 * uploaded anywhere.
 */
export function ImageImport({
  onImported,
}: {
  onImported: (drawing: ImportedDrawing) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function read(file: File) {
    setProblem(null);
    if (!file.type.startsWith("image/")) {
      setProblem("Choose an image file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setProblem("That image is larger than 12 MB.");
      return;
    }

    setBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(
        1,
        WORKING_EDGE / Math.max(bitmap.width, bitmap.height),
      );
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("This browser cannot read images.");
      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();

      const image = context.getImageData(0, 0, width, height);
      const analysis = analyseImage(image);

      // A crop of each shape, so the boxes can be named from what was drawn.
      const crops: Record<string, string> = {};
      for (const shape of analysis.shapes) {
        const pad = 4;
        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = shape.box.width + pad * 2;
        cropCanvas.height = shape.box.height + pad * 2;
        const cropContext = cropCanvas.getContext("2d");
        if (!cropContext) continue;
        cropContext.fillStyle = "#ffffff";
        cropContext.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
        cropContext.drawImage(
          canvas,
          Math.max(0, shape.box.x - pad),
          Math.max(0, shape.box.y - pad),
          cropCanvas.width,
          cropCanvas.height,
          0,
          0,
          cropCanvas.width,
          cropCanvas.height,
        );
        crops[shape.id] = cropCanvas.toDataURL("image/png");
      }

      onImported({ ...analysis, crops });
    } catch (error) {
      console.error("[diagrams] image import failed:", error);
      setProblem("That image could not be read.");
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={styles.importPanel}>
      <label className={styles.fileLabel} htmlFor="diagram-image">
        Read a drawing
      </label>
      <input
        ref={input}
        id="diagram-image"
        type="file"
        accept="image/*"
        disabled={busy}
        aria-describedby="diagram-image-hint"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void read(file);
        }}
      />
      <p id="diagram-image-hint" className={styles.hint}>
        A photograph of a whiteboard or a sketch. It is read in this browser and
        never uploaded. The shapes and the lines between them come across; the
        words do not, so each box arrives numbered with a crop beside it.
      </p>
      {busy ? (
        <p className={styles.note} role="status">
          Reading the drawing…
        </p>
      ) : null}
      {problem ? (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
