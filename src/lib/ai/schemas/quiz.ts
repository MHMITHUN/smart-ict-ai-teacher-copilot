import { z } from "zod";

/**
 * Zod schema for AI-generated QUIZ drafts (spec 20.4).
 * The question-type union mirrors the generator options: MCQ, True/False,
 * Short Answer, Fill in the Blank, Viva.
 */

export const QuestionTypeSchema = z.enum([
  "mcq",
  "true_false",
  "short_answer",
  "fill_blank",
  "viva",
]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const DifficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const QuizQuestionSchema = z
  .object({
    prompt: z.string().min(1, "question prompt is required"),
    type: QuestionTypeSchema,
    /** Required exactly for MCQs (4 options, answer must be one of them). */
    options: z.array(z.string().min(1)).optional(),
    answer: z.string().min(1, "answer is required"),
    explanation: z.string().min(1, "explanation is required"),
    difficulty: DifficultySchema,
  })
  .superRefine((question, ctx) => {
    if (question.type === "mcq") {
      if (!question.options || question.options.length !== 4) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "mcq questions must have exactly 4 options",
        });
      } else if (!question.options.includes(question.answer)) {
        ctx.addIssue({
          code: "custom",
          path: ["answer"],
          message: "mcq answer must match one of the 4 options",
        });
      }
    }
    if (question.type === "true_false" && !["true", "false"].includes(question.answer.toLowerCase())) {
      ctx.addIssue({
        code: "custom",
        path: ["answer"],
        message: "true_false answer must be 'true' or 'false'",
      });
    }
  });
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizSpecSchema = z.object({
  title: z.string().min(1, "title is required"),
  instructions: z.string().min(1, "instructions are required"),
  difficulty: DifficultySchema,
  learningObjective: z.string().min(1, "learningObjective is required"),
  questions: z
    .array(QuizQuestionSchema)
    .min(1, "at least one question is required"),
});
export type QuizSpec = z.infer<typeof QuizSpecSchema>;
