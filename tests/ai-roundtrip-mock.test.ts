import { beforeAll, describe, expect, it } from "vitest";
import { getStore, resetStoreForTests } from "@/lib/db";
import { getProvider } from "@/lib/ai/provider";
import { LessonPlanSchema, QuizSpecSchema } from "@/lib/ai/schemas";
import { questionDraftsFromQuiz } from "@/lib/artifacts/quiz-to-bank";

/**
 * Full mock-provider round trip (spec 20.11 + 20.10 + 36): generate ->
 * schema-validate -> save as draft -> teacher edits -> approve -> reuse.
 * Uses getProvider() with AI_PROVIDER forced to mock so the test can never
 * hit a real API even on a machine with keys in the environment.
 */

const TEACHER = "usr-teacher-01";

beforeAll(() => {
  process.env.AI_PROVIDER = "mock";
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.MONGODB_URI;
  resetStoreForTests();
});

describe("mock round trip: lesson plan", () => {
  it("generate -> validate -> save draft -> edit -> approve", async () => {
    const provider = getProvider();
    expect(provider.name).toBe("mock");

    const promptInput = {
      topic: "Roundtrip Probe Number Systems",
      classLevel: "SSC",
      durationMin: 35,
      objectives: ["Convert decimal to binary"],
      priorKnowledge: "decimal place values",
      assessmentStyle: "Oral questioning",
    };
    const result = await provider.generate("lesson", promptInput, LessonPlanSchema);

    // 1. Provider response already passed the schema (this re-parse is the belt
    //    over the braces: nothing unvalidated is ever trusted).
    const content = LessonPlanSchema.parse(result.data);
    expect(content.learningObjectives).toContain("Convert decimal to binary");

    // 2. Saved as a draft with provenance stamped.
    const store = await getStore();
    const doc = await store.createLessonPlan({
      title: content.title,
      topic: promptInput.topic,
      classLevel: promptInput.classLevel,
      durationMin: promptInput.durationMin,
      objectives: content.learningObjectives,
      content,
      promptInput,
      provider: result.provider,
      model: result.model,
      createdBy: TEACHER,
    });
    expect(doc.status).toBe("draft");
    expect(doc.provider).toBe("mock");

    // 3. Teacher edit round-trips through the same schema.
    const editedContent = { ...content, homework: "Teacher-assigned homework." };
    const edited = await store.updateLessonPlan(
      doc.id,
      { title: content.title, objectives: editedContent.learningObjectives, content: editedContent },
      TEACHER,
    );
    expect(edited?.content.homework).toBe("Teacher-assigned homework.");

    // 4. Approval stamps the reviewer + time and shows up in approved lists.
    const approved = await store.approveLessonPlan(doc.id, TEACHER);
    expect(approved?.status).toBe("approved");
    expect(approved?.approvedBy).toBe(TEACHER);
    const approvedList = await store.listLessonPlans({
      status: "approved",
      topic: "Roundtrip Probe",
    });
    expect(approvedList.some((item) => item.id === doc.id)).toBe(true);
  });
});

describe("mock round trip: quiz -> question bank", () => {
  it("generate -> validate -> approve -> send to bank (deduped)", async () => {
    const provider = getProvider();
    const promptInput = {
      topic: "Roundtrip Probe Quantum Ledger",
      classLevel: "HSC",
      questionCount: 6,
      difficulty: "easy",
      questionTypes: ["mcq", "short_answer"],
      learningObjective: "Students can write basic SQL.",
      language: "English",
    };
    const result = await provider.generate("quiz", promptInput, QuizSpecSchema);
    const content = QuizSpecSchema.parse(result.data);
    expect(content.questions).toHaveLength(6);

    const store = await getStore();
    const quiz = await store.createQuiz({
      topic: promptInput.topic,
      classLevel: promptInput.classLevel,
      questionCount: promptInput.questionCount,
      difficulty: content.difficulty,
      language: promptInput.language,
      content,
      promptInput,
      provider: result.provider,
      model: result.model,
      createdBy: TEACHER,
    });
    expect(quiz.status).toBe("draft");

    const approved = await store.approveQuiz(quiz.id, TEACHER);
    expect(approved?.approvedAt).toBeDefined();

    // Send to bank: AI-sourced drafts; a re-send inserts nothing new.
    const drafts = questionDraftsFromQuiz(approved!, TEACHER);
    const first = await store.addQuestionsToBank(drafts);
    expect(first.inserted).toHaveLength(6);
    const again = await store.addQuestionsToBank(drafts);
    expect(again.inserted).toHaveLength(0);
    expect(again.skipped).toHaveLength(6);

    // The bank finds them by the quiz's topic.
    const inBank = await store.listQuestions({ topic: promptInput.topic, status: "draft" });
    expect(inBank.total).toBe(6);
  });
});
