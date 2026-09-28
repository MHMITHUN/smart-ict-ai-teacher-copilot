import { z } from "zod";

/**
 * Zod schema for AI EXPLAINER drafts (spec 20.6).
 * Educational integrity: the model is told to flag uncertainty in
 * uncertaintyNote instead of inventing facts or references.
 */

export const ExplanationSchema = z.object({
  simpleExplanation: z.string().min(1, "simpleExplanation is required"),
  analogy: z.string().min(1, "analogy is required"),
  stepByStep: z
    .array(z.string().min(1))
    .min(1, "at least one step is required"),
  commonMistake: z.string().min(1, "commonMistake is required"),
  practiceQuestion: z.object({
    question: z.string().min(1, "practice question is required"),
    answer: z.string().min(1, "practice answer is required"),
  }),
  /** Honest uncertainty flag — present whenever the model is not sure. */
  uncertaintyNote: z.string().min(1).optional(),
});
export type Explanation = z.infer<typeof ExplanationSchema>;
