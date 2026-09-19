"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { ActionMessage, SubmitButton } from "@/components/admin/AdminForms";
import { useFormAction } from "@/components/forms/useFormAction";
import {
  download,
  EXPORT_FORMATS,
  exportDiagram,
  fileName,
  type ExportFormat,
} from "@/lib/diagrams/browser-export";
import { layoutModel } from "@/lib/diagrams/layout";
import {
  parseFlowchart,
  toMermaid,
  MAX_SOURCE_LENGTH,
} from "@/lib/diagrams/mermaid-source";
import { applyStoredLayout, toStoredLayout } from "@/lib/diagrams/persist";
import type { DiagramModel } from "@/lib/diagrams/model";
import { classDefinitions } from "@/lib/diagrams/palette";

import { DiagramCanvas, type Selection } from "./DiagramCanvas";
import { ShapePalette, StylePanel } from "./CanvasSidebars";
import { ImageImport, type ImportedDrawing } from "./ImageImport";
import { MermaidPreview } from "./MermaidPreview";
import styles from "./Diagrams.module.css";

export const STARTER_SOURCE = `flowchart TD
  browser["Browser"] --> edge(["Edge"])
  edge --> app["Application"]
  app --> db[("Database")]
`;

type SaveAction = (
  previous: { status: "idle" | "success" | "error"; message?: string },
  formData: FormData,
) => Promise<{ status: "idle" | "success" | "error"; message?: string }>;

export interface WorkbenchProps {
  action: SaveAction;
  id?: string;
  initialTitle: string;
  initialSource: string;
  initialLayout: unknown;
  initialProjectId: string | null;
  projects: ReadonlyArray<{ id: string; title: string }>;
  /** Shown only to the owner; a teammate reads without the save button. */
  canSave: boolean;
  saveLabel: string;
}

/** The colour definitions a diagram needs, appended so exports carry them. */
function withColours(model: DiagramModel): string {
  const used = model.nodes
    .map((node) => node.className)
    .filter((name): name is string => Boolean(name));
  const source = toMermaid(model);
  const definitions = classDefinitions(used);
  if (definitions.length === 0) return source;
  // Before the `class` lines that reference them.
  const lines = source.trimEnd().split("\n");
  const firstClass = lines.findIndex((line) =>
    line.trim().startsWith("class "),
  );
  const at = firstClass === -1 ? lines.length : firstClass;
  lines.splice(at, 0, ...definitions);
  return `${lines.join("\n")}\n`;
}

