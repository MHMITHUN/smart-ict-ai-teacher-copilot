import { z } from "zod";
import {
  LessonPlanSchema,
  QuizSpecSchema,
  WorksheetSpecSchema,
  RubricSpecSchema,
  ExplanationSchema,
  QuestionTypeSchema,
  DifficultySchema,
} from "@/lib/ai/schemas";
import type {
  LessonPlan,
  QuizSpec,
  WorksheetSpec,
  RubricSpec,
  Explanation,
  QuestionType,
  Difficulty,
} from "@/lib/ai/schemas";

/**
 * Zod schemas + inferred TypeScript types for every collection (spec 20.12).
 * MongoStore parses documents at the boundary with these schemas;
 * DemoStore produces values that already satisfy them.
 *
 * WRAPPER PATTERN (for chunks B/C): every AI artifact document embeds its
 * validated AI content under `content`, echoes the generation inputs in
 * `promptInput`, stamps `provider` + `model`, and carries the review
 * workflow fields (status draft|approved + approvedBy/approvedAt).
 */

// ---- users -------------------------------------------------------------------

export const RoleSchema = z.enum(["TEACHER", "ADMIN"]);
export type Role = z.infer<typeof RoleSchema>;

export const UserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  /** scrypt$<salt-hex>$<hash-hex> — see src/lib/auth/password.ts */
  passwordHash: z.string().min(1),
  role: RoleSchema,
  createdAt: z.string(), // ISO date, e.g. "2026-01-05T09:00:00.000Z"
});
export type User = z.infer<typeof UserSchema>;
/** User shape safe to send to the client. */
export type PublicUser = Omit<User, "passwordHash">;

// ---- shared artifact metadata --------------------------------------------------

/** Which engine produced an artifact. "mock" = clearly-labeled sample draft. */
export const AiProviderNameSchema = z.enum(["gemini", "openai", "mock"]);
export type AiProviderName = z.infer<typeof AiProviderNameSchema>;

/** Review workflow (spec 20.10): draft until a teacher approves. */
export const ReviewStatusSchema = z.enum(["draft", "approved"]);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const ReviewMetaSchema = z.object({
  status: ReviewStatusSchema,
  /** Teacher user id that approved the artifact. */
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
});

/** Set these fields to approve an artifact (used by store methods in B/C). */
export function approvalFields(teacherId: string, at: Date = new Date()) {
  return {
    status: "approved" as const,
    approvedBy: teacherId,
    approvedAt: at.toISOString(),
  };
}

const GenerationMetaSchema = z.object({
  /** Echo of the prompt inputs (topic, classLevel, ...) for provenance. */
  promptInput: z.record(z.string(), z.unknown()),
  provider: AiProviderNameSchema,
  model: z.string().min(1),
});

const AuditMetaSchema = z.object({
  createdBy: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  /** Audit-lite: the last user who edited the doc (set on every update). */
  updatedBy: z.string().min(1).optional(),
});

// ---- lesson plans (spec 20.3) ---------------------------------------------------

export const LessonPlanDocSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  topic: z.string().min(1),
  classLevel: z.string().min(1),
  durationMin: z.number().int().positive(),
  objectives: z.array(z.string().min(1)),
  content: LessonPlanSchema,
  ...GenerationMetaSchema.shape,
  ...ReviewMetaSchema.shape,
  ...AuditMetaSchema.shape,
});
export type LessonPlanDoc = z.infer<typeof LessonPlanDocSchema>;

/** Input for store.createLessonPlan — starts at status "draft". */
export interface CreateLessonPlanInput {
  title: string;
  topic: string;
  classLevel: string;
  durationMin: number;
  objectives: string[];
  content: LessonPlan;
  promptInput: Record<string, unknown>;
  provider: AiProviderName;
  model: string;
  createdBy: string;
}

/** Editable fields for store.updateLessonPlan (validated again in the store). */
export interface UpdateLessonPlanPatch {
  title?: string;
  topic?: string;
  classLevel?: string;
  durationMin?: number;
  objectives?: string[];
  content?: LessonPlan;
}

export interface LessonPlanListFilter {
  status?: ReviewStatus;
  /** Case-insensitive contains match on topic. */
  topic?: string;
}

// ---- quizzes (spec 20.4) ----------------------------------------------------------

