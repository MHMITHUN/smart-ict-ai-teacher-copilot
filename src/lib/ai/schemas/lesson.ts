import { z } from "zod";

/**
 * Zod schema for AI-generated LESSON PLAN drafts (spec 20.3).
 * Every provider response must parse against this before it reaches the UI.
 */

export const LessonPlanSchema = z.object({
  title: z.string().min(1, "title is required"),
  learningObjectives: z
    .array(z.string().min(1))
    .min(1, "at least one learning objective is required"),
  warmUp: z.string().min(1, "warmUp is required"),
  conceptExplanation: z.string().min(1, "conceptExplanation is required"),
  activity: z.string().min(1, "activity is required"),
  practice: z.string().min(1, "practice is required"),
  assessment: z.string().min(1, "assessment is required"),
  homework: z.string().min(1, "homework is required"),
  differentiation: z.object({
    support: z.string().min(1, "differentiation.support is required"),
    core: z.string().min(1, "differentiation.core is required"),
    stretch: z.string().min(1, "differentiation.stretch is required"),
  }),
});

export type LessonPlan = z.infer<typeof LessonPlanSchema>;
