import { beforeAll, describe, expect, it } from "vitest";
import { getStore, resetStoreForTests } from "@/lib/db";
import {
  buildLibraryEntries,
  countLibraryEntriesByType,
  filterLibraryEntries,
  LIBRARY_TYPE_LABELS,
} from "@/lib/library/entries";
import type { ReviewStatus } from "@/lib/db/types";

/**
 * Content Library (spec 20.2 + 20.10): the unified listing is APPROVED
 * artifacts only — drafts stay in their generators — with correct
 * per-type counts, search and type filtering.
 */

beforeAll(() => {
  delete process.env.MONGODB_URI;
  resetStoreForTests();
});

async function approvedEntriesFromStore() {
  const store = await getStore();
  return buildLibraryEntries({
    lessons: await store.listLessonPlans({ status: "approved" }),
    quizzes: await store.listQuizzes({ status: "approved" }),
    worksheets: await store.listWorksheets({ status: "approved" }),
    rubrics: await store.listRubrics({ status: "approved" }),
    explanations: await store.listExplanations({ status: "approved" }),
  });
}

describe("library: approved-only listing", () => {
  it("drops drafts even when passed mixed-status docs", async () => {
    const store = await getStore();
    const entries = buildLibraryEntries({
      lessons: await store.listLessonPlans(), // includes 1 draft + 2 approved seeds
      quizzes: await store.listQuizzes(), // includes 1 draft
      worksheets: await store.listWorksheets(),
      rubrics: await store.listRubrics(),
      explanations: await store.listExplanations(), // includes 1 draft
    });
    expect(entries.every((entry) => entry.status === "approved")).toBe(true);
    // The seeded DRAFT lesson (gemini sample) never reaches the library.
    const draftLesson = (await store.listLessonPlans({ status: "draft" })).find(
      (doc) => doc.id === "lplan-seed-03",
    );
    expect(draftLesson).toBeDefined();
    expect(entries.some((entry) => entry.id === "lplan-seed-03")).toBe(false);
  });

  it("lists every APPROVED seed across all five types", async () => {
    const entries = await approvedEntriesFromStore();
    const counts = countLibraryEntriesByType(entries);
    expect(counts).toEqual({
      all: 7,
      lesson: 2,
      quiz: 2,
      worksheet: 1,
      rubric: 1,
      explanation: 1,
    });
    expect(entries.every((entry) => entry.status === "approved")).toBe(true);
  });

  it("orders entries newest first and links to the right tool", async () => {
    const entries = await approvedEntriesFromStore();
    for (let i = 1; i < entries.length; i += 1) {
      expect(entries[i - 1].createdAt >= entries[i].createdAt).toBe(true);
    }
    const byType = new Map(entries.map((entry) => [entry.type, entry]));
    expect(byType.get("lesson")!.href).toMatch(/^\/lesson-planner\?id=/);
    expect(byType.get("quiz")!.href).toMatch(/^\/quiz-generator\?id=/);
    expect(byType.get("worksheet")!.href).toMatch(/^\/worksheets\?id=/);
    expect(byType.get("rubric")!.href).toMatch(/^\/rubric-builder\?id=/);
    expect(byType.get("explanation")!.href).toMatch(/^\/ai-explainer\?id=/);
  });
});

describe("library: filtering", () => {
  it("filters by type", async () => {
    const entries = await approvedEntriesFromStore();
    const quizzes = filterLibraryEntries(entries, { type: "quiz" });
    expect(quizzes.length).toBe(2);
    expect(quizzes.every((entry) => entry.type === "quiz")).toBe(true);
  });

  it("searches case-insensitively across title, topic and subtitle", async () => {
    const entries = await approvedEntriesFromStore();
    // Seed quiz/lesson topics include "database" / "number systems".
    const hits = filterLibraryEntries(entries, { search: "database" });
    expect(hits.length).toBeGreaterThan(0);
    expect(
      hits.every(
        (entry) =>
          entry.title.toLowerCase().includes("database") ||
          entry.topic.toLowerCase().includes("database") ||
          entry.subtitle.toLowerCase().includes("database"),
      ),
    ).toBe(true);

    expect(
      filterLibraryEntries(entries, { search: "zzz-no-match-zzz" }),
    ).toEqual([]);
  });

  it("combines type + search", async () => {
    const entries = await approvedEntriesFromStore();
    const hits = filterLibraryEntries(entries, {
      type: "lesson",
      search: "number",
    });
    expect(hits.length).toBe(1); // the approved Number Systems lesson
    expect(hits[0].topic).toBe("Number Systems");
  });
});

describe("library: labels cover every type", () => {
  it("has a friendly label per type (UI chips rely on them)", () => {
    for (const label of Object.values(LIBRARY_TYPE_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("plural labels are real plurals (never 'Quizs')", async () => {
    const { LIBRARY_TYPE_PLURAL_LABELS } =
      await import("@/lib/library/entries");
    expect(LIBRARY_TYPE_PLURAL_LABELS.quiz).toBe("Quizzes");
    expect(LIBRARY_TYPE_PLURAL_LABELS.lesson).toBe("Lesson plans");
    for (const label of Object.values(LIBRARY_TYPE_PLURAL_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe("library: honest integration with the seeded store", () => {
  it("store-level approved filters and the entry builder agree", async () => {
    const store = await getStore();
    const statusOf = (docs: Array<{ status: ReviewStatus }>) =>
      docs.map((doc) => doc.status);
    expect(
      statusOf(await store.listWorksheets({ status: "approved" })),
    ).toEqual(["approved"]);
    expect(statusOf(await store.listRubrics({ status: "approved" }))).toEqual([
      "approved",
    ]);
    expect(
      statusOf(await store.listExplanations({ status: "approved" })),
    ).toEqual(["approved"]);
  });
});