export const QuizDocSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  classLevel: z.string().min(1),
  questionCount: z.number().int().positive(),
  difficulty: DifficultySchema,
  language: z.string().min(1),
  content: QuizSpecSchema,
  ...GenerationMetaSchema.shape,
  ...ReviewMetaSchema.shape,
  ...AuditMetaSchema.shape,
});
export type QuizDoc = z.infer<typeof QuizDocSchema>;

/** Input for store.createQuiz — starts at status "draft". */
export interface CreateQuizInput {
  topic: string;
  classLevel: string;
  questionCount: number;
  difficulty: Difficulty;
  language: string;
  content: QuizSpec;
  promptInput: Record<string, unknown>;
  provider: AiProviderName;
  model: string;
  createdBy: string;
}

/** Editable fields for store.updateQuiz (validated again in the store). */
export interface UpdateQuizPatch {
  topic?: string;
  content?: QuizSpec;
}

export interface QuizListFilter {
  status?: ReviewStatus;
  /** Case-insensitive contains match on topic. */
  topic?: string;
}

// ---- question bank (spec 20.5) ----------------------------------------------------

export const QuestionBankStatusSchema = z.enum([
  "draft",
  "published",
  "archived",
]);
export type QuestionBankStatus = z.infer<typeof QuestionBankStatusSchema>;

export const QuestionSourceSchema = z.enum(["ai", "manual"]);
export type QuestionSource = z.infer<typeof QuestionSourceSchema>;

export const QuestionSchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(1),
    type: QuestionTypeSchema,
    difficulty: DifficultySchema,
    topic: z.string().min(1),
    learningObjective: z.string().min(1),
    /** For MCQs: the 4 options (answer must be one of them). */
    options: z.array(z.string().min(1)).optional(),
    answer: z.string().min(1),
    explanation: z.string().min(1),
    tags: z.array(z.string().min(1)),
    status: QuestionBankStatusSchema,
    source: QuestionSourceSchema,
    /** Present when the question was generated by AI. */
    provider: AiProviderNameSchema.optional(),
    ...AuditMetaSchema.shape,
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
          message: "mcq answer must match one of the options",
        });
      }
    }
    if (
      question.type === "true_false" &&
      !["true", "false"].includes(question.answer.trim().toLowerCase())
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["answer"],
        message: "true_false answer must be 'true' or 'false'",
      });
    }
  });
export type Question = z.infer<typeof QuestionSchema>;

/** Input for store.createQuestion / store.addQuestionsToBank. */
export interface CreateQuestionInput {
  question: string;
  type: QuestionType;
  difficulty: Difficulty;
  topic: string;
  learningObjective: string;
  /** Exactly 4 options (answer among them) when type is "mcq". */
  options?: string[];
  answer: string;
  explanation: string;
  tags: string[];
  source: QuestionSource;
  /** Present when the question came from an AI-generated artifact. */
  provider?: AiProviderName;
  createdBy: string;
  /** Defaults to "draft"; seeds may set an explicit status. */
  status?: QuestionBankStatus;
}

/** Editable fields for store.updateQuestion. */
export interface UpdateQuestionPatch {
  question?: string;
  type?: QuestionType;
  difficulty?: Difficulty;
  topic?: string;
  learningObjective?: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  tags?: string[];
}

export interface QuestionListFilter {
  /** Exact status. Undefined = default listing, which EXCLUDES archived. */
  status?: QuestionBankStatus;
  /** Case-insensitive contains match on topic. */
  topic?: string;
  difficulty?: Difficulty;
  type?: QuestionType;
  /** Case-insensitive contains match on question text, topic or tags. */
  search?: string;
  /** 1-based page number (default 1). */
  page?: number;
  /** Page size (default 15, max 100). */
  perPage?: number;
}

export interface QuestionPage {
  items: Question[];
  /** Total matching documents across all pages. */
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// ---- worksheets (spec 20.7) ---------------------------------------------------------

export const WorksheetDocSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  classLevel: z.string().min(1),
  content: WorksheetSpecSchema,
  ...GenerationMetaSchema.shape,
  ...ReviewMetaSchema.shape,
  ...AuditMetaSchema.shape,
});
export type WorksheetDoc = z.infer<typeof WorksheetDocSchema>;

/** Input for store.createWorksheet — starts at status "draft". */
export interface CreateWorksheetInput {
  topic: string;
  classLevel: string;
  content: WorksheetSpec;
  promptInput: Record<string, unknown>;
  provider: AiProviderName;
  model: string;
  createdBy: string;
}

