import { z } from "zod";

/**
 * Zod schema for AI-generated WORKSHEET drafts (spec 20.7).
 */

export const WorksheetSectionSchema = z.object({
  heading: z.string().min(1, "section heading is required"),
  questions: z
    .array(z.string().min(1))
    .min(1, "each section needs at least one question"),
});
export type WorksheetSection = z.infer<typeof WorksheetSectionSchema>;

export const WorksheetSpecSchema = z.object({
  title: z.string().min(1, "title is required"),
  learningGoals: z
    .array(z.string().min(1))
    .min(1, "at least one learning goal is required"),
  instructions: z.string().min(1, "instructions are required"),
  sections: z.array(WorksheetSectionSchema).min(1, "at least one section is required"),
  answerKey: z
    .array(z.string().min(1))
    .min(1, "answer key is required (one entry per question, in order)"),
  teacherNotes: z.string().min(1, "teacherNotes are required"),
});
export type WorksheetSpec = z.infer<typeof WorksheetSpecSchema>;
