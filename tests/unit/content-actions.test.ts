import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { Prisma } from "@/generated/prisma/client";
import {
  isUniqueConflict,
  uniqueConflictTarget,
} from "@/lib/admin/content-actions";

function conflict(
  meta: Record<string, unknown>,
  message = "Unique constraint failed",
) {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code: "P2002",
    clientVersion: "7.10.0",
    meta,
  });
}

describe("uniqueConflictTarget", () => {
  it("reads the classic client's field list", () => {
    expect(uniqueConflictTarget(conflict({ target: ["doi"] }))).toContain(
      "doi",
    );
    expect(
      uniqueConflictTarget(conflict({ target: "Publication_slug_key" })),
    ).toContain("slug");
  });

  /**
   * The pg driver adapter this project uses reports the constraint here, not
   * in `target`, so a manager that read only `target` would name nothing.
   */
  it("reads the driver adapter's constraint", () => {
    const target = uniqueConflictTarget(
      conflict({
        modelName: "Publication",
        driverAdapterError: {
          name: "DriverAdapterError",
          cause: {
            originalCode: "23505",
            originalMessage:
              'duplicate key value violates unique constraint "Publication_arxivId_key"',
            kind: "UniqueConstraintViolation",
            constraint: { index: "Publication_arxivId_key" },
            table: "Publication",
          },
        },
      }),
    );
    expect(target).toContain("arxiv");
    expect(target).not.toContain("doi");
  });

  it("falls back to the message when the metadata says nothing", () => {
    expect(
      uniqueConflictTarget(
        conflict({}, "Unique constraint failed on `Publication_doi_key`"),
      ),
    ).toContain("doi");
  });

  it("is empty for anything that is not a unique conflict", () => {
    expect(uniqueConflictTarget(new Error("boom"))).toBe("");
    expect(uniqueConflictTarget(null)).toBe("");
    expect(
      isUniqueConflict(
        new Prisma.PrismaClientKnownRequestError("not found", {
          code: "P2025",
          clientVersion: "7.10.0",
        }),
      ),
    ).toBe(false);
  });
});
