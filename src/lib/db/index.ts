import type {
  Role,
  User,
  LessonPlanDoc,
  QuizDoc,
  Question,
  QuestionPage,
  WorksheetDoc,
  RubricDoc,
  ExplanationDoc,
  ClassGroup,
  QuizResult,
  CreateLessonPlanInput,
  UpdateLessonPlanPatch,
  LessonPlanListFilter,
  CreateQuizInput,
  UpdateQuizPatch,
  QuizListFilter,
  CreateQuestionInput,
  UpdateQuestionPatch,
  QuestionListFilter,
  QuestionBankStatus,
  CreateWorksheetInput,
  UpdateWorksheetPatch,
  WorksheetListFilter,
  CreateRubricInput,
  UpdateRubricPatch,
  RubricListFilter,
  CreateExplanationInput,
  UpdateExplanationPatch,
  ExplanationListFilter,
  CreateQuizResultInput,
} from "./types";
import { DemoStore } from "./demo-store";
import { MongoStore } from "./mongo";

/**
 * Dual-mode data layer (same pattern as the C programming lab project).
 *
 * - MONGODB_URI unset  -> DemoStore (in-memory, lazily seeded, resets on
 *   server restart). Good for local demos; every UI honestly labels it.
 * - MONGODB_URI set    -> MongoStore (mongodb driver) backed by the
 *   database named by MONGODB_DB_NAME (default "ai_teacher_copilot").
 *
 * EXTENDING THIS INTERFACE (chunks B/C — the catalog methods are the
 * skeleton this chunk leaves for you):
 *   1. Add the method signature here.
 *   2. Implement it in BOTH DemoStore and MongoStore.
 *   3. Keep methods domain-level (listLessonPlans({ status }) rather than
 *      raw collection access) so both stores stay swappable.
 *   4. MongoStore must zod-parse every document at the boundary.
 *
 * Suggested catalog slices (matching src/lib/db/types.ts):
 *   - questions:        listQuestions / createQuestion / updateQuestion / setQuestionStatus
 *   - lesson plans:     listLessonPlans / getLessonPlanById / createLessonPlan /
 *                       updateLessonPlan / approveLessonPlan(id, teacherId)
 *   - quizzes, worksheets, rubrics, explanations: the same list/get/create/
 *     update/approve shape around their Doc schemas
 *   - analytics:        listClassGroups / listQuizResults / recordQuizResult
 *
 * Review workflow (spec 20.10): every approve* method stamps
 * { status: "approved", approvedBy: teacherId, approvedAt: now } — use
 * approvalFields() from ./types. Every create of an AI artifact starts at
 * status "draft" with the provider + model stamped from the generation
 * result.
 */

