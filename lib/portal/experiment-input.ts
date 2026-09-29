import {
  MAX_DATASET_REF,
  MAX_DATASETS,
  MAX_JSON_TEXT,
  MAX_TRACKING_URL,
} from "@/lib/portal/experiment-limits";

/**
 * Reading what somebody typed into the experiment form.
 *
 * Pure, and separate from the action, so each refusal can be tested without
 * a database or a session — these are the three fields where a wrong answer
 * matters: JSON that does not parse, a dataset list without end, and a link
 * that is not a link.
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

export interface JsonField {
  /** False when the field was left empty, which is not the same as `null`. */
  present: boolean;
  value: unknown;
}

/**
 * Configuration or results, as typed. The length is checked before parsing,
 * so the cap bounds the work `JSON.parse` is asked to do and not only what
 * ends up stored.
 */
export function parseJsonField(raw: string, label: string): Parsed<JsonField> {
  const text = raw.trim();
  if (!text) return { ok: true, value: { present: false, value: null } };
  if (text.length > MAX_JSON_TEXT) {
    return { ok: false, message: `Keep the ${label} shorter.` };
  }
  try {
    return {
      ok: true,
      value: { present: true, value: JSON.parse(text) as unknown },
    };
  } catch {
    return { ok: false, message: `The ${label} is not valid JSON.` };
  }
}

/** One dataset per line: a name, a path, a DOI — whatever identifies it. */
export function parseDatasets(raw: string): Parsed<string[]> {
  const refs = [
    ...new Set(
      raw
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
  if (refs.length > MAX_DATASETS) {
    return { ok: false, message: `Name at most ${MAX_DATASETS} datasets.` };
  }
  if (refs.some((ref) => ref.length > MAX_DATASET_REF)) {
    return { ok: false, message: "One of those dataset names is too long." };
  }
  return { ok: true, value: refs };
}

/**
 * Where the runs live. It ends up in an `href`, so the scheme is checked
 * rather than assumed: `javascript:` parses as a URL perfectly well.
 */
export function parseTrackingUrl(raw: string): Parsed<string | null> {
  const text = raw.trim();
  if (!text) return { ok: true, value: null };

  const refusal = {
    ok: false as const,
    message: "The tracking link needs a full https:// address.",
  };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return refusal;
  }
  if (url.protocol !== "https:" || text.length > MAX_TRACKING_URL) {
    return refusal;
  }
  return { ok: true, value: url.toString() };
}
