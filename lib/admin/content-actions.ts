import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  AdminActionError,
  recordAudit,
  type ActionState,
} from "@/lib/admin/actions";
import type { Viewer } from "@/lib/authz";
import {
  deletable,
  parseBulkAction,
  type BulkAction,
  type PublishStateValue,
} from "@/lib/content-state";
import { getDb } from "@/lib/db";
import { fromDhakaInput } from "@/lib/dhaka-time";

/** Reading and checking the fields every content editor shares. */
export function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function requiredText(
  formData: FormData,
  name: string,
  label: string,
  max: number,
): string {
  const value = field(formData, name).trim();
  if (!value) throw new AdminActionError(`Enter ${label}.`);
  if (value.length > max) {
    throw new AdminActionError(`Keep ${label} under ${max} characters.`);
  }
  return value;
}

export function optionalText(
  formData: FormData,
  name: string,
  label: string,
  max: number,
): string | null {
  const value = field(formData, name).trim();
  if (value.length > max) {
    throw new AdminActionError(`Keep ${label} under ${max} characters.`);
  }
  return value || null;
}

export function markdownText(
  formData: FormData,
  name: string,
  label: string,
  max = 100_000,
): string {
  const value = field(formData, name);
  if (!value.trim()) throw new AdminActionError(`Write ${label}.`);
  if (value.length > max) {
    throw new AdminActionError(`${label} is too long to save.`);
  }
  return value;
}

/** Links shown to visitors must be complete https addresses. */
export function optionalHttpsUrl(
  formData: FormData,
  name: string,
  label: string,
): string | null {
  const value = field(formData, name).trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AdminActionError(`${label} needs a full https:// address.`);
  }
  if (url.protocol !== "https:" || value.length > 500) {
    throw new AdminActionError(`${label} needs a full https:// address.`);
  }
  return url.toString();
}

/** One item per line, blank lines ignored. */
export function lines(
  formData: FormData,
  name: string,
  label: string,
  { maxItems = 20, maxLength = 300 } = {},
): string[] {
  const items = field(formData, name)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (items.length > maxItems) {
    throw new AdminActionError(`List at most ${maxItems} ${label}.`);
  }
  if (items.some((item) => item.length > maxLength)) {
    throw new AdminActionError(
      `Keep each of the ${label} under ${maxLength} characters.`,
    );
  }
  return items;
}

export function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

export function dhakaTime(
  formData: FormData,
  name: string,
  label: string,
  { required = false } = {},
): Date | null {
  const value = field(formData, name).trim();
  if (!value) {
    if (required) throw new AdminActionError(`Choose ${label}.`);
    return null;
  }
  const date = fromDhakaInput(value);
  if (!date) throw new AdminActionError(`Enter a valid ${label}.`);
  return date;
}

export function oneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  message: string,
): T {
  if (!allowed.includes(value as T)) throw new AdminActionError(message);
  return value as T;
}

export function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * What changed, for the audit log. Long text fields are recorded as changed
 * rather than copied, so the log never duplicates whole articles.
 */
export function changes(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  longFields: readonly string[] = [],
): Record<string, { from: unknown; to: unknown }> {
  const same = (a: unknown, b: unknown) =>
    a instanceof Date && b instanceof Date
      ? a.getTime() === b.getTime()
      : JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(after)) {
    if (same(before[key], value)) continue;
    diff[key] = longFields.includes(key)
      ? { from: "(previous text)", to: "(new text)" }
      : { from: before[key] ?? null, to: value ?? null };
  }
  return diff;
}

const MAX_BULK = 100;

type BulkRow = { id: string; state: string; publishAt?: Date | null };

export interface BulkModel<Row extends BulkRow> {
  /** Audit entity, e.g. "Event", and action prefix, e.g. "event". */
  entity: string;
  prefix: string;
  noun: { one: string; many: string };
  load: (ids: string[]) => Promise<Row[]>;
  update: (
    transaction: Prisma.TransactionClient,
    id: string,
    data: { state: PublishStateValue; publishAt?: Date | null },
  ) => Promise<unknown>;
  remove: (
    transaction: Prisma.TransactionClient,
    id: string,
  ) => Promise<unknown>;
  /** Why this record must not be deleted, if it must not. */
  keep?: (row: Row) => string | null;
  /** Whether the model has a publish time to set when publishing now. */
  hasPublishAt?: boolean;
}

const targetState: Record<Exclude<BulkAction, "delete">, PublishStateValue> = {
  publish: "PUBLISHED",
  draft: "DRAFT",
  archive: "ARCHIVED",
};

/** Applies one bulk action to the selected records, auditing each. */
export async function runBulk<Row extends BulkRow>(
  viewer: Viewer,
  formData: FormData,
  model: BulkModel<Row>,
): Promise<ActionState> {
  const action = parseBulkAction(field(formData, "bulkAction"));
  if (!action) throw new AdminActionError("Choose what to do.");
  const ids = [
    ...new Set(
      formData
        .getAll("ids")
        .filter((id): id is string => typeof id === "string"),
    ),
  ].slice(0, MAX_BULK);
  if (ids.length === 0) {
    throw new AdminActionError(`Select at least one ${model.noun.one}.`);
  }

  const rows = await model.load(ids);
  const now = new Date();
  const kept: string[] = [];
  let changed = 0;

  await getDb().$transaction(async (transaction) => {
    for (const row of rows) {
      const state = row.state as PublishStateValue;
      if (action === "delete") {
        const reason = !deletable(state)
          ? "published or in review: archive it first"
          : (model.keep?.(row) ?? null);
        if (reason) {
          kept.push(reason);
          continue;
        }
        await model.remove(transaction, row.id);
      } else {
        const nextState = targetState[action];
        const publishAt =
          model.hasPublishAt && action === "publish"
            ? !row.publishAt || row.publishAt > now
              ? now
              : row.publishAt
            : undefined;
        const sameTime =
          publishAt === undefined ||
          publishAt?.getTime() === row.publishAt?.getTime();
        // Already in that state: nothing to write or record.
        if (state === nextState && sameTime) continue;
        await model.update(transaction, row.id, {
          state: nextState,
          ...(model.hasPublishAt ? { publishAt } : {}),
        });
      }
      changed += 1;
      await recordAudit(transaction, {
        actorId: viewer.userId,
        action: `${model.prefix}.${action}`,
        entity: model.entity,
        entityId: row.id,
        diff: {
          state: {
            from: state,
            to: action === "delete" ? null : targetState[action],
          },
        },
      });
    }
  });

  const verb = {
    publish: "published",
    draft: "moved to draft",
    archive: "archived",
    delete: "deleted",
  }[action];
  const reasons = [...new Set(kept)];
  return {
    status: "success",
    message:
      kept.length > 0
        ? `${changed} ${verb}. ${kept.length} kept (${reasons.join("; ")}).`
        : `${changed} ${verb}.`,
  };
}
