import { z } from "zod";
import { QuestionTypeSchema, DifficultySchema } from "@/lib/ai/schemas";

/**
 * Zod schemas for every teacher-facing form in the Lesson Planner, Quiz
 * Generator and Question Bank (spec 20.3-20.5). Server actions parse form
 * data with these BEFORE anything reaches the AI layer or the store; edit
 * payloads reuse the AI content schemas (LessonPlanSchema / QuizSpecSchema)
 * so an edited draft can never become invalid.
 */

export const CLASS_LEVELS = ["SSC", "HSC", "Undergrad-intro"] as const;
export const ClassLevelSchema = z.enum(CLASS_LEVELS);
export type ClassLevel = z.infer<typeof ClassLevelSchema>;

export const ASSESSMENT_STYLES = [
  "Oral questioning",
  "Exit ticket",
  "Written exercise",
  "Quick quiz",
  "Observation during activity",
] as const;
export const AssessmentStyleSchema = z.enum(ASSESSMENT_STYLES);

export const QUIZ_DIFFICULTIES = ["easy", "medium", "hard", "mixed"] as const;
export const QUIZ_TYPES = [
  "MCQ",
  "True-False",
  "Short Answer",
  "Fill in the Blank",
  "Viva",
  "Mixed",
] as const;
export const QUIZ_LANGUAGES = ["English", "Bangla"] as const;

// ---- lesson planner form ---------------------------------------------------

export const lessonFormSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(3, "Enter the lesson topic (at least 3 characters)")
    .max(120, "Keep the topic under 120 characters"),
  classLevel: ClassLevelSchema,
  durationMin: z.coerce
    .number({ error: "Duration must be a number" })
    .int("Whole minutes only")
    .min(5, "A lesson needs at least 5 minutes")
    .max(240, "Keep the lesson under 240 minutes"),
  objectivesText: z
    .string()
    .trim()
    .max(4000, "Objectives are too long")
    .optional(),
  priorKnowledge: z
    .string()
    .trim()
    .max(1000, "Keep prior knowledge under 1000 characters")
    .optional(),
  assessmentStyle: AssessmentStyleSchema,
});
export type LessonFormValues = z.infer<typeof lessonFormSchema>;

/** "one objective per line" textarea -> trimmed non-empty lines. */
export function splitLines(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 8);
}

// ---- quiz generator form ---------------------------------------------------

export const quizFormSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(3, "Enter the quiz topic (at least 3 characters)")
    .max(120, "Keep the topic under 120 characters"),
  classLevel: ClassLevelSchema,
  questionCount: z.coerce
    .number({ error: "Question count must be a number" })
    .int("Whole numbers only")
    .min(3, "At least 3 questions")
    .max(15, "At most 15 questions per quiz"),
  difficulty: z.enum(QUIZ_DIFFICULTIES),
  quizType: z.enum(QUIZ_TYPES),
  learningObjective: z
    .string()
    .trim()
    .max(300, "Keep the objective under 300 characters")
    .optional(),
  language: z.enum(QUIZ_LANGUAGES),
});
export type QuizFormValues = z.infer<typeof quizFormSchema>;

/** Map the form's quiz type onto generator questionTypes strings. */
export function questionTypesFor(
  quizType: QuizFormValues["quizType"],
): string[] {
  switch (quizType) {
    case "MCQ":
      return ["mcq"];
    case "True-False":
      return ["true_false"];
    case "Short Answer":
      return ["short_answer"];
    case "Fill in the Blank":
      return ["fill_blank"];
    case "Viva":
      return ["viva"];
    case "Mixed":
      return ["Mixed"];
  }
}

// ---- question bank form ------------------------------------------------------

/** true/false answers must be exactly "true" or "false" (bank rule). */
function validateTrueFalse(
  question: { type: string; answer: string },
  ctx: z.RefinementCtx,
): void {
  if (
    question.type === "true_false" &&
    !["true", "false"].includes(question.answer.trim().toLowerCase())
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["answer"],
      message: "True/False answer must be exactly 'true' or 'false'",
    });
  }
}

