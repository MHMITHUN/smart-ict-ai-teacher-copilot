import { beforeAll, describe, expect, it } from "vitest";
import { getStore, resetStoreForTests } from "@/lib/db";
import { MockProvider } from "@/lib/ai/mock";
import { QuizSpecSchema } from "@/lib/ai/schemas";
import { questionDraftsFromQuiz } from "@/lib/artifacts/quiz-to-bank";
import type { QuizDoc } from "@/lib/db/types";

/**
 * Quiz Generator -> Question Bank flow (spec 20.4 -> 20.5): bulk insert of
 * an approved quiz's questions, dedup by prompt, honest AI provenance —
 * plus the mock provider's Bangla and mixed-difficulty behavior.
 */

const TEACHER = "usr-teacher-01";
const BENGALI = /[ঀ-৿]/;

beforeAll(() => {
  delete process.env.MONGODB_URI;
  resetStoreForTests();
});

async function generateQuiz(input: Record<string, unknown>): Promise<QuizDoc> {
  const store = await getStore();
  const provider = new MockProvider();
  const topic = String(input.topic ?? "Quiz Bank Probe");
  const classLevel = String(input.classLevel ?? "HSC");
  const questionCount = Number(input.questionCount ?? 5);
  const difficulty = String(input.difficulty ?? "medium");
  const questionTypes = (input.questionTypes as string[] | undefined) ?? [
    "mcq",
    "true_false",
    "short_answer",
  ];
  const language = String(input.language ?? "English");
  const learningObjective = String(input.learningObjective ?? "");
  const promptInput = {
    topic,
    classLevel,
    questionCount,
    difficulty,
    questionTypes,
    language,
    learningObjective,
  };
  const result = await provider.generate("quiz", promptInput, QuizSpecSchema);
  return store.createQuiz({
    topic,
    classLevel,
    questionCount,
    difficulty: result.data.difficulty,
    language,
    content: result.data,
    promptInput,
    provider: result.provider,
    model: result.model,
    createdBy: TEACHER,
  });
}

describe("send quiz questions to the bank", () => {
  it("maps an approved quiz into AI-stamped question drafts", async () => {
    const quiz = await generateQuiz({
      topic: "Quiz Bank Probe Number Systems",
      classLevel: "SSC",
    });
    const drafts = questionDraftsFromQuiz(quiz, TEACHER);
    expect(drafts).toHaveLength(quiz.content.questions.length);
    for (const draft of drafts) {
      expect(draft.source).toBe("ai");
      expect(draft.provider).toBe("mock");
      expect(draft.topic).toBe(quiz.topic);
      expect(draft.learningObjective).toBe(quiz.content.learningObjective);
    }
  });

  it("bulk-inserts every question once and dedups by prompt on re-send", async () => {
    const store = await getStore();
    // Generic-fallback topic: guarantees no collision with the seeded bank rows.
    const quiz = await generateQuiz({ topic: "Quiz Bank Probe Aztec Calendar" });
    const drafts = questionDraftsFromQuiz(quiz, TEACHER);

    const first = await store.addQuestionsToBank(drafts);
    expect(first.inserted).toHaveLength(drafts.length);
    expect(first.skipped).toHaveLength(0);
    for (const question of first.inserted) {
      expect(question.status).toBe("draft");
      expect(question.source).toBe("ai");
    }

    // Exact re-send: everything is recognized as already present.
    const second = await store.addQuestionsToBank(drafts);
    expect(second.inserted).toHaveLength(0);
    expect(second.skipped).toHaveLength(drafts.length);

    // Partially new set: only the genuinely new prompt is inserted.
    const tweaked = drafts.map((draft, index) =>
      index === 0 ? { ...draft, question: `${draft.question} (variant)` } : draft,
    );
    const third = await store.addQuestionsToBank(tweaked);
    expect(third.inserted).toHaveLength(1);
    expect(third.skipped).toHaveLength(drafts.length - 1);
  });

  it("dedup ignores case and extra whitespace", async () => {
    const store = await getStore();
    const quiz = await generateQuiz({ topic: "Quiz Bank Probe Coral Reef" });
    const drafts = questionDraftsFromQuiz(quiz, TEACHER);
    await store.addQuestionsToBank(drafts);

    const messy = drafts.map((draft) => ({
      ...draft,
      question: draft.question.toUpperCase().replace(/^ /, "  "),
    }));
    const result = await store.addQuestionsToBank(messy);
    expect(result.inserted).toHaveLength(0);
  });
});

describe("mock quiz generation: Bangla + mixed difficulty", () => {
  it("produces Bangla template content when Bangla is requested", async () => {
    const quiz = await generateQuiz({
      topic: "Quiz Bank Probe HTML",
      language: "Bangla",
    });
    expect(quiz.content.instructions).toMatch(BENGALI);
    expect(quiz.content.learningObjective).toMatch(BENGALI);
    const framed = quiz.content.questions.filter((question) =>
      /^(সত্য না মিথ্যা|ফাঁকা স্থানটি পূরণ করো|মৌখিক প্রশ্ন)/.test(question.prompt),
    );
    expect(framed.length).toBeGreaterThan(0);
    // Still schema-valid, mcq rules included.
    expect(() => QuizSpecSchema.parse(quiz.content)).not.toThrow();
  });

  it("varies per-question difficulty when difficulty is mixed", async () => {
    const quiz = await generateQuiz({
      topic: "Quiz Bank Probe Security",
      difficulty: "mixed",
      questionCount: 9,
      questionTypes: ["Mixed"],
    });
    const difficulties = new Set(quiz.content.questions.map((question) => question.difficulty));
    expect(difficulties).toEqual(new Set(["easy", "medium", "hard"]));
    // Overall quiz difficulty stays inside the schema enum.
    expect(["easy", "medium", "hard"]).toContain(quiz.content.difficulty);
  });
});
