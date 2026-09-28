import { describe, it, expect } from "vitest";
import {
  LessonPlanSchema,
  QuizSpecSchema,
  WorksheetSpecSchema,
  RubricSpecSchema,
  ExplanationSchema,
} from "@/lib/ai/schemas";
import { validateArtifact } from "@/lib/ai/validate";

/**
 * Every AI output schema accepts a well-formed fixture and rejects a
 * broken one — the gate every provider response must pass before the UI
 * sees it (spec 20.4 "AI output must be schema-validated" + 20.11).
 */

const LESSON_FIXTURE = {
  title: "Number Systems: Decimal to Binary",
  learningObjectives: [
    "Students will be able to convert decimal numbers to binary",
    "Students will be able to verify a conversion by expanding place values",
  ],
  warmUp: "Ask how a computer stores 9 using only 0 and 1.",
  conceptExplanation: "Explain base-10 place values, then base-2.",
  activity: "Pairs convert five numbers and check each other.",
  practice: "Convert 45 and 156 to binary.",
  assessment: "Three-question exit ticket.",
  homework: "Convert three family birth years to binary.",
  differentiation: {
    support: "Provide a pre-labeled place-value table.",
    core: "Standard division-remainder method.",
    stretch: "Convert decimal fractions to binary.",
  },
};

const QUIZ_FIXTURE = {
  title: "Number Systems Quiz",
  instructions: "Answer every question.",
  difficulty: "medium",
  learningObjective: "Students can convert between decimal and binary.",
  questions: [
    {
      prompt: "What is the binary form of decimal 10?",
      type: "mcq",
      options: ["1000", "1010", "1100", "1110"],
      answer: "1010",
      explanation: "10 = 8 + 2 = 1010.",
      difficulty: "easy",
    },
    {
      prompt: "The binary 1011 equals decimal 11.",
      type: "true_false",
      answer: "true",
      explanation: "8 + 0 + 2 + 1 = 11.",
      difficulty: "easy",
    },
  ],
};

const WORKSHEET_FIXTURE = {
  title: "Number Systems Practice Worksheet",
  learningGoals: ["Convert between decimal and binary"],
  instructions: "Show your working.",
  sections: [
    { heading: "Part A: Warm-up", questions: ["Convert 23 to binary."] },
    { heading: "Part B: Practice", questions: ["Convert 10101 to decimal."] },
  ],
  answerKey: ["10111", "21"],
  teacherNotes: "One mark per Part A question; show working in Part B.",
};

const RUBRIC_FIXTURE = {
  title: "Lab Report Rubric",
  criteria: [
    {
      criterion: "Correctness",
      excellent: "All conversions correct.",
      good: "1-2 minor slips.",
      developing: "Several errors.",
      beginning: "Most incorrect.",
      points: 40,
    },
  ],
  totalPoints: 50,
};

const EXPLANATION_FIXTURE = {
  simpleExplanation: "Binary uses 0 and 1 because memory is switches.",
  analogy: "A row of light switches, each worth double its neighbour.",
  stepByStep: ["Write place values.", "Fit the biggest value first."],
  commonMistake: "Reversing the place-value order.",
  practiceQuestion: {
    question: "Convert 13 to binary.",
    answer: "1101",
  },
};

const CASES = [
  {
    label: "LessonPlan",
    schema: LessonPlanSchema,
    fixture: LESSON_FIXTURE,
    broken: { ...LESSON_FIXTURE, learningObjectives: [] },
  },
  {
    label: "QuizSpec",
    schema: QuizSpecSchema,
    fixture: QUIZ_FIXTURE,
    broken: {
      ...QUIZ_FIXTURE,
      questions: [
        { ...QUIZ_FIXTURE.questions[0], options: ["only", "two", "opts"] },
      ],
    },
  },
  {
    label: "WorksheetSpec",
    schema: WorksheetSpecSchema,
    fixture: WORKSHEET_FIXTURE,
    broken: { ...WORKSHEET_FIXTURE, answerKey: [] },
  },
  {
    label: "RubricSpec",
    schema: RubricSpecSchema,
    fixture: RUBRIC_FIXTURE,
    broken: { ...RUBRIC_FIXTURE, criteria: [] },
  },
  {
    label: "Explanation",
    schema: ExplanationSchema,
    fixture: EXPLANATION_FIXTURE,
    broken: { ...EXPLANATION_FIXTURE, stepByStep: [] },
  },
] as const;

describe("AI output schemas", () => {
  for (const { label, schema, fixture, broken } of CASES) {
    it(`${label}: accepts a well-formed fixture`, () => {
      expect(schema.safeParse(fixture).success).toBe(true);
    });

    it(`${label}: rejects a broken fixture`, () => {
      const result = schema.safeParse(broken);
      expect(result.success).toBe(false);
    });
  }

  it("QuizSpec: rejects an MCQ whose answer is not among the options", () => {
    const invalid = {
      ...QUIZ_FIXTURE,
      questions: [
        {
          ...QUIZ_FIXTURE.questions[0],
          answer: "9999",
        },
      ],
    };
    expect(QuizSpecSchema.safeParse(invalid).success).toBe(false);
  });

  it("QuizSpec: rejects a true_false answer that is not true/false", () => {
    const invalid = {
      ...QUIZ_FIXTURE,
      questions: [
        {
          ...QUIZ_FIXTURE.questions[1],
          answer: "maybe",
        },
      ],
    };
    expect(QuizSpecSchema.safeParse(invalid).success).toBe(false);
  });

  it("Explanation: uncertaintyNote is optional but must be non-empty when present", () => {
    const withNote = { ...EXPLANATION_FIXTURE, uncertaintyNote: "Verify the syllabus reference." };
    expect(ExplanationSchema.safeParse(withNote).success).toBe(true);
    const emptyNote = { ...EXPLANATION_FIXTURE, uncertaintyNote: "" };
    expect(ExplanationSchema.safeParse(emptyNote).success).toBe(false);
  });
});

describe("validateArtifact", () => {
  it("parses raw JSON text against the schema", () => {
    const result = validateArtifact(LessonPlanSchema, JSON.stringify(LESSON_FIXTURE));
    expect(result.ok).toBe(true);
  });

  it("strips defensive markdown fences before parsing", () => {
    const fenced = "```json\n" + JSON.stringify(LESSON_FIXTURE) + "\n```";
    const result = validateArtifact(LessonPlanSchema, fenced);
    expect(result.ok).toBe(true);
  });

  it("reports invalid JSON as a validation issue (feeds the repair retry)", () => {
    const result = validateArtifact(LessonPlanSchema, "not json at all");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain("not valid JSON");
    }
  });

  it("collects human-readable issue strings for schema failures", () => {
    const result = validateArtifact(
      LessonPlanSchema,
      JSON.stringify({ ...LESSON_FIXTURE, warmUp: "" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.includes("warmUp"))).toBe(true);
    }
  });
});
