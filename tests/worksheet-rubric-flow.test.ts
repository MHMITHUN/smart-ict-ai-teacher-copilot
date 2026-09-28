import { beforeAll, describe, expect, it } from "vitest";
import { getStore, resetStoreForTests } from "@/lib/db";
import { MockProvider } from "@/lib/ai/mock";
import { WorksheetSpecSchema, RubricSpecSchema } from "@/lib/ai/schemas";
import {
  buildPrintableWorksheet,
  worksheetPlainText,
} from "@/lib/artifacts/worksheet-text";
import type { WorksheetDoc, RubricDoc } from "@/lib/db/types";

/**
 * Worksheet + Rubric workflows (spec 20.7/20.8 + 20.10) at the store
 * level: mock-generate -> create draft -> edit -> approve, the printable
 * data shape for approved worksheets, the rubric auto-total rule, and the
 * "approved artifacts are never deletable" guard. Runs against DemoStore.
 */

const TEACHER = "usr-teacher-01";
const UNIQUE = "Worksheet Rubric Flow Probe";

beforeAll(() => {
  delete process.env.MONGODB_URI;
  resetStoreForTests();
});

async function createWorksheetDraft(topic: string): Promise<WorksheetDoc> {
  const store = await getStore();
  const provider = new MockProvider();
  const promptInput = {
    topic,
    classLevel: "HSC",
    sectionCount: 3,
    difficultyMix: "balanced",
    learningGoals: [`Recall the key facts of ${topic}`],
    focus: "",
  };
  const result = await provider.generate(
    "worksheet",
    promptInput,
    WorksheetSpecSchema,
  );
  return store.createWorksheet({
    topic,
    classLevel: "HSC",
    content: result.data,
    promptInput,
    provider: result.provider,
    model: result.model,
    createdBy: TEACHER,
  });
}

async function createRubricDraft(title: string): Promise<RubricDoc> {
  const store = await getStore();
  const provider = new MockProvider();
  const promptInput = {
    assignmentTitle: title,
    topic: "Number Systems",
    classLevel: "HSC",
    criteriaCount: 4,
    totalPoints: 40,
  };
  const result = await provider.generate(
    "rubric",
    promptInput,
    RubricSpecSchema,
  );
  return store.createRubric({
    assignmentTitle: title,
    topic: "Number Systems",
    classLevel: "HSC",
    content: result.data,
    promptInput,
    provider: result.provider,
    model: result.model,
    createdBy: TEACHER,
  });
}

describe("worksheet workflow: draft -> edit -> approve", () => {
  it("creates drafts at status draft, mock-stamped and schema-valid", async () => {
    const doc = await createWorksheetDraft(`${UNIQUE} one`);
    expect(doc.status).toBe("draft");
    expect(doc.provider).toBe("mock");
    expect(doc.model).toBe("mock-template-v1");
    expect(WorksheetSpecSchema.parse(doc.content)).toBeTruthy();
    expect(doc.content.sections.length).toBeGreaterThan(0);
  });

  it("saves teacher edits to sections and answer key (audit-lite)", async () => {
    const store = await getStore();
    const doc = await createWorksheetDraft(`${UNIQUE} edit`);
    const edited = {
      ...doc.content,
      title: "Teacher-renamed worksheet",
      sections: [
        {
          heading: "Part A: Teacher section",
          questions: ["Teacher question 1?"],
        },
      ],
      answerKey: ["Teacher answer 1"],
    };
    const updated = await store.updateWorksheet(
      doc.id,
      { content: edited },
      "usr-teacher-02",
    );
    expect(updated).not.toBeNull();
    expect(updated!.content.title).toBe("Teacher-renamed worksheet");
    expect(updated!.content.sections[0].questions).toEqual([
      "Teacher question 1?",
    ]);
    expect(updated!.updatedBy).toBe("usr-teacher-02");
    expect(updated!.status).toBe("draft"); // editing does not approve
  });

  it("approve stamps status, approver and timestamp", async () => {
    const store = await getStore();
    const doc = await createWorksheetDraft(`${UNIQUE} approve`);
    const approved = await store.approveWorksheet(doc.id, "usr-teacher-02");
    expect(approved!.status).toBe("approved");
    expect(approved!.approvedBy).toBe("usr-teacher-02");
    expect(approved!.approvedAt).toBeDefined();
    const reread = await store.getWorksheet(doc.id);
    expect(reread?.status).toBe("approved");
  });

  it("refuses to delete an approved worksheet but deletes drafts", async () => {
    const store = await getStore();
    const keep = await createWorksheetDraft(`${UNIQUE} keep`);
    await store.approveWorksheet(keep.id, TEACHER);
    expect(await store.deleteWorksheetDraft(keep.id)).toBe(false);
    expect(await store.getWorksheet(keep.id)).not.toBeNull();

    const drop = await createWorksheetDraft(`${UNIQUE} drop`);
    expect(await store.deleteWorksheetDraft(drop.id)).toBe(true);
    expect(await store.getWorksheet(drop.id)).toBeNull();
  });

  it("lists worksheets filterable by status and topic", async () => {
    const store = await getStore();
    const draft = await createWorksheetDraft(`${UNIQUE} list`);
    const approved = await createWorksheetDraft(`${UNIQUE} list2`);
    await store.approveWorksheet(approved.id, TEACHER);
    const drafts = await store.listWorksheets({
      topic: UNIQUE,
      status: "draft",
    });
    expect(drafts.some((doc) => doc.id === draft.id)).toBe(true);
    expect(drafts.some((doc) => doc.id === approved.id)).toBe(false);
  });
});

