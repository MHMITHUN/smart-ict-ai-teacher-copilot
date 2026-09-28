import { describe, it, expect } from "vitest";
import { MockProvider } from "@/lib/ai/mock";
import {
  LessonPlanSchema,
  QuizSpecSchema,
  WorksheetSpecSchema,
  RubricSpecSchema,
  ExplanationSchema,
} from "@/lib/ai/schemas";

/**
 * The mock provider (spec 36): its drafts must validate against the SAME
 * schemas as real providers for ALL five artifact kinds, be deterministic,
 * and weave the teacher's inputs into the output. Mock drafts are sample
 * templates — but never lorem ipsum.
 */

const provider = new MockProvider();

const LESSON_INPUT = {
  topic: "Number Systems",
  classLevel: "HSC",
  durationMin: 40,
  objectives: ["Convert decimal to binary"],
  priorKnowledge: "decimal arithmetic",
  assessmentStyle: "exit ticket",
};

const QUIZ_INPUT = {
  topic: "Computer Network",
  classLevel: "SSC",
  questionCount: 7,
  difficulty: "medium",
  questionTypes: ["MCQ", "true_false", "short_answer", "fill_blank", "viva"],
  learningObjective: "Identify network basics",
  language: "English",
};

const WORKSHEET_INPUT = { topic: "Database", classLevel: "HSC", sectionCount: 3 };
const RUBRIC_INPUT = {
  assignmentTitle: "Number Conversion Lab Report",
  classLevel: "SSC",
  criteriaCount: 4,
  totalPoints: 50,
};
const EXPLAINER_INPUT = {
  question: "Why do computers use binary?",
  confusion: "I don't understand why only 0 and 1",
  topic: "binary number system",
  audience: "student" as const,
};

describe("MockProvider.generate", () => {
  it("produces schema-valid lesson plans", async () => {
    const result = await provider.generate("lesson", LESSON_INPUT, LessonPlanSchema);
    expect(result.provider).toBe("mock");
    expect(result.model).toBe("mock-template-v1");
    expect(LessonPlanSchema.parse(result.data)).toBeTruthy();
  });

  it("produces schema-valid quizzes honoring count, types and difficulty", async () => {
    const result = await provider.generate("quiz", QUIZ_INPUT, QuizSpecSchema);
    const quiz = QuizSpecSchema.parse(result.data);
    expect(quiz.questions).toHaveLength(7);
    expect(quiz.difficulty).toBe("medium");
    const types = new Set(quiz.questions.map((question) => question.type));
    expect(types).toEqual(new Set(["mcq", "true_false", "short_answer", "fill_blank", "viva"]));
    for (const question of quiz.questions) {
      expect(question.difficulty).toBe("medium");
      if (question.type === "mcq") {
        expect(question.options).toHaveLength(4);
        expect(question.options).toContain(question.answer);
      }
    }
  });

  it("produces schema-valid worksheets with an answer key entry per question", async () => {
    const result = await provider.generate("worksheet", WORKSHEET_INPUT, WorksheetSpecSchema);
    const sheet = WorksheetSpecSchema.parse(result.data);
    const questionCount = sheet.sections.reduce(
      (sum, section) => sum + section.questions.length,
      0,
    );
    expect(sheet.sections.length).toBeGreaterThan(0);
    expect(sheet.answerKey).toHaveLength(questionCount);
  });

  it("produces schema-valid rubrics whose points sum to totalPoints", async () => {
    const result = await provider.generate("rubric", RUBRIC_INPUT, RubricSpecSchema);
    const rubric = RubricSpecSchema.parse(result.data);
    expect(rubric.criteria).toHaveLength(4);
    const sum = rubric.criteria.reduce((total, criterion) => total + criterion.points, 0);
    expect(sum).toBe(rubric.totalPoints);
    expect(sum).toBe(50);
  });

  it("produces schema-valid explanations for known topics", async () => {
    const result = await provider.generate("explainer", EXPLAINER_INPUT, ExplanationSchema);
    const explanation = ExplanationSchema.parse(result.data);
    expect(explanation.simpleExplanation.length).toBeGreaterThan(0);
    expect(explanation.stepByStep.length).toBeGreaterThan(0);
  });

  it("falls back honestly for unknown topics (valid schema + uncertainty note)", async () => {
    const input = { ...EXPLAINER_INPUT, topic: "Quantum Computing Basics" };
    const result = await provider.generate("explainer", input, ExplanationSchema);
    const explanation = ExplanationSchema.parse(result.data);
    expect(explanation.uncertaintyNote).toBeDefined();
    expect(explanation.uncertaintyNote).toMatch(/mock mode/i);
  });
});

describe("MockProvider determinism + parameterization", () => {
  it("is deterministic: identical input produces identical output", async () => {
    const first = await provider.generate("lesson", LESSON_INPUT, LessonPlanSchema);
    const second = await provider.generate("lesson", LESSON_INPUT, LessonPlanSchema);
    expect(JSON.stringify(second.data)).toBe(JSON.stringify(first.data));
  });

  it("weaves the teacher inputs into the lesson draft", async () => {
    const result = await provider.generate("lesson", LESSON_INPUT, LessonPlanSchema);
    const lesson = LessonPlanSchema.parse(result.data);
    expect(lesson.title).toContain("Number Systems");
    expect(lesson.title).toContain("HSC");
    // Teacher-supplied objectives are respected, not replaced.
    expect(lesson.learningObjectives).toContain("Convert decimal to binary");
  });

  it("respects the requested quiz question count", async () => {
    for (const count of [1, 3, 10]) {
      const result = await provider.generate(
        "quiz",
        { ...QUIZ_INPUT, questionCount: count },
        QuizSpecSchema,
      );
      expect(result.data.questions).toHaveLength(count);
    }
  });

  it("never claims a non-mock provider", async () => {
    const result = await provider.generate("rubric", RUBRIC_INPUT, RubricSpecSchema);
    expect(result.provider).toBe("mock");
    expect(result.model).not.toMatch(/gemini|gpt/i);
  });
});
