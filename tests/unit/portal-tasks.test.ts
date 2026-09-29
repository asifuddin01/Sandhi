import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  getDb: () => {
    throw new Error("not used");
  },
  isDatabaseConfigured: () => false,
}));

import { groupTasks, type MemberTask } from "@/lib/portal/tasks";

const NOW = new Date("2026-09-29T09:00:00.000Z");

function task(over: Partial<MemberTask> & { id: string }): MemberTask {
  return {
    title: over.id,
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    dueAt: null,
    project: { slug: "p", title: "A project" },
    ...over,
  };
}

function group(tasks: MemberTask[], key: string) {
  return groupTasks(tasks, NOW).find((found) => found.key === key)!;
}

describe("groupTasks", () => {
  it("splits by deadline against the moment it was given", () => {
    const tasks = [
      task({ id: "past", dueAt: new Date("2026-09-26T09:00:00.000Z") }),
      task({ id: "soon", dueAt: new Date("2026-10-02T09:00:00.000Z") }),
      task({ id: "later", dueAt: new Date("2026-11-02T09:00:00.000Z") }),
      task({ id: "undated" }),
    ];
    expect(group(tasks, "overdue").tasks.map((t) => t.id)).toEqual(["past"]);
    expect(group(tasks, "soon").tasks.map((t) => t.id)).toEqual(["soon"]);
    expect(group(tasks, "later").tasks.map((t) => t.id)).toEqual(["later"]);
    expect(group(tasks, "undated").tasks.map((t) => t.id)).toEqual(["undated"]);
  });

  it("does not call a task due this instant overdue", () => {
    const tasks = [task({ id: "now", dueAt: new Date(NOW) })];
    expect(group(tasks, "overdue").tasks).toHaveLength(0);
    expect(group(tasks, "soon").tasks.map((t) => t.id)).toEqual(["now"]);
  });

  it("keeps the last day of the fortnight inside it", () => {
    const tasks = [
      task({ id: "edge", dueAt: new Date("2026-10-13T09:00:00.000Z") }),
      task({ id: "past-edge", dueAt: new Date("2026-10-13T09:00:01.000Z") }),
    ];
    expect(group(tasks, "soon").tasks.map((t) => t.id)).toEqual(["edge"]);
    expect(group(tasks, "later").tasks.map((t) => t.id)).toEqual(["past-edge"]);
  });

  it("takes a finished task out of its deadline group", () => {
    // Done is done: an overdue date on it is history, not a demand.
    const tasks = [
      task({
        id: "done",
        status: "DONE",
        dueAt: new Date("2026-09-20T09:00:00.000Z"),
      }),
    ];
    expect(group(tasks, "overdue").tasks).toHaveLength(0);
    expect(group(tasks, "done").tasks.map((t) => t.id)).toEqual(["done"]);
  });

  it("runs dated groups soonest first", () => {
    const tasks = [
      task({ id: "b", dueAt: new Date("2026-10-05T09:00:00.000Z") }),
      task({ id: "a", dueAt: new Date("2026-10-01T09:00:00.000Z") }),
    ];
    expect(group(tasks, "soon").tasks.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("sorts undated work by priority, then by title", () => {
    const tasks = [
      task({ id: "m", title: "Middling", priority: "MEDIUM" }),
      task({ id: "u", title: "Urgent one", priority: "URGENT" }),
      task({ id: "l", title: "Low one", priority: "LOW" }),
      task({ id: "u2", title: "Another urgent", priority: "URGENT" }),
    ];
    expect(group(tasks, "undated").tasks.map((t) => t.id)).toEqual([
      "u2",
      "u",
      "m",
      "l",
    ]);
  });

  it("returns every group, empty ones included, in a fixed order", () => {
    expect(groupTasks([], NOW).map((found) => found.key)).toEqual([
      "overdue",
      "soon",
      "later",
      "undated",
      "done",
    ]);
  });
});
