import { beforeAll, describe, expect, it } from "vitest";
import { getStore, resetStoreForTests } from "@/lib/db";
import type { CreateQuestionInput } from "@/lib/db/types";

/**
 * Question Bank rules (spec 20.5): zod-validated CRUD, status transitions
 * (draft -> published, archive/restore), archived excluded from the default
 * listing, published-only export surface, bulk ops, pagination at 15/page.
 */

const TEACHER = "usr-teacher-01";
const PAGINATION_TOPIC = "Pagination Probe Topic";

function mcqInput(overrides: Partial<CreateQuestionInput> = {}): CreateQuestionInput {
  return {
    question: "What is the binary form of the decimal number 10?",
    type: "mcq",
    difficulty: "easy",
    topic: "Number Systems",
    learningObjective: "Students can convert decimal to binary.",
    options: ["1000", "1010", "1100", "1110"],
    answer: "1010",
    explanation: "10 = 8 + 2 = 1010 in binary.",
    tags: ["ssc", "conversion"],
    source: "manual",
    createdBy: TEACHER,
    ...overrides,
  };
}

beforeAll(() => {
  delete process.env.MONGODB_URI;
  resetStoreForTests();
});

describe("question bank: validated creation", () => {
  it("creates a manual question as a draft", async () => {
    const store = await getStore();
    const question = await store.createQuestion(mcqInput());
    expect(question.status).toBe("draft");
    expect(question.source).toBe("manual");
    expect(question.id).toMatch(/^q-/);
  });

  it("rejects an mcq without exactly 4 options", async () => {
    const store = await getStore();
    await expect(
      store.createQuestion(mcqInput({ options: ["1000", "1010", "1100"] })),
    ).rejects.toThrow(/exactly 4 options/i);
  });

  it("rejects an mcq whose answer is not among the options", async () => {
    const store = await getStore();
    await expect(
      store.createQuestion(mcqInput({ answer: "1020" })),
    ).rejects.toThrow(/answer must match one of the options/i);
  });

  it("rejects a true/false question with a non-boolean answer", async () => {
    const store = await getStore();
    await expect(
      store.createQuestion(
        mcqInput({
          question: "One byte is 8 bits.",
          type: "true_false",
          options: undefined,
          answer: "maybe",
        }),
      ),
    ).rejects.toThrow(/'true' or 'false'/i);
  });
});

describe("question bank: status transitions", () => {
  it("publishes a draft, archives it and restores it to draft", async () => {
    const store = await getStore();
    const question = await store.createQuestion(mcqInput({ question: "Publish probe: bits in a byte?" }));

    expect((await store.setQuestionStatus(question.id, "published", TEACHER))?.status).toBe("published");
    expect((await store.setQuestionStatus(question.id, "archived", TEACHER))?.status).toBe("archived");
    expect((await store.setQuestionStatus(question.id, "draft", TEACHER))?.status).toBe("draft");
  });

  it("archives record who changed the status (audit-lite)", async () => {
    const store = await getStore();
    const question = await store.createQuestion(mcqInput({ question: "Audit probe: who archived this?" }));
    const archived = await store.setQuestionStatus(question.id, "archived", "usr-teacher-02");
    expect(archived?.updatedBy).toBe("usr-teacher-02");
  });

  it("excludes archived questions from the default listing but shows them on request", async () => {
    const store = await getStore();
    const active = await store.createQuestion(mcqInput({ question: "Active probe question" }));
    const archived = await store.createQuestion(mcqInput({ question: "Archive probe question" }));
    await store.setQuestionStatus(archived.id, "archived", TEACHER);

    const activeOnly = await store.listQuestions({ topic: "Number Systems" });
    expect(activeOnly.items.some((item) => item.id === active.id)).toBe(true);
    expect(activeOnly.items.some((item) => item.id === archived.id)).toBe(false);

    const archivedView = await store.listQuestions({ status: "archived", topic: "Number Systems" });
    expect(archivedView.items.some((item) => item.id === archived.id)).toBe(true);
    expect(archivedView.items.some((item) => item.id === active.id)).toBe(false);
  });

  it("export surface (status=published) contains only published questions", async () => {
    const store = await getStore();
    const draft = await store.createQuestion(mcqInput({ question: "Export probe draft question" }));
    const published = await store.createQuestion(mcqInput({ question: "Export probe published question" }));
    await store.setQuestionStatus(published.id, "published", TEACHER);
    const archived = await store.createQuestion(mcqInput({ question: "Export probe archived question" }));
    await store.setQuestionStatus(archived.id, "archived", TEACHER);

    const exportView = await store.listQuestions({ status: "published", topic: "Number Systems" });
    expect(exportView.items.some((item) => item.id === published.id)).toBe(true);
    expect(exportView.items.some((item) => item.id === draft.id)).toBe(false);
    expect(exportView.items.some((item) => item.id === archived.id)).toBe(false);
  });
});