export const questionFormSchema = z
  .object({
    question: z
      .string()
      .trim()
      .min(5, "Write the full question (at least 5 characters)")
      .max(1000, "Keep the question under 1000 characters"),
    type: QuestionTypeSchema,
    difficulty: DifficultySchema,
    topic: z.string().trim().min(2, "Topic is required").max(120),
    learningObjective: z
      .string()
      .trim()
      .min(3, "What does this question measure?")
      .max(300),
    options: z.array(z.string().trim().min(1)).optional(),
    answer: z
      .string()
      .trim()
      .min(1, "The correct answer is required")
      .max(2000),
    explanation: z
      .string()
      .trim()
      .min(3, "Explain why the answer is correct (for the teacher)")
      .max(2000),
    tagsCsv: z
      .string()
      .trim()
      .max(300, "Keep tags under 300 characters")
      .optional(),
  })
  .superRefine((question, ctx) => {
    validateTrueFalse(question, ctx);
    if (question.type === "mcq") {
      const options = question.options ?? [];
      if (options.length !== 4) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "MCQ questions need exactly 4 options",
        });
      } else if (
        options.some((option, index) => options.indexOf(option) !== index)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "Options must be distinct",
        });
      } else if (!options.includes(question.answer)) {
        ctx.addIssue({
          code: "custom",
          path: ["answer"],
          message: "The answer must match one of the 4 options exactly",
        });
      }
    }
  });
export type QuestionFormValues = z.infer<typeof questionFormSchema>;

/** Comma-separated tags -> trimmed, deduped, lowercased tags. */
export function parseTags(csv: string | undefined): string[] {
  if (!csv) return [];
  const seen = new Set<string>();
  for (const raw of csv.split(",")) {
    const tag = raw.trim().toLowerCase();
    if (tag) seen.add(tag);
  }
  return [...seen].slice(0, 12);
}

// ---- worksheet generator form (spec 20.7) --------------------------------------

export const WORKSHEET_DIFFICULTY_MIXES = [
  "mostly easy",
  "balanced",
  "mostly hard",
] as const;

export const worksheetFormSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(3, "Enter the worksheet topic (at least 3 characters)")
    .max(120, "Keep the topic under 120 characters"),
  classLevel: ClassLevelSchema,
  sectionCount: z.coerce
    .number({ error: "Sections must be a number" })
    .int("Whole numbers only")
    .min(1, "At least 1 section")
    .max(5, "At most 5 sections"),
  difficultyMix: z.enum(WORKSHEET_DIFFICULTY_MIXES),
  learningGoalsText: z
    .string()
    .trim()
    .max(2000, "Keep the learning goals under 2000 characters")
    .optional(),
});
export type WorksheetFormValues = z.infer<typeof worksheetFormSchema>;

// ---- rubric builder form (spec 20.8) ----------------------------------------------

export const rubricFormSchema = z.object({
  assignmentTitle: z
    .string()
    .trim()
    .min(3, "Enter the assignment title (at least 3 characters)")
    .max(160, "Keep the title under 160 characters"),
  topic: z
    .string()
    .trim()
    .min(3, "Enter the topic (at least 3 characters)")
    .max(120, "Keep the topic under 120 characters"),
  classLevel: ClassLevelSchema,
  criteriaCount: z.coerce
    .number({ error: "Criteria count must be a number" })
    .int("Whole numbers only")
    .min(3, "At least 3 criteria")
    .max(6, "At most 6 criteria"),
  totalPoints: z.coerce
    .number({ error: "Total points must be a number" })
    .int("Whole numbers only")
    .min(10, "At least 10 points")
    .max(200, "Keep the total under 200 points"),
});
export type RubricFormValues = z.infer<typeof rubricFormSchema>;

// ---- AI explainer form (spec 20.6) ----------------------------------------------------

export const EXPLAINER_AUDIENCES = ["teacher", "student"] as const;

export const explainerFormSchema = z.object({
  question: z
    .string()
    .trim()
    .min(5, "Paste the student's question (at least 5 characters)")
    .max(500, "Keep the question under 500 characters"),
  confusion: z
    .string()
    .trim()
    .max(500, "Keep the confusion note under 500 characters")
    .optional(),
  topic: z
    .string()
    .trim()
    .min(2, "Enter the topic (at least 2 characters)")
    .max(120, "Keep the topic under 120 characters"),
  audience: z.enum(EXPLAINER_AUDIENCES),
});
export type ExplainerFormValues = z.infer<typeof explainerFormSchema>;

// ---- settings form ------------------------------------------------------------------------

export const displayNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Display names need at least 2 characters")
    .max(80, "Keep the display name under 80 characters"),
});
export type DisplayNameValues = z.infer<typeof displayNameSchema>;

// ---- shared form-state helpers -----------------------------------------------

/** First zod issue message per top-level field (same pattern as auth). */
export function fieldErrorsFromIssues(
  issues: readonly z.ZodIssue[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
