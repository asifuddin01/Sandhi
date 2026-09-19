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
import {
  parseFlowchart,
  toMermaid,
  MAX_SOURCE_LENGTH,
} from "@/lib/diagrams/mermaid-source";
import {
  DIAGRAM_DIRECTIONS,
  directionLabels,
  type DiagramModel,
} from "@/lib/diagrams/model";
import { classDefinitions } from "@/lib/diagrams/palette";

import { ElementList } from "./ElementList";
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
  const firstClass = lines.findIndex((line) => line.trim().startsWith("class "));
  const at = firstClass === -1 ? lines.length : firstClass;
  lines.splice(at, 0, ...definitions);
  return `${lines.join("\n")}\n`;
}

export function DiagramWorkbench({
  action,
  id,
  initialTitle,
  initialSource,
  initialProjectId,
  projects,
  canSave,
  saveLabel,
}: WorkbenchProps) {
  const [title, setTitle] = useState(initialTitle);
  const [source, setSource] = useState(initialSource);
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [crops, setCrops] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [exporting, setExporting] = useState(false);
  const [exportProblem, setExportProblem] = useState<string | null>(null);

  const svg = useRef<SVGSVGElement | null>(null);
  const { state, formAction, onSubmit } = useFormAction(action, {
    status: "idle",
  });

  const parsed = useMemo(() => parseFlowchart(source), [source]);

  const onRendered = useCallback((element: SVGSVGElement | null) => {
    svg.current = element;
  }, []);

  /** A change in the visual editor is written straight back to the text. */
  const applyModel = useCallback((next: DiagramModel) => {
    setSource(withColours(next));
  }, []);

  const applyDrawing = useCallback((drawing: ImportedDrawing) => {
    setSource(toMermaid(drawing.model));
    setCrops(drawing.crops);
    setNotes(drawing.notes);
  }, []);

  async function save(chosen: ExportFormat) {
    setExportProblem(null);
    if (!svg.current) {
      setExportProblem("Draw the diagram before exporting it.");
      return;
    }
    setExporting(true);
    try {
      const blob = await exportDiagram(svg.current, chosen, {
        title: title || "Diagram",
        // Paper for the formats that cannot be transparent.
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
          {canSave ? (
            <div className={styles.rowActions}>
              <SubmitButton pending="Saving…">{saveLabel}</SubmitButton>
            </div>
          ) : null}
        </div>
        {canSave ? <ActionMessage state={state} /> : null}
      </form>

      <div className={styles.split}>
        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            <h2>Diagram</h2>
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
            </div>
          </div>
          <MermaidPreview source={source} onRendered={onRendered} />
          {exportProblem ? (
            <p className={styles.problem} role="alert">
              {exportProblem}
            </p>
          ) : null}
        </div>

        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            <h2>Mermaid</h2>
            <div className={styles.rowActions}>
              <label className="visually-hidden" htmlFor="diagram-direction">
                Direction
              </label>
              <select
                id="diagram-direction"
                value={parsed.model.direction}
                disabled={Boolean(parsed.problem)}
                onChange={(event) =>
                  applyModel({
                    ...parsed.model,
                    direction: event.target
                      .value as DiagramModel["direction"],
                  })
                }
              >
                {DIAGRAM_DIRECTIONS.map((value) => (
                  <option key={value} value={value}>
                    {directionLabels[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="visually-hidden" htmlFor="diagram-source">
            Mermaid source
          </label>
          <textarea
            id="diagram-source"
            className={styles.source}
            value={source}
            maxLength={MAX_SOURCE_LENGTH}
            spellCheck={false}
            rows={18}
            onChange={(event) => setSource(event.target.value)}
          />
          <p className={styles.hint}>
            Paste Mermaid here to bring a diagram in. The picture follows as you
            type.
          </p>
        </div>
      </div>

      <ImageImport onImported={applyDrawing} />

      {notes.length > 0 ? (
        <ul className={styles.notes}>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {parsed.problem ? (
        <p className={styles.note} role="status">
          {parsed.problem} The text above still works, and still exports.
        </p>
      ) : (
        <ElementList
          model={parsed.model}
          crops={crops}
          onChange={applyModel}
        />
      )}
    </div>
  );
}
