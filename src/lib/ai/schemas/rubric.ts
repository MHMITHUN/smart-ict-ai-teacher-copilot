import { z } from "zod";

/**
 * Zod schema for AI-generated RUBRIC drafts (spec 20.8).
 * Each criterion carries four performance-level descriptions plus points.
 */

export const RubricCriterionSchema = z.object({
  criterion: z.string().min(1, "criterion is required"),
  excellent: z.string().min(1, "excellent description is required"),
  good: z.string().min(1, "good description is required"),
  developing: z.string().min(1, "developing description is required"),
  beginning: z.string().min(1, "beginning description is required"),
  points: z.number().int().positive("points must be a positive integer"),
});
export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

export const RubricSpecSchema = z.object({
  title: z.string().min(1, "title is required"),
  criteria: z
    .array(RubricCriterionSchema)
    .min(1, "at least one criterion is required"),
  totalPoints: z.number().int().positive("totalPoints must be a positive integer"),
});
export type RubricSpec = z.infer<typeof RubricSpecSchema>;