describe("worksheet printable data shape (spec 20.7)", () => {
  it("numbers questions continuously across sections and keeps the key separate", () => {
    const doc = {
      topic: "Number Systems",
      classLevel: "HSC",
      content: {
        title: "Binary Practice Sheet",
        learningGoals: ["Convert decimal to binary"],
        instructions: "Show your working.",
        sections: [
          {
            heading: "Part A",
            questions: ["Convert 5 to binary.", "Convert 9 to binary."],
          },
          { heading: "Part B", questions: ["Convert 1010 to decimal."] },
        ],
        answerKey: ["101", "1001", "10"],
        teacherNotes: "1 mark each.",
      },
    };
    const model = buildPrintableWorksheet(doc);
    expect(model.questionCount).toBe(3);
    const numbers = model.sections.flatMap((s) =>
      s.questions.map((q) => q.number),
    );
    expect(numbers).toEqual([1, 2, 3]);
    expect(model.sections[0].heading).toBe("Part A");
    expect(model.answerKey).toHaveLength(3);
    expect(model.answerKey).not.toContain("Part A"); // key is answers only
  });

  it("renders copy-to-document plain text with title, numbered questions and key", () => {
    const doc = {
      topic: "Logic Gates",
      classLevel: "HSC",
      content: {
        title: "Gates Practice Sheet",
        learningGoals: ["Apply the XOR truth table"],
        instructions: "Answer all questions.",
        sections: [
          { heading: "Part A", questions: ["When does XOR output 1?"] },
        ],
        answerKey: ["Only when the inputs differ."],
        teacherNotes: "Watch for OR confusion.",
      },
    };
    const text = worksheetPlainText(doc);
    expect(text).toContain("Gates Practice Sheet");
    expect(text).toContain("1. When does XOR output 1?");
    expect(text).toContain("Answer key");
    expect(text).toContain("Only when the inputs differ.");
    expect(text).toContain("Teacher notes: Watch for OR confusion.");
    // Select-all friendly: plain text, no markdown fences.
    expect(text).not.toContain("```");
  });
});

describe("rubric workflow: draft -> edit -> approve", () => {
  it("creates drafts whose criteria points sum to totalPoints", async () => {
    const doc = await createRubricDraft(`${UNIQUE} rubric`);
    expect(doc.status).toBe("draft");
    expect(doc.content.criteria).toHaveLength(4);
    const sum = doc.content.criteria.reduce(
      (total, row) => total + row.points,
      0,
    );
    expect(sum).toBe(doc.content.totalPoints);
    expect(doc.content.totalPoints).toBe(40);
  });

  it("saves teacher edits to descriptors and points (audit-lite)", async () => {
    const store = await getStore();
    const doc = await createRubricDraft(`${UNIQUE} rubric-edit`);
    const edited = {
      ...doc.content,
      title: "Teacher-rubric",
      criteria: [
        {
          criterion: "Correctness",
          excellent: "All correct",
          good: "Minor slips",
          developing: "Several errors",
          beginning: "Mostly incorrect",
          points: 30,
        },
        {
          criterion: "Presentation",
          excellent: "Neat",
          good: "Mostly neat",
          developing: "Patchy",
          beginning: "Disorganised",
          points: 10,
        },
      ],
      totalPoints: 40,
    };
    const updated = await store.updateRubric(
      doc.id,
      { assignmentTitle: "Teacher assignment", content: edited },
      "usr-teacher-02",
    );
    expect(updated!.assignmentTitle).toBe("Teacher assignment");
    expect(updated!.content.criteria).toHaveLength(2);
    expect(updated!.updatedBy).toBe("usr-teacher-02");
    expect(updated!.status).toBe("draft");
  });

  it("approve stamps the review workflow fields", async () => {
    const store = await getStore();
    const doc = await createRubricDraft(`${UNIQUE} rubric-approve`);
    const approved = await store.approveRubric(doc.id, "usr-teacher-02");
    expect(approved!.status).toBe("approved");
    expect(approved!.approvedBy).toBe("usr-teacher-02");
    expect(approved!.approvedAt).toBeDefined();
  });

  it("refuses to delete an approved rubric but deletes drafts", async () => {
    const store = await getStore();
    const keep = await createRubricDraft(`${UNIQUE} rubric-keep`);
    await store.approveRubric(keep.id, TEACHER);
    expect(await store.deleteRubricDraft(keep.id)).toBe(false);
    const drop = await createRubricDraft(`${UNIQUE} rubric-drop`);
    expect(await store.deleteRubricDraft(drop.id)).toBe(true);
    expect(await store.getRubric(drop.id)).toBeNull();
  });
});
