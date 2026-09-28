import { randomUUID } from "node:crypto";
import type { ZodType } from "zod";
import type {
  Role,
  User,
  Question,
  QuestionPage,
  LessonPlanDoc,
  QuizDoc,
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
import {
  LessonPlanDocSchema,
  QuizDocSchema,
  WorksheetDocSchema,
  RubricDocSchema,
  ExplanationDocSchema,
  QuizResultSchema,
  QuestionSchema,
  UserSchema,
  approvalFields,
} from "./types";
import { buildSeedData } from "./seeds/build";
import {
  QUESTIONS_PER_PAGE,
  MAX_QUESTIONS_PER_PAGE,
  normalizeQuestionText,
} from "./shared";
import type { Store } from "./index";

/**
 * In-memory store used when MONGODB_URI is absent. Seeded lazily on first
 * access; data resets when the server restarts. All mutations are real —
 * they write to the in-memory Maps, and reads see them (spec section 36:
 * never fake functionality). Every write is zod-validated against the same
 * doc schemas MongoStore parses with, so both stores stay interchangeable.
 */

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

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

export class DemoStore implements Store {
  private usersByEmail = new Map<string, User>();
  private usersById = new Map<string, User>();

  // ---- catalog collections ------------------------------------------------
  private questions: Question[] = [];
  private lessonPlansById = new Map<string, LessonPlanDoc>();
  private quizzesById = new Map<string, QuizDoc>();
  private worksheetsById = new Map<string, WorksheetDoc>();
  private rubricsById = new Map<string, RubricDoc>();
  private explanationsById = new Map<string, ExplanationDoc>();
  private classGroups: ClassGroup[] = [];
  private quizResults: QuizResult[] = [];

  private seeded = false;

  static async create(): Promise<DemoStore> {
    const store = new DemoStore();
    await store.ensureSeeded();
    return store;
  }

  /** Idempotent: seed exactly once per process. */
  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    // The shared builder (seeds/build.ts) produces the exact same validated
    // documents `npm run seed` writes to MongoDB — one source of demo truth.
    const data = await buildSeedData();

    for (const user of data.users) {
      this.usersByEmail.set(user.email.toLowerCase(), user);
      this.usersById.set(user.id, user);
    }
    data.lessons.forEach((doc) => this.lessonPlansById.set(doc.id, doc));
    data.quizzes.forEach((doc) => this.quizzesById.set(doc.id, doc));
    data.worksheets.forEach((doc) => this.worksheetsById.set(doc.id, doc));
    data.rubrics.forEach((doc) => this.rubricsById.set(doc.id, doc));
    data.explanations.forEach((doc) => this.explanationsById.set(doc.id, doc));
    this.questions.push(...data.questions);
    this.classGroups.push(...data.classGroups);
    this.quizResults.push(...data.quizResults);

    this.seeded = true;
  }

  // ---- users ------------------------------------------------------------

  async getUserByEmail(email: string): Promise<User | null> {
    await this.ensureSeeded();
    return this.usersByEmail.get(email.toLowerCase()) ?? null;
  }

  async getUserById(id: string): Promise<User | null> {
    await this.ensureSeeded();
    return this.usersById.get(id) ?? null;
  }

  async createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
  }): Promise<User> {
    await this.ensureSeeded();
    const email = input.email.toLowerCase();
    if (this.usersByEmail.has(email)) {
      throw new Error(`A user with email ${email} already exists.`);
    }
    const user: User = {
      id: `usr-${randomUUID()}`,
      name: input.name,
      email,
      passwordHash: input.passwordHash,
      role: input.role,
      createdAt: nowIso(),
    };
    this.usersByEmail.set(user.email, user);
    this.usersById.set(user.id, user);
    return user;
  }

  async listUsers(role?: Role): Promise<User[]> {
    await this.ensureSeeded();
    const users = [...this.usersById.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    return role ? users.filter((user) => user.role === role) : users;
  }

  async updateUserName(id: string, name: string): Promise<User | null> {
    await this.ensureSeeded();
    const current = this.usersById.get(id);
    if (!current) return null;
    const updated: User = { ...current, name };
    const valid = parseOrThrow(UserSchema, updated, "user update");
    this.usersById.set(id, valid);
    this.usersByEmail.set(valid.email.toLowerCase(), valid);
    return valid;
  }

  // ---- lesson plans (spec 20.3) -------------------------------------------

  async listLessonPlans(
    filter?: LessonPlanListFilter,
  ): Promise<LessonPlanDoc[]> {
    await this.ensureSeeded();
    let docs = [...this.lessonPlansById.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    if (filter?.status) {
      docs = docs.filter((doc) => doc.status === filter.status);
    }
    if (filter?.topic?.trim()) {
      docs = docs.filter((doc) => contains(doc.topic, filter.topic!));
    }
    return docs;
  }

  async getLessonPlan(id: string): Promise<LessonPlanDoc | null> {
    await this.ensureSeeded();
    return this.lessonPlansById.get(id) ?? null;
  }

  async createLessonPlan(input: CreateLessonPlanInput): Promise<LessonPlanDoc> {
    await this.ensureSeeded();
    const at = nowIso();
    const doc: LessonPlanDoc = {
      id: `lplan-${randomUUID()}`,
      ...input,
      status: "draft",
      createdAt: at,
      updatedAt: at,
    };
    const valid = parseOrThrow(LessonPlanDocSchema, doc, "lesson plan");
    this.lessonPlansById.set(valid.id, valid);
    return valid;
  }

  async updateLessonPlan(
    id: string,
    patch: UpdateLessonPlanPatch,
    updatedBy: string,
  ): Promise<LessonPlanDoc | null> {
    await this.ensureSeeded();
    const current = this.lessonPlansById.get(id);
    if (!current) return null;
    const merged: LessonPlanDoc = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
      updatedBy,
    };
    const valid = parseOrThrow(
      LessonPlanDocSchema,
      merged,
      "lesson plan update",
    );
    this.lessonPlansById.set(id, valid);
    return valid;
  }

  async approveLessonPlan(
    id: string,
    teacherId: string,
  ): Promise<LessonPlanDoc | null> {
    await this.ensureSeeded();
    const current = this.lessonPlansById.get(id);
    if (!current) return null;
    const approved: LessonPlanDoc = {
      ...current,
      ...approvalFields(teacherId),
      updatedAt: nowIso(),
      updatedBy: teacherId,
    };
    const valid = parseOrThrow(
      LessonPlanDocSchema,
      approved,
      "lesson plan approval",
    );
    this.lessonPlansById.set(id, valid);
    return valid;
  }

  async deleteLessonPlanDraft(id: string): Promise<boolean> {
    await this.ensureSeeded();
    const current = this.lessonPlansById.get(id);
    if (!current || current.status !== "draft") return false;
    return this.lessonPlansById.delete(id);
  }

  // ---- quizzes (spec 20.4) --------------------------------------------------

  async listQuizzes(filter?: QuizListFilter): Promise<QuizDoc[]> {
    await this.ensureSeeded();
    let docs = [...this.quizzesById.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    if (filter?.status) {
      docs = docs.filter((doc) => doc.status === filter.status);
    }
    if (filter?.topic?.trim()) {
      docs = docs.filter((doc) => contains(doc.topic, filter.topic!));
    }
    return docs;
  }

  async getQuiz(id: string): Promise<QuizDoc | null> {
    await this.ensureSeeded();
    return this.quizzesById.get(id) ?? null;
  }

  async createQuiz(input: CreateQuizInput): Promise<QuizDoc> {
    await this.ensureSeeded();
    const at = nowIso();
    const doc: QuizDoc = {
      id: `quiz-${randomUUID()}`,
      ...input,
      status: "draft",
      createdAt: at,
      updatedAt: at,
    };
    const valid = parseOrThrow(QuizDocSchema, doc, "quiz");
    this.quizzesById.set(valid.id, valid);
    return valid;
  }

  async updateQuiz(
    id: string,
    patch: UpdateQuizPatch,
    updatedBy: string,
  ): Promise<QuizDoc | null> {
    await this.ensureSeeded();
    const current = this.quizzesById.get(id);
    if (!current) return null;
    const merged: QuizDoc = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
      updatedBy,
    };
    const valid = parseOrThrow(QuizDocSchema, merged, "quiz update");
    this.quizzesById.set(id, valid);
    return valid;
  }

  async approveQuiz(id: string, teacherId: string): Promise<QuizDoc | null> {
    await this.ensureSeeded();
    const current = this.quizzesById.get(id);
    if (!current) return null;
    const approved: QuizDoc = {
      ...current,
      ...approvalFields(teacherId),
      updatedAt: nowIso(),
      updatedBy: teacherId,
    };
    const valid = parseOrThrow(QuizDocSchema, approved, "quiz approval");
    this.quizzesById.set(id, valid);
    return valid;
  }

  async deleteQuizDraft(id: string): Promise<boolean> {
    await this.ensureSeeded();
    const current = this.quizzesById.get(id);
    if (!current || current.status !== "draft") return false;
    return this.quizzesById.delete(id);
  }

  async addQuestionsToBank(
    inputs: CreateQuestionInput[],
  ): Promise<{ inserted: Question[]; skipped: Question[] }> {
    await this.ensureSeeded();
    const existingPrompts = new Set(
      this.questions.map((question) =>
        normalizeQuestionText(question.question),
      ),
    );
    const inserted: Question[] = [];
    const skipped: Question[] = [];
    for (const input of inputs) {
      const key = normalizeQuestionText(input.question);
      const existing = this.questions.find(
        (question) => normalizeQuestionText(question.question) === key,
      );
      if (existingPrompts.has(key) && existing) {
        skipped.push(existing);
        continue;
      }
      const question = await this.createQuestion(input);
      inserted.push(question);
      existingPrompts.add(key);
    }
    return { inserted, skipped };
  }

  // ---- question bank (spec 20.5) ---------------------------------------------

  async listQuestions(filter?: QuestionListFilter): Promise<QuestionPage> {
    await this.ensureSeeded();
    const status = filter?.status;
    const topic = filter?.topic?.trim();
    const search = filter?.search?.trim();
    let docs = [...this.questions].sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );

    // Default listing EXCLUDES archived (spec 20.5).
    if (status) {
      docs = docs.filter((question) => question.status === status);
    } else {
      docs = docs.filter((question) => question.status !== "archived");
    }
    if (topic) {
      docs = docs.filter((question) => contains(question.topic, topic));
    }
    if (filter?.difficulty) {
      docs = docs.filter(
        (question) => question.difficulty === filter.difficulty,
      );
    }
    if (filter?.type) {
      docs = docs.filter((question) => question.type === filter.type);
    }
    if (search) {
      docs = docs.filter(
        (question) =>
          contains(question.question, search) ||
          contains(question.topic, search) ||
          question.tags.some((tag) => contains(tag, search)),
      );
    }

    const total = docs.length;
    const perPage = Math.min(
      MAX_QUESTIONS_PER_PAGE,
      Math.max(1, filter?.perPage ?? QUESTIONS_PER_PAGE),
    );
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const page = Math.max(1, filter?.page ?? 1);
    const items = docs.slice((page - 1) * perPage, page * perPage);
    return { items, total, page, perPage, totalPages };
  }

  async getQuestion(id: string): Promise<Question | null> {
    await this.ensureSeeded();
    return this.questions.find((question) => question.id === id) ?? null;
  }

  async createQuestion(input: CreateQuestionInput): Promise<Question> {
    await this.ensureSeeded();
    const at = nowIso();
    const question: Question = {
      id: `q-${randomUUID()}`,
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
      createdAt: at,
      updatedAt: at,
    };
    const valid = parseOrThrow(QuestionSchema, question, "question");
    this.questions.push(valid);
    return valid;
  }

  async updateQuestion(
    id: string,
    patch: UpdateQuestionPatch,
    updatedBy: string,
  ): Promise<Question | null> {
    await this.ensureSeeded();
    const index = this.questions.findIndex((question) => question.id === id);
    if (index === -1) return null;
    const merged: Question = {
      ...this.questions[index],
      ...patch,
      updatedAt: nowIso(),
      updatedBy,
    };
    const valid = parseOrThrow(QuestionSchema, merged, "question update");
    this.questions[index] = valid;
    return valid;
  }

  async duplicateQuestion(
    id: string,
    createdBy: string,
  ): Promise<Question | null> {
    await this.ensureSeeded();
    const current = await this.getQuestion(id);
    if (!current) return null;
    const at = nowIso();
    const copy: Question = {
      ...current,
      id: `q-${randomUUID()}`,
      status: "draft",
      // A copy keeps its honest provenance (source/provider stay as-is).
      createdBy,
      createdAt: at,
      updatedAt: at,
      updatedBy: createdBy,
    };
    const valid = parseOrThrow(QuestionSchema, copy, "question duplicate");
    this.questions.push(valid);
    return valid;
  }

  async setQuestionStatus(
    id: string,
    status: QuestionBankStatus,
    updatedBy: string,
  ): Promise<Question | null> {
    await this.ensureSeeded();
    const index = this.questions.findIndex((question) => question.id === id);
    if (index === -1) return null;
    const updated: Question = {
      ...this.questions[index],
      status,
      updatedAt: nowIso(),
      updatedBy,
    };
    const valid = parseOrThrow(
      QuestionSchema,
      updated,
      "question status change",
    );
    this.questions[index] = valid;
    return valid;
  }

  async bulkSetQuestionStatus(
    ids: string[],
    status: QuestionBankStatus,
    updatedBy: string,
  ): Promise<number> {
    await this.ensureSeeded();
    let updated = 0;
    for (const id of new Set(ids)) {
      const result = await this.setQuestionStatus(id, status, updatedBy);
      if (result) updated += 1;
    }
    return updated;
  }

  // ---- worksheets (spec 20.7) -------------------------------------------------

  async listWorksheets(filter?: WorksheetListFilter): Promise<WorksheetDoc[]> {
    await this.ensureSeeded();
    let docs = [...this.worksheetsById.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    if (filter?.status) {
      docs = docs.filter((doc) => doc.status === filter.status);
    }
    if (filter?.topic?.trim()) {
      docs = docs.filter((doc) => contains(doc.topic, filter.topic!));
    }
    return docs;
  }

  async getWorksheet(id: string): Promise<WorksheetDoc | null> {
    await this.ensureSeeded();
    return this.worksheetsById.get(id) ?? null;
  }

  async createWorksheet(input: CreateWorksheetInput): Promise<WorksheetDoc> {
    await this.ensureSeeded();
    const at = nowIso();
    const doc: WorksheetDoc = {
      id: `ws-${randomUUID()}`,
      ...input,
      status: "draft",
      createdAt: at,
      updatedAt: at,
    };
    const valid = parseOrThrow(WorksheetDocSchema, doc, "worksheet");
    this.worksheetsById.set(valid.id, valid);
    return valid;
  }

  async updateWorksheet(
    id: string,
    patch: UpdateWorksheetPatch,
    updatedBy: string,
  ): Promise<WorksheetDoc | null> {
    await this.ensureSeeded();
    const current = this.worksheetsById.get(id);
    if (!current) return null;
    const merged: WorksheetDoc = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
      updatedBy,
    };
    const valid = parseOrThrow(WorksheetDocSchema, merged, "worksheet update");
    this.worksheetsById.set(id, valid);
    return valid;
  }

  async approveWorksheet(
    id: string,
    teacherId: string,
  ): Promise<WorksheetDoc | null> {
    await this.ensureSeeded();
    const current = this.worksheetsById.get(id);
    if (!current) return null;
    const approved: WorksheetDoc = {
      ...current,
      ...approvalFields(teacherId),
      updatedAt: nowIso(),
      updatedBy: teacherId,
    };
    const valid = parseOrThrow(
      WorksheetDocSchema,
      approved,
      "worksheet approval",
    );
    this.worksheetsById.set(id, valid);
    return valid;
  }

  async deleteWorksheetDraft(id: string): Promise<boolean> {
    await this.ensureSeeded();
    const current = this.worksheetsById.get(id);
    if (!current || current.status !== "draft") return false;
    return this.worksheetsById.delete(id);
  }

  // ---- rubrics (spec 20.8) ------------------------------------------------------

  async listRubrics(filter?: RubricListFilter): Promise<RubricDoc[]> {
    await this.ensureSeeded();
    let docs = [...this.rubricsById.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    if (filter?.status) {
      docs = docs.filter((doc) => doc.status === filter.status);
    }
    if (filter?.topic?.trim()) {
      docs = docs.filter(
        (doc) =>
          contains(doc.assignmentTitle, filter.topic!) ||
          contains(doc.topic, filter.topic!),
      );
    }
    return docs;
  }

  async getRubric(id: string): Promise<RubricDoc | null> {
    await this.ensureSeeded();
    return this.rubricsById.get(id) ?? null;
  }

  async createRubric(input: CreateRubricInput): Promise<RubricDoc> {
    await this.ensureSeeded();
    const at = nowIso();
    const doc: RubricDoc = {
      id: `rubric-${randomUUID()}`,
      ...input,
      status: "draft",
      createdAt: at,
      updatedAt: at,
    };
    const valid = parseOrThrow(RubricDocSchema, doc, "rubric");
    this.rubricsById.set(valid.id, valid);
    return valid;
  }

  async updateRubric(
    id: string,
    patch: UpdateRubricPatch,
    updatedBy: string,
  ): Promise<RubricDoc | null> {
    await this.ensureSeeded();
    const current = this.rubricsById.get(id);
    if (!current) return null;
    const merged: RubricDoc = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
      updatedBy,
    };
    const valid = parseOrThrow(RubricDocSchema, merged, "rubric update");
    this.rubricsById.set(id, valid);
    return valid;
  }

  async approveRubric(
    id: string,
    teacherId: string,
  ): Promise<RubricDoc | null> {
    await this.ensureSeeded();
    const current = this.rubricsById.get(id);
    if (!current) return null;
    const approved: RubricDoc = {
      ...current,
      ...approvalFields(teacherId),
      updatedAt: nowIso(),
      updatedBy: teacherId,
    };
    const valid = parseOrThrow(RubricDocSchema, approved, "rubric approval");
    this.rubricsById.set(id, valid);
    return valid;
  }

  async deleteRubricDraft(id: string): Promise<boolean> {
    await this.ensureSeeded();
    const current = this.rubricsById.get(id);
    if (!current || current.status !== "draft") return false;
    return this.rubricsById.delete(id);
  }

  // ---- AI explainer (spec 20.6) ---------------------------------------------------

  async listExplanations(
    filter?: ExplanationListFilter,
  ): Promise<ExplanationDoc[]> {
    await this.ensureSeeded();
    let docs = [...this.explanationsById.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    if (filter?.status) {
      docs = docs.filter((doc) => doc.status === filter.status);
    }
    if (filter?.topic?.trim()) {
      docs = docs.filter(
        (doc) =>
          contains(doc.topic, filter.topic!) ||
          contains(doc.question, filter.topic!),
      );
    }
    return docs;
  }

  async getExplanation(id: string): Promise<ExplanationDoc | null> {
    await this.ensureSeeded();
    return this.explanationsById.get(id) ?? null;
  }

  async createExplanation(
    input: CreateExplanationInput,
  ): Promise<ExplanationDoc> {
    await this.ensureSeeded();
    const at = nowIso();
    const doc: ExplanationDoc = {
      id: `expl-${randomUUID()}`,
      ...input,
      status: "draft",
      createdAt: at,
      updatedAt: at,
    };
    const valid = parseOrThrow(ExplanationDocSchema, doc, "explanation");
    this.explanationsById.set(valid.id, valid);
    return valid;
  }

  async updateExplanation(
    id: string,
    patch: UpdateExplanationPatch,
    updatedBy: string,
  ): Promise<ExplanationDoc | null> {
    await this.ensureSeeded();
    const current = this.explanationsById.get(id);
    if (!current) return null;
    const merged: ExplanationDoc = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
      updatedBy,
    };
    const valid = parseOrThrow(
      ExplanationDocSchema,
      merged,
      "explanation update",
    );
    this.explanationsById.set(id, valid);
    return valid;
  }

  async approveExplanation(
    id: string,
    teacherId: string,
  ): Promise<ExplanationDoc | null> {
    await this.ensureSeeded();
    const current = this.explanationsById.get(id);
    if (!current) return null;
    const approved: ExplanationDoc = {
      ...current,
      ...approvalFields(teacherId),
      updatedAt: nowIso(),
      updatedBy: teacherId,
    };
    const valid = parseOrThrow(
      ExplanationDocSchema,
      approved,
      "explanation approval",
    );
    this.explanationsById.set(id, valid);
    return valid;
  }

  async deleteExplanationDraft(id: string): Promise<boolean> {
    await this.ensureSeeded();
    const current = this.explanationsById.get(id);
    if (!current || current.status !== "draft") return false;
    return this.explanationsById.delete(id);
  }

  // ---- class analytics support (spec 20.9) --------------------------------------

  async listClassGroups(): Promise<ClassGroup[]> {
    await this.ensureSeeded();
    return [...this.classGroups];
  }

  async listQuizResults(classId?: string): Promise<QuizResult[]> {
    await this.ensureSeeded();
    const rows = classId
      ? this.quizResults.filter((row) => row.classId === classId)
      : [...this.quizResults];
    // Oldest first — ready for trend grouping.
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async recordQuizResult(input: CreateQuizResultInput): Promise<QuizResult> {
    await this.ensureSeeded();
    const row: QuizResult = {
      id: `qres-${randomUUID()}`,
      classId: input.classId,
      quizId: input.quizId,
      topic: input.topic,
      studentName: input.studentName,
      score: input.score,
      total: input.total,
      createdAt: input.createdAt ?? nowIso(),
    };
    const valid = parseOrThrow(QuizResultSchema, row, "quiz result");
    this.quizResults.push(valid);
    return valid;
  }
}