export function DiagramWorkbench({
  action,
  id,
  initialTitle,
  initialSource,
  initialLayout,
  initialProjectId,
  projects,
  canSave,
  saveLabel,
}: WorkbenchProps) {
  const [title, setTitle] = useState(initialTitle);
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [crops, setCrops] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [exporting, setExporting] = useState(false);
  const [exportProblem, setExportProblem] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [showCode, setShowCode] = useState(true);

  /**
   * The model is what the canvas edits; the Mermaid text is written from it.
   * Text pasted in replaces the model, and anything with no position is laid
   * out once — Mermaid carries no coordinates, so they have to come from
   * somewhere, and after that a box stays where it was put.
   */
  const [model, setModel] = useState<DiagramModel>(() => {
    const parsed = parseFlowchart(initialSource);
    return layoutModel(applyStoredLayout(parsed.model, initialLayout));
  });
  const [problem, setProblem] = useState<string | null>(
    () => parseFlowchart(initialSource).problem,
  );

  const svg = useRef<SVGSVGElement | null>(null);
  const board = useRef<SVGSVGElement | null>(null);
  const { state, formAction, onSubmit } = useFormAction(action, {
    status: "idle",
  });

  const source = useMemo(() => withColours(model), [model]);

  const onRendered = useCallback((element: SVGSVGElement | null) => {
    svg.current = element;
  }, []);

  const holdBoard = useCallback((element: SVGSVGElement | null) => {
    board.current = element;
  }, []);

  /** Text edited by hand becomes the model again, keeping known positions. */
  const applySource = useCallback((text: string) => {
    const parsed = parseFlowchart(text);
    setProblem(parsed.problem);
    if (parsed.problem) return;
    setModel((current) =>
      layoutModel(applyStoredLayout(parsed.model, toStoredLayout(current))),
    );
  }, []);

  const applyDrawing = useCallback((drawing: ImportedDrawing) => {
    setProblem(null);
    setModel(layoutModel(drawing.model));
    setCrops(drawing.crops);
    setNotes(drawing.notes);
    setSelection(null);
  }, []);

  async function save(chosen: ExportFormat) {
    setExportProblem(null);
    // The canvas is what is on screen, so it is what gets exported.
    const target = board.current ?? svg.current;
    if (!target) {
      setExportProblem("Draw the diagram before exporting it.");
      return;
    }
    setExporting(true);
    try {
      const blob = await exportDiagram(target, chosen, {
        title: title || "Diagram",
        background: "#0d131c",
      });
      download(blob, fileName(title || "diagram", chosen));
    } catch (error) {
      console.error("[diagrams] export failed:", error);
      setExportProblem("That export did not finish. Try another format.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={styles.workbench}>
      <form
        className={styles.controls}
        action={formAction}
        onSubmit={onSubmit}
        id="diagram-form"
      >
        {id ? <input type="hidden" name="id" value={id} /> : null}
        <input type="hidden" name="source" value={source} />
        <input
          type="hidden"
          name="layout"
          value={JSON.stringify(toStoredLayout(model))}
        />

        <div className={styles.controlRow}>
          <div className={styles.field}>
            <label htmlFor="diagram-title">Name</label>
            <input
              id="diagram-title"
              name="title"
              value={title}
              maxLength={160}
              required
              readOnly={!canSave}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="diagram-project">Project</label>
            <select
              id="diagram-project"
              name="projectId"
              value={projectId}
              disabled={!canSave}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">Just mine</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.rowActions}>
            <label className="visually-hidden" htmlFor="diagram-format">
              Export format
            </label>
            <select
              id="diagram-format"
              value={format}
              onChange={(event) =>
                setFormat(event.target.value as ExportFormat)
              }
            >
              {EXPORT_FORMATS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.quietButton}
              disabled={exporting}
              onClick={() => void save(format)}
            >
              {exporting ? "Exporting…" : "Export"}
            </button>
            {canSave ? (
              <SubmitButton pending="Saving…">{saveLabel}</SubmitButton>
            ) : null}
          </div>
        </div>
        {canSave ? <ActionMessage state={state} /> : null}
        {exportProblem ? (
          <p className={styles.problem} role="alert">
            {exportProblem}
          </p>
        ) : null}
      </form>

      <div className={styles.studio}>
        <ShapePalette
          model={model}
          onChange={setModel}
          onSelect={setSelection}
        />
        <div className={styles.boardWrap}>
          <DiagramCanvas
            onMounted={holdBoard}
            model={model}
            selection={selection}
            onSelect={setSelection}
            onChange={setModel}
            readOnly={!canSave}
          />
        </div>
        <StylePanel
          model={model}
          selection={selection}
          onChange={setModel}
          onSelect={setSelection}
        />
      </div>

      <section className={styles.codeSection} aria-labelledby="diagram-code">
        <div className={styles.paneHeader}>
          <h2 id="diagram-code">Mermaid</h2>
          <button
            type="button"
            className={styles.quietButton}
            aria-expanded={showCode}
            onClick={() => setShowCode((open) => !open)}
          >
            {showCode ? "Hide the code" : "Show the code"}
          </button>
        </div>

        {showCode ? (
          <div className={styles.split}>
            <div className={styles.pane}>
              <label className="visually-hidden" htmlFor="diagram-source">
                Mermaid source
              </label>
              <textarea
                id="diagram-source"
                className={styles.source}
                value={source}
                maxLength={MAX_SOURCE_LENGTH}
                spellCheck={false}
                rows={16}
                onChange={(event) => applySource(event.target.value)}
              />
              <p className={styles.hint}>
                Written from the canvas, and read back as you type. Paste
                Mermaid here to bring a diagram in.
              </p>
              {problem ? (
                <p className={styles.problem} role="status">
                  {problem}
                </p>
              ) : null}
            </div>
            <div className={styles.pane}>
              <p className={styles.hint}>As Mermaid draws it</p>
              <MermaidPreview source={source} onRendered={onRendered} />
            </div>
          </div>
        ) : null}
      </section>

      <ImageImport onImported={applyDrawing} />

      {notes.length > 0 ? (
        <ul className={styles.notes}>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {Object.keys(crops).length > 0 ? (
        <section aria-labelledby="diagram-crops">
          <h3 id="diagram-crops">What was drawn</h3>
          <div className={styles.cropRow}>
            {model.nodes.map((node) =>
              crops[node.id] ? (
                <figure className={styles.cropFigure} key={node.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className={styles.crop}
                    src={crops[node.id]}
                    alt={`How ${node.label} was drawn`}
                  />
                  <figcaption>{node.label}</figcaption>
                </figure>
              ) : null,
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