export interface Store {
  // ---- users -------------------------------------------------------------
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
  }): Promise<User>;
  listUsers(role?: Role): Promise<User[]>;
  /** Settings: update the signed-in user's display name. */
  updateUserName(id: string, name: string): Promise<User | null>;

  // ---- lesson plans (spec 20.3) -------------------------------------------

  /** List lesson plans, newest first. Filter by review status and topic. */
  listLessonPlans(filter?: LessonPlanListFilter): Promise<LessonPlanDoc[]>;
  getLessonPlan(id: string): Promise<LessonPlanDoc | null>;
  /** Create a lesson plan at status "draft" with provider/model stamped. */
  createLessonPlan(input: CreateLessonPlanInput): Promise<LessonPlanDoc>;
  /** Edit any field; stamps updatedAt + updatedBy (audit-lite). */
  updateLessonPlan(
    id: string,
    patch: UpdateLessonPlanPatch,
    updatedBy: string,
  ): Promise<LessonPlanDoc | null>;
  /** Stamp approval (spec 20.10): status "approved" + teacherId + time. */
  approveLessonPlan(
    id: string,
    teacherId: string,
  ): Promise<LessonPlanDoc | null>;
  /** Delete ONLY drafts — approved lesson plans are never deleted. */
  deleteLessonPlanDraft(id: string): Promise<boolean>;

  // ---- quizzes (spec 20.4) --------------------------------------------------

  listQuizzes(filter?: QuizListFilter): Promise<QuizDoc[]>;
  getQuiz(id: string): Promise<QuizDoc | null>;
  createQuiz(input: CreateQuizInput): Promise<QuizDoc>;
  updateQuiz(
    id: string,
    patch: UpdateQuizPatch,
    updatedBy: string,
  ): Promise<QuizDoc | null>;
  approveQuiz(id: string, teacherId: string): Promise<QuizDoc | null>;
  /** Delete ONLY drafts — approved quizzes are never deleted. */
  deleteQuizDraft(id: string): Promise<boolean>;
  /**
   * Bulk-insert questions into the bank, DEDUPING BY PROMPT: inputs whose
   * question text already exists (case-insensitive, trimmed) are skipped and
   * returned as-is. Inserted rows start at status "draft".
   */
  addQuestionsToBank(
    inputs: CreateQuestionInput[],
  ): Promise<{ inserted: Question[]; skipped: Question[] }>;

  // ---- question bank (spec 20.5) ---------------------------------------------

  /**
   * Paginated question listing (default 15/page). Default filter EXCLUDES
   * archived questions — pass status: "archived" to see them.
   */
  listQuestions(filter?: QuestionListFilter): Promise<QuestionPage>;
  getQuestion(id: string): Promise<Question | null>;
  /** Manual or AI-sourced question; validated with QuestionSchema. */
  createQuestion(input: CreateQuestionInput): Promise<Question>;
  updateQuestion(
    id: string,
    patch: UpdateQuestionPatch,
    updatedBy: string,
  ): Promise<Question | null>;
  /** Copy a question into a fresh draft owned by `createdBy`. */
  duplicateQuestion(id: string, createdBy: string): Promise<Question | null>;
  /** draft -> published (publish), anything -> archived, archived -> draft. */
  setQuestionStatus(
    id: string,
    status: QuestionBankStatus,
    updatedBy: string,
  ): Promise<Question | null>;
  /** Bulk status transition; returns the number of updated questions. */
  bulkSetQuestionStatus(
    ids: string[],
    status: QuestionBankStatus,
    updatedBy: string,
  ): Promise<number>;

  // ---- worksheets (spec 20.7) -------------------------------------------------

  /** List worksheets, newest first. Filter by review status and topic. */
  listWorksheets(filter?: WorksheetListFilter): Promise<WorksheetDoc[]>;
  getWorksheet(id: string): Promise<WorksheetDoc | null>;
  /** Create a worksheet at status "draft" with provider/model stamped. */
  createWorksheet(input: CreateWorksheetInput): Promise<WorksheetDoc>;
  /** Edit any field; stamps updatedAt + updatedBy (audit-lite). */
  updateWorksheet(
    id: string,
    patch: UpdateWorksheetPatch,
    updatedBy: string,
  ): Promise<WorksheetDoc | null>;
  /** Stamp approval (spec 20.10): status "approved" + teacherId + time. */
  approveWorksheet(id: string, teacherId: string): Promise<WorksheetDoc | null>;
  /** Delete ONLY drafts — approved worksheets are never deleted. */
  deleteWorksheetDraft(id: string): Promise<boolean>;

  // ---- rubrics (spec 20.8) ------------------------------------------------------

  listRubrics(filter?: RubricListFilter): Promise<RubricDoc[]>;
  getRubric(id: string): Promise<RubricDoc | null>;
  createRubric(input: CreateRubricInput): Promise<RubricDoc>;
  updateRubric(
    id: string,
    patch: UpdateRubricPatch,
    updatedBy: string,
  ): Promise<RubricDoc | null>;
  approveRubric(id: string, teacherId: string): Promise<RubricDoc | null>;
  /** Delete ONLY drafts — approved rubrics are never deleted. */
  deleteRubricDraft(id: string): Promise<boolean>;

  // ---- AI explainer (spec 20.6) ---------------------------------------------------

  listExplanations(filter?: ExplanationListFilter): Promise<ExplanationDoc[]>;
  getExplanation(id: string): Promise<ExplanationDoc | null>;
  createExplanation(input: CreateExplanationInput): Promise<ExplanationDoc>;
  updateExplanation(
    id: string,
    patch: UpdateExplanationPatch,
    updatedBy: string,
  ): Promise<ExplanationDoc | null>;
  approveExplanation(
    id: string,
    teacherId: string,
  ): Promise<ExplanationDoc | null>;
  /** Delete ONLY drafts — approved explanations are never deleted. */
  deleteExplanationDraft(id: string): Promise<boolean>;

  // ---- class analytics support (spec 20.9) --------------------------------------

  /** Classes the teacher reports results for (demo: seeded, fictional). */
  listClassGroups(): Promise<ClassGroup[]>;
  /** Quiz results (oldest first — ready for trend grouping). Optional class filter. */
  listQuizResults(classId?: string): Promise<QuizResult[]>;
  /** Record one fictional quiz result (analytics demo data). */
  recordQuizResult(input: CreateQuizResultInput): Promise<QuizResult>;
}

const globalForStore = globalThis as unknown as {
  __copilotStore?: Store;
};

/** Get the process-wide store singleton (DemoStore or MongoStore). */
export async function getStore(): Promise<Store> {
  if (!globalForStore.__copilotStore) {
    if (process.env.MONGODB_URI) {
      globalForStore.__copilotStore = await MongoStore.create();
    } else {
      globalForStore.__copilotStore = await DemoStore.create();
    }
  }
  return globalForStore.__copilotStore;
}

/** Test helper: forget the singleton so the next getStore() re-initializes. */
export function resetStoreForTests(): void {
  delete globalForStore.__copilotStore;
}

export type { DemoStore, MongoStore };
