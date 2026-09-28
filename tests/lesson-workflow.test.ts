import { beforeAll, describe, expect, it } from "vitest";
import { getStore, resetStoreForTests } from "@/lib/db";
import { MockProvider } from "@/lib/ai/mock";
import { LessonPlanSchema } from "@/lib/ai/schemas";
import type { LessonPlanDoc } from "@/lib/db/types";

/**
 * Lesson Planner workflow (spec 20.3 + 20.10) at the store level:
 * draft -> edit -> approve transitions, approval stamping, and the
 * "only drafts are deletable" rule. Runs against DemoStore (no MONGODB_URI).
 */

const TEACHER = "usr-teacher-01";
const UNIQUE_TOPIC = "Lesson Workflow Probe Topic";

beforeAll(() => {
  delete process.env.MONGODB_URI;
  resetStoreForTests();
});

async function createDraft(topic: string): Promise<LessonPlanDoc> {
  const store = await getStore();
  const provider = new MockProvider();
  const promptInput = {
    topic,
    classLevel: "HSC",
    durationMin: 40,
    objectives: [],
    priorKnowledge: "",
    assessmentStyle: "Exit ticket",
  };
  const result = await provider.generate("lesson", promptInput, LessonPlanSchema);
  return store.createLessonPlan({
    title: result.data.title,
    topic,
    classLevel: "HSC",
    durationMin: 40,
    objectives: result.data.learningObjectives,
    content: result.data,
    promptInput,
    provider: result.provider,
    model: result.model,
    createdBy: TEACHER,
  });
}

describe("lesson workflow: draft -> edit -> approve", () => {
  it("creates drafts at status draft, stamped with provider and model", async () => {
    const doc = await createDraft(`${UNIQUE_TOPIC} draft`);
    expect(doc.status).toBe("draft");
    expect(doc.approvedBy).toBeUndefined();
    expect(doc.approvedAt).toBeUndefined();
    expect(doc.provider).toBe("mock");
    expect(doc.model).toBe("mock-template-v1");
    expect(doc.createdBy).toBe(TEACHER);
    expect(LessonPlanSchema.parse(doc.content)).toBeTruthy();
  });

  it("saves teacher edits and records who edited (audit-lite)", async () => {
    const store = await getStore();
    const doc = await createDraft(`${UNIQUE_TOPIC} edit`);
    const updated = await store.updateLessonPlan(
      doc.id,
      {
        title: "Renamed by the teacher",
        objectives: ["Rewritten objective"],
        content: { ...doc.content, warmUp: "Teacher-written warm-up." },
      },
      "usr-teacher-02",
    );
    expect(updated).not.toBeNull();
    expect(updated!.title).toBe("Renamed by the teacher");
    expect(updated!.objectives).toEqual(["Rewritten objective"]);
    expect(updated!.content.warmUp).toBe("Teacher-written warm-up.");
    expect(updated!.updatedBy).toBe("usr-teacher-02");
    expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(doc.createdAt).getTime(),
    );
    expect(updated!.status).toBe("draft"); // editing does not approve
  });

  it("update of a missing lesson returns null", async () => {
    const store = await getStore();
    expect(await store.updateLessonPlan("lplan-does-not-exist", {}, TEACHER)).toBeNull();
  });

  it("approve stamps status, approver and timestamp", async () => {
    const store = await getStore();
    const doc = await createDraft(`${UNIQUE_TOPIC} approve`);
    const approved = await store.approveLessonPlan(doc.id, "usr-teacher-02");
    expect(approved).not.toBeNull();
    expect(approved!.status).toBe("approved");
    expect(approved!.approvedBy).toBe("usr-teacher-02");
    expect(approved!.approvedAt).toBeDefined();
    expect(new Date(approved!.approvedAt!).getTime()).toBeGreaterThan(0);
    // persisted, not just returned
    const reread = await store.getLessonPlan(doc.id);
    expect(reread?.status).toBe("approved");
  });

  it("approve of a missing lesson returns null", async () => {
    const store = await getStore();
    expect(await store.approveLessonPlan("lplan-does-not-exist", TEACHER)).toBeNull();
  });
});

describe("lesson workflow: deletion guard", () => {
  it("refuses to delete an approved lesson plan", async () => {
    const store = await getStore();
    const doc = await createDraft(`${UNIQUE_TOPIC} keep`);
    await store.approveLessonPlan(doc.id, TEACHER);
    expect(await store.deleteLessonPlanDraft(doc.id)).toBe(false);
    expect(await store.getLessonPlan(doc.id)).not.toBeNull();
  });

  it("deletes a draft and only a draft", async () => {
    const store = await getStore();
    const doc = await createDraft(`${UNIQUE_TOPIC} delete`);
    expect(await store.deleteLessonPlanDraft(doc.id)).toBe(true);
    expect(await store.getLessonPlan(doc.id)).toBeNull();
    expect(await store.deleteLessonPlanDraft(doc.id)).toBe(false);
  });
});

describe("lesson workflow: listing", () => {
  it("filters by status and topic (case-insensitive contains)", async () => {
    const store = await getStore();
    const draft = await createDraft(`${UNIQUE_TOPIC} list-a`);
    const approved = await createDraft(`${UNIQUE_TOPIC} list-b`);
    await store.approveLessonPlan(approved.id, TEACHER);

    const byTopic = await store.listLessonPlans({ topic: "lesson workflow probe" });
    expect(byTopic.length).toBeGreaterThanOrEqual(2);
    expect(byTopic.every((doc) => doc.topic.includes(UNIQUE_TOPIC))).toBe(true);

    const draftsOnly = await store.listLessonPlans({
      topic: UNIQUE_TOPIC,
      status: "draft",
    });
    expect(draftsOnly.some((doc) => doc.id === draft.id)).toBe(true);
    expect(draftsOnly.some((doc) => doc.id === approved.id)).toBe(false);
  });
});
