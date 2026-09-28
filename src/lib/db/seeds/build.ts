import type { ZodType } from "zod";
import { hashPassword } from "@/lib/auth/password";
import type {
  User,
  Question,
  LessonPlanDoc,
  QuizDoc,
  WorksheetDoc,
  RubricDoc,
  ExplanationDoc,
  ClassGroup,
  QuizResult,
} from "../types";
import {
  LessonPlanDocSchema,
  QuizDocSchema,
  WorksheetDocSchema,
  RubricDocSchema,
  ExplanationDocSchema,
  ClassGroupSchema,
  QuizResultSchema,
  QuestionSchema,
  UserSchema,
} from "../types";
import { DEMO_PASSWORD, seedUsers } from "./users";
import {
  buildArtifactSeeds,
  ARTIFACT_SEED_META,
  type ArtifactSeedMeta,
} from "./artifacts";
import {
  buildQuestionSeedInputs,
  QUESTION_SEED_DATES,
} from "./question-bank";
import { SEED_CLASS_GROUPS } from "./classes";
import { buildQuizResultSeeds } from "./quiz-results";

/**
 * The single seed-content builder, shared by DemoStore.ensureSeeded and
 * `npm run seed` (scripts/seed.ts) so the in-memory demo and a seeded
 * MongoDB database contain EXACTLY the same demo data:
 *
 *   - 4 demo users (scrypt-hashed demo password)
 *   - 3 lessons / 3 quizzes / 1 worksheet / 1 rubric / 2 explanations
 *     (fixed Jan-Sep 2026 dates, honest mock provenance, one legacy
 *     gemini-pilot draft)
 *   - 40 hand-checked question-bank rows (30 published / 6 draft / 4 archived)
 *   - 3 class groups + their fictional quiz results for analytics
 *
 * Every document is zod-validated here against the same doc schemas
 * MongoStore parses with, so a seed bug fails loudly at build time.
 */

export interface SeedData {
  users: User[];
  lessons: LessonPlanDoc[];
  quizzes: QuizDoc[];
  worksheets: WorksheetDoc[];
  rubrics: RubricDoc[];
  explanations: ExplanationDoc[];
  questions: Question[];
  classGroups: ClassGroup[];
  quizResults: QuizResult[];
}

const nowIso = () => new Date().toISOString();

function parseOrThrow<T>(schema: ZodType<T>, value: T, what: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(
      `Invalid ${what}: ${first ? `${first.path.join(".") || "(root)"}: ${first.message}` : "failed validation"}`,
    );
  }
  return parsed.data;
}

/** Stamp a seed doc with its fixed id/dates and review state. */
function withSeedMeta<T extends object>(input: T, meta: ArtifactSeedMeta) {
  return {
    ...input,
    id: meta.id,
    status: meta.approved ? ("approved" as const) : ("draft" as const),
    approvedBy: meta.approved?.by,
    approvedAt: meta.approved?.at,
    createdAt: meta.createdAt,
    updatedAt: meta.approved?.at ?? meta.createdAt,
  };
}

export async function buildSeedData(): Promise<SeedData> {
  const users = seedUsers.map((seed) =>
    parseOrThrow(
      UserSchema,
      { ...seed, passwordHash: hashPassword(DEMO_PASSWORD) },
      "user seed",
    ),
  );

  const artifacts = await buildArtifactSeeds();

  const lessons = artifacts.lessons.map((input, index) =>
    parseOrThrow(
      LessonPlanDocSchema,
      withSeedMeta(input, ARTIFACT_SEED_META.lessons[index]),
      "lesson plan seed",
    ),
  );
  const quizzes = artifacts.quizzes.map((input, index) =>
    parseOrThrow(
      QuizDocSchema,
      withSeedMeta(input, ARTIFACT_SEED_META.quizzes[index]),
      "quiz seed",
    ),
  );
  const worksheets = artifacts.worksheets.map((input, index) =>
    parseOrThrow(
      WorksheetDocSchema,
      withSeedMeta(input, ARTIFACT_SEED_META.worksheets[index]),
      "worksheet seed",
    ),
  );
  const rubrics = artifacts.rubrics.map((input, index) =>
    parseOrThrow(
      RubricDocSchema,
      withSeedMeta(input, ARTIFACT_SEED_META.rubrics[index]),
      "rubric seed",
    ),
  );
  const explanations = artifacts.explanations.map((input, index) =>
    parseOrThrow(
      ExplanationDocSchema,
      withSeedMeta(input, ARTIFACT_SEED_META.explanations[index]),
      "explanation seed",
    ),
  );

  const questions = buildQuestionSeedInputs().map((input, index) => {
    const createdAt = QUESTION_SEED_DATES[index] ?? nowIso();
    return parseOrThrow(
      QuestionSchema,
      {
        id: `q-seed-${String(index + 1).padStart(2, "0")}`,
        question: input.question,
        type: input.type,
        difficulty: input.difficulty,
        topic: input.topic,
        learningObjective: input.learningObjective,
        options: input.options,
        answer: input.answer,
        explanation: input.explanation,
        tags: input.tags,
        status: input.status ?? "draft",
        source: input.source,
        provider: input.provider,
        createdBy: input.createdBy,
        createdAt,
        updatedAt: createdAt,
      },
      "question seed",
    );
  });

  const classGroups = SEED_CLASS_GROUPS.map((group) =>
    parseOrThrow(ClassGroupSchema, group, "class seed"),
  );

  const quizResults = buildQuizResultSeeds().map((input, index) =>
    parseOrThrow(
      QuizResultSchema,
      {
        id: `qres-seed-${String(index + 1).padStart(3, "0")}`,
        classId: input.classId,
        quizId: input.quizId,
        topic: input.topic,
        studentName: input.studentName,
        score: input.score,
        total: input.total,
        createdAt: input.createdAt ?? nowIso(),
      },
      "quiz result seed",
    ),
  );

  return {
    users,
    lessons,
    quizzes,
    worksheets,
    rubrics,
    explanations,
    questions,
    classGroups,
    quizResults,
  };
}