/** Editable fields for store.updateWorksheet (validated again in the store). */
export interface UpdateWorksheetPatch {
  topic?: string;
  content?: WorksheetSpec;
}

export interface WorksheetListFilter {
  status?: ReviewStatus;
  /** Case-insensitive contains match on topic. */
  topic?: string;
}

// ---- rubrics (spec 20.8) ---------------------------------------------------------------

export const RubricDocSchema = z.object({
  id: z.string().min(1),
  assignmentTitle: z.string().min(1),
  topic: z.string().min(1),
  classLevel: z.string().min(1),
  content: RubricSpecSchema,
  ...GenerationMetaSchema.shape,
  ...ReviewMetaSchema.shape,
  ...AuditMetaSchema.shape,
});
export type RubricDoc = z.infer<typeof RubricDocSchema>;

/** Input for store.createRubric — starts at status "draft". */
export interface CreateRubricInput {
  assignmentTitle: string;
  topic: string;
  classLevel: string;
  content: RubricSpec;
  promptInput: Record<string, unknown>;
  provider: AiProviderName;
  model: string;
  createdBy: string;
}

/** Editable fields for store.updateRubric (validated again in the store). */
export interface UpdateRubricPatch {
  assignmentTitle?: string;
  topic?: string;
  content?: RubricSpec;
}

export interface RubricListFilter {
  status?: ReviewStatus;
  /** Case-insensitive contains match on assignment title or topic. */
  topic?: string;
}

// ---- AI explainer (spec 20.6) -----------------------------------------------------------

export const ExplainerAudienceSchema = z.enum(["student", "teacher"]);
export type ExplainerAudience = z.infer<typeof ExplainerAudienceSchema>;

export const ExplanationDocSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  /** The student's specific confusion, when captured. */
  confusion: z.string().optional(),
  topic: z.string().min(1),
  audience: ExplainerAudienceSchema,
  content: ExplanationSchema,
  ...GenerationMetaSchema.shape,
  ...ReviewMetaSchema.shape,
  ...AuditMetaSchema.shape,
});
export type ExplanationDoc = z.infer<typeof ExplanationDocSchema>;

/** Input for store.createExplanation — starts at status "draft". */
export interface CreateExplanationInput {
  question: string;
  confusion?: string;
  topic: string;
  audience: ExplainerAudience;
  content: Explanation;
  promptInput: Record<string, unknown>;
  provider: AiProviderName;
  model: string;
  createdBy: string;
}

/** Editable fields for store.updateExplanation (validated again in the store). */
export interface UpdateExplanationPatch {
  question?: string;
  confusion?: string;
  topic?: string;
  content?: Explanation;
}

export interface ExplanationListFilter {
  status?: ReviewStatus;
  /** Case-insensitive contains match on topic or question. */
  topic?: string;
}

// ---- class analytics support (spec 20.9) ---------------------------------------------------

export const ClassGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  subject: z.string().min(1),
  studentCount: z.number().int().min(0),
});
export type ClassGroup = z.infer<typeof ClassGroupSchema>;

export const QuizResultSchema = z.object({
  id: z.string().min(1),
  classId: z.string().min(1),
  quizId: z.string().optional(),
  topic: z.string().min(1),
  /** Fictional student name for demo analytics — never a real person. */
  studentName: z.string().min(1),
  score: z.number().int().min(0),
  total: z.number().int().positive(),
  createdAt: z.string().min(1),
});
export type QuizResult = z.infer<typeof QuizResultSchema>;

/** Input for store.recordQuizResult (analytics demo data only). */
export interface CreateQuizResultInput {
  classId: string;
  quizId?: string;
  topic: string;
  studentName: string;
  score: number;
  total: number;
  /** Fixed ISO date for seeds; defaults to now in the stores. */
  createdAt?: string;
}

// ---- artifact union helpers -------------------------------------------------------------

/** Every AI-generated artifact document — all embed content and carry review fields. */
export type AiArtifactDoc =
  LessonPlanDoc | QuizDoc | WorksheetDoc | RubricDoc | ExplanationDoc;

/** Structural review fields shared by every AI artifact. */
export type ReviewFields = Pick<
  AiArtifactDoc,
  "status" | "approvedBy" | "approvedAt"
>;

export function isApproved(doc: ReviewFields): boolean {
  return doc.status === "approved";
}