describe("question bank: duplicate", () => {
  it("copies a question into a fresh draft with a new id", async () => {
    const store = await getStore();
    const original = await store.createQuestion(mcqInput({ question: "Duplicate probe question" }));
    await store.setQuestionStatus(original.id, "published", TEACHER);

    const copy = await store.duplicateQuestion(original.id, "usr-teacher-02");
    expect(copy).not.toBeNull();
    expect(copy!.id).not.toBe(original.id);
    expect(copy!.status).toBe("draft");
    expect(copy!.question).toBe(original.question);
    expect(copy!.source).toBe(original.source); // provenance is kept honestly
    const reread = await store.getQuestion(copy!.id);
    expect(reread?.status).toBe("draft");
  });
});

describe("question bank: bulk operations", () => {
  it("bulk publishes and bulk archives the selected ids", async () => {
    const store = await getStore();
    const a = await store.createQuestion(mcqInput({ question: "Bulk probe question A" }));
    const b = await store.createQuestion(mcqInput({ question: "Bulk probe question B" }));
    const c = await store.createQuestion(mcqInput({ question: "Bulk probe question C" }));

    const publishedCount = await store.bulkSetQuestionStatus([a.id, b.id, c.id], "published", TEACHER);
    expect(publishedCount).toBe(3);
    expect((await store.getQuestion(a.id))?.status).toBe("published");

    const archivedCount = await store.bulkSetQuestionStatus([a.id, b.id], "archived", TEACHER);
    expect(archivedCount).toBe(2);
    expect((await store.getQuestion(a.id))?.status).toBe("archived");
    expect((await store.getQuestion(c.id))?.status).toBe("published");
  });

  it("ignores unknown ids in bulk updates", async () => {
    const store = await getStore();
    const count = await store.bulkSetQuestionStatus(["q-nope-1", "q-nope-2"], "archived", TEACHER);
    expect(count).toBe(0);
  });
});

describe("question bank: pagination (15/page) and search", () => {
  beforeAll(async () => {
    // 18 questions in one topic -> exactly 2 pages at 15/page.
    const store = await getStore();
    for (let i = 1; i <= 18; i += 1) {
      await store.createQuestion(
        mcqInput({
          question: `Pagination probe question number ${i} of eighteen?`,
          topic: PAGINATION_TOPIC,
          difficulty: i % 2 === 0 ? "medium" : "hard",
          options: ["A", "B", "C", "D"],
          answer: "A",
        }),
      );
    }
  });

  it("defaults to 15 per page and reports totals", async () => {
    const store = await getStore();
    const page1 = await store.listQuestions({ topic: PAGINATION_TOPIC });
    expect(page1.perPage).toBe(15);
    expect(page1.total).toBe(18);
    expect(page1.totalPages).toBe(2);
    expect(page1.page).toBe(1);
    expect(page1.items).toHaveLength(15);
  });

  it("returns the remainder on the last page and nothing past the end", async () => {
    const store = await getStore();
    const page2 = await store.listQuestions({ topic: PAGINATION_TOPIC, page: 2 });
    expect(page2.items).toHaveLength(3);
    const page3 = await store.listQuestions({ topic: PAGINATION_TOPIC, page: 3 });
    expect(page3.items).toHaveLength(0);
    expect(page3.total).toBe(18);
  });

  it("narrows by difficulty, type and free-text search", async () => {
    const store = await getStore();
    const medium = await store.listQuestions({ topic: PAGINATION_TOPIC, difficulty: "medium" });
    expect(medium.total).toBe(9);

    const mcqs = await store.listQuestions({ topic: PAGINATION_TOPIC, type: "mcq" });
    expect(mcqs.total).toBe(18);

    const search = await store.listQuestions({ topic: PAGINATION_TOPIC, search: "number 7 of" });
    expect(search.total).toBe(1);
    expect(search.items[0].question).toContain("number 7 of");
  });

  it("search also matches topic text case-insensitively", async () => {
    const store = await getStore();
    const byTopicSearch = await store.listQuestions({ search: "pagination probe" });
    expect(byTopicSearch.total).toBe(18);
  });
});
