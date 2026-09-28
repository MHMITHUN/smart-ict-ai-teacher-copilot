import { randomUUID } from "node:crypto";
import { MongoClient, type Collection, type Document } from "mongodb";
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
  UserSchema,
  LessonPlanDocSchema,
  QuizDocSchema,
  WorksheetDocSchema,
  RubricDocSchema,
  ExplanationDocSchema,
  ClassGroupSchema,
  QuizResultSchema,
  QuestionSchema,
  approvalFields,
} from "./types";
import {
  normalizeQuestionText,
  QUESTIONS_PER_PAGE,
  MAX_QUESTIONS_PER_PAGE,
} from "./shared";
import type { Store } from "./index";

/**
 * MongoDB-backed store (mongodb driver), used when MONGODB_URI is set.
 * Every document is zod-parsed at the boundary so pages get typed, trusted
 * objects. Content is created by teachers in-app; users can be seeded with
 * npm run seed.
 *
 * ensureIndexes covers every collection (including the still-empty catalog
 * collections) so chunks B/C only need to add methods — the collections,
 * schemas and indexes are ready.
 */

const globalForMongo = globalThis as unknown as {
  __copilotMongoClient?: MongoClient;
};

function getMongoClient(): MongoClient {
  if (!globalForMongo.__copilotMongoClient) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set.");
    globalForMongo.__copilotMongoClient = new MongoClient(uri);
  }
  return globalForMongo.__copilotMongoClient;
}

function getDbName(): string {
  return process.env.MONGODB_DB_NAME || "ai_teacher_copilot";
}

function getCollection<T extends Document>(name: string): Collection<T> {
  return getMongoClient().db(getDbName()).collection<T>(name);
}

/** Mongo document shape: our typed fields plus the Mongo _id. */
interface UserDoc extends User, Document {
  _id?: unknown;
}
interface LessonPlanDocDoc extends LessonPlanDoc, Document {
  _id?: unknown;
}
interface QuizDocDoc extends QuizDoc, Document {
  _id?: unknown;
}
interface WorksheetDocDoc extends WorksheetDoc, Document {
  _id?: unknown;
}
interface RubricDocDoc extends RubricDoc, Document {
  _id?: unknown;
}
interface ExplanationDocDoc extends ExplanationDoc, Document {
  _id?: unknown;
}
interface ClassGroupDoc extends ClassGroup, Document {
  _id?: unknown;
}
interface QuizResultDoc extends QuizResult, Document {
  _id?: unknown;
}
interface QuestionDocDoc extends Question, Document {
  _id?: unknown;
}

const nowIso = () => new Date().toISOString();

function parse<T>(schema: ZodType<T>, doc: (T & Document) | null): T | null {
  if (!doc) return null;
  const parsed = schema.safeParse({ ...doc, _id: undefined });
  return parsed.success ? parsed.data : null;
}

/** Escape user text for a case-insensitive contains $regex. */
function containsRegex(text: string): RegExp {
  const escaped = text.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

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

export class MongoStore implements Store {
  static async create(): Promise<MongoStore> {
    const store = new MongoStore();
    await store.ensureIndexes();
    return store;
  }

  /** Create indexes once per process. Catalog collections are pre-created empty. */
  private indexesEnsured = false;
  private async ensureIndexes(): Promise<void> {
    if (this.indexesEnsured) return;
    await getCollection<UserDoc>("users").createIndex(
      { email: 1 },
      { unique: true },
    );
    // Catalog collections (chunks B/C write into these).
    await getCollection("lessonPlans").createIndex({
      createdBy: 1,
      createdAt: -1,
    });
    await getCollection("lessonPlans").createIndex({
      status: 1,
      createdAt: -1,
    });
    await getCollection("quizzes").createIndex({ createdBy: 1, createdAt: -1 });
    await getCollection("quizzes").createIndex({ status: 1, createdAt: -1 });
    await getCollection("worksheets").createIndex({
      createdBy: 1,
      createdAt: -1,
    });
    await getCollection("rubrics").createIndex({ createdBy: 1, createdAt: -1 });
    await getCollection("explanations").createIndex({
      createdBy: 1,
      createdAt: -1,
    });
    await getCollection("questions").createIndex({ topic: 1, status: 1 });
    await getCollection("questions").createIndex({
      createdBy: 1,
      createdAt: -1,
    });
    await getCollection<ClassGroupDoc>("classGroups").createIndex(
      { name: 1 },
      { unique: true },
    );
    await getCollection<QuizResultDoc>("quizResults").createIndex({
      classId: 1,
      createdAt: -1,
    });
    this.indexesEnsured = true;
  }

  // ---- users ------------------------------------------------------------

  async getUserByEmail(email: string): Promise<User | null> {
    const doc = await getCollection<UserDoc>("users").findOne({
      email: email.toLowerCase(),
    });
    return parse(UserSchema, doc);
  }

  async getUserById(id: string): Promise<User | null> {
    const doc = await getCollection<UserDoc>("users").findOne({ id });
    return parse(UserSchema, doc);
  }

  async createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
  }): Promise<User> {
    const email = input.email.toLowerCase();
    const existing = await getCollection<UserDoc>("users").findOne({ email });
    if (existing) {
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
    await getCollection<UserDoc>("users").insertOne({ ...user });
    return user;
  }

  async listUsers(role?: Role): Promise<User[]> {
    const cursor = getCollection<UserDoc>("users")
      .find(role ? { role } : {})
      .sort({ createdAt: 1 });
    const docs = await cursor.toArray();
    return docs
      .map((doc) => parse(UserSchema, doc))
      .filter((user): user is User => user !== null);
  }

  async updateUserName(id: string, name: string): Promise<User | null> {
    const doc = await getCollection<UserDoc>("users").findOneAndUpdate(
      { id },
      { $set: { name } },
      { returnDocument: "after" },
    );
    return parse(UserSchema, doc);
  }

  // ---- lesson plans (spec 20.3) -------------------------------------------

  async listLessonPlans(
    filter?: LessonPlanListFilter,
  ): Promise<LessonPlanDoc[]> {
    const query: Record<string, unknown> = {};
    if (filter?.status) query.status = filter.status;
    if (filter?.topic?.trim())
      query.topic = { $regex: containsRegex(filter.topic) };
    const docs = await getCollection<LessonPlanDocDoc>("lessonPlans")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    return docs
      .map((doc) => parse(LessonPlanDocSchema, doc))
      .filter((doc): doc is LessonPlanDoc => doc !== null);
  }

  async getLessonPlan(id: string): Promise<LessonPlanDoc | null> {
    const doc = await getCollection<LessonPlanDocDoc>("lessonPlans").findOne({
      id,
    });
    return parse(LessonPlanDocSchema, doc);
  }

  async createLessonPlan(input: CreateLessonPlanInput): Promise<LessonPlanDoc> {
    const at = nowIso();
    const doc: LessonPlanDoc = {
      id: `lplan-${randomUUID()}`,
      ...input,
      status: "draft",
      createdAt: at,
      updatedAt: at,
    };
    const valid = parseOrThrow(LessonPlanDocSchema, doc, "lesson plan");
    await getCollection<LessonPlanDocDoc>("lessonPlans").insertOne({
      ...valid,
    });
    return valid;
  }

  async updateLessonPlan(
    id: string,
    patch: UpdateLessonPlanPatch,
    updatedBy: string,
  ): Promise<LessonPlanDoc | null> {
    const doc = await getCollection<LessonPlanDocDoc>(
      "lessonPlans",
    ).findOneAndUpdate(
      { id },
      { $set: { ...patch, updatedAt: nowIso(), updatedBy } },
      { returnDocument: "after" },
    );
    return parse(LessonPlanDocSchema, doc);
  }

  async approveLessonPlan(
    id: string,
    teacherId: string,
  ): Promise<LessonPlanDoc | null> {
    const doc = await getCollection<LessonPlanDocDoc>(
      "lessonPlans",
    ).findOneAndUpdate(
      { id },
      {
        $set: {
          ...approvalFields(teacherId),
          updatedAt: nowIso(),
          updatedBy: teacherId,
        },
      },
      { returnDocument: "after" },
    );
    return parse(LessonPlanDocSchema, doc);
  }

  async deleteLessonPlanDraft(id: string): Promise<boolean> {
    // The status predicate makes "only drafts are deletable" atomic.
    const result = await getCollection<LessonPlanDocDoc>(
      "lessonPlans",
    ).deleteOne({
      id,
      status: "draft",
    });
    return result.deletedCount === 1;
  }

  // ---- quizzes (spec 20.4) --------------------------------------------------

  async listQuizzes(filter?: QuizListFilter): Promise<QuizDoc[]> {
    const query: Record<string, unknown> = {};
    if (filter?.status) query.status = filter.status;
    if (filter?.topic?.trim())
      query.topic = { $regex: containsRegex(filter.topic) };
    const docs = await getCollection<QuizDocDoc>("quizzes")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    return docs
      .map((doc) => parse(QuizDocSchema, doc))
      .filter((doc): doc is QuizDoc => doc !== null);
  }

  async getQuiz(id: string): Promise<QuizDoc | null> {
    const doc = await getCollection<QuizDocDoc>("quizzes").findOne({ id });
    return parse(QuizDocSchema, doc);
  }

  async createQuiz(input: CreateQuizInput): Promise<QuizDoc> {
    const at = nowIso();
    const doc: QuizDoc = {
      id: `quiz-${randomUUID()}`,
      ...input,
      status: "draft",
      createdAt: at,
      updatedAt: at,
    };
    const valid = parseOrThrow(QuizDocSchema, doc, "quiz");
    await getCollection<QuizDocDoc>("quizzes").insertOne({ ...valid });
    return valid;
  }

  async updateQuiz(
    id: string,
    patch: UpdateQuizPatch,
    updatedBy: string,
  ): Promise<QuizDoc | null> {
    const doc = await getCollection<QuizDocDoc>("quizzes").findOneAndUpdate(
      { id },
      { $set: { ...patch, updatedAt: nowIso(), updatedBy } },
      { returnDocument: "after" },
    );
    return parse(QuizDocSchema, doc);
  }

  async approveQuiz(id: string, teacherId: string): Promise<QuizDoc | null> {
    const doc = await getCollection<QuizDocDoc>("quizzes").findOneAndUpdate(
      { id },
      {
        $set: {
          ...approvalFields(teacherId),
          updatedAt: nowIso(),
          updatedBy: teacherId,
        },
      },
      { returnDocument: "after" },
    );
    return parse(QuizDocSchema, doc);
  }

  async deleteQuizDraft(id: string): Promise<boolean> {
    const result = await getCollection<QuizDocDoc>("quizzes").deleteOne({
      id,
      status: "draft",
    });
    return result.deletedCount === 1;
  }

  async addQuestionsToBank(
    inputs: CreateQuestionInput[],
  ): Promise<{ inserted: Question[]; skipped: Question[] }> {
    const existing = await getCollection<QuestionDocDoc>("questions")
      .find({}, { projection: { id: 1, question: 1 } })
      .toArray();
    const byPrompt = new Map<string, QuestionDocDoc>();
    for (const doc of existing) {
      byPrompt.set(normalizeQuestionText(doc.question), doc);
    }

    const inserted: Question[] = [];
    const skipped: Question[] = [];
    for (const input of inputs) {
      const key = normalizeQuestionText(input.question);
      const existingDoc = byPrompt.get(key);
      if (existingDoc) {
        const question = parse(
          QuestionSchema,
          await this.getQuestion(existingDoc.id),
        );
        if (question) skipped.push(question);
        continue;
      }
      const question = await this.createQuestion(input);
      inserted.push(question);
      byPrompt.set(key, { ...question } as QuestionDocDoc);
    }
    return { inserted, skipped };
  }

  // ---- question bank (spec 20.5) ---------------------------------------------

  private buildQuestionQuery(
    filter?: QuestionListFilter,
  ): Record<string, unknown> {
    const query: Record<string, unknown> = {};
    // Default listing EXCLUDES archived (spec 20.5).
    if (filter?.status) query.status = filter.status;
    else query.status = { $ne: "archived" };
    if (filter?.topic?.trim())
      query.topic = { $regex: containsRegex(filter.topic) };
    if (filter?.difficulty) query.difficulty = filter.difficulty;
    if (filter?.type) query.type = filter.type;
    if (filter?.search?.trim()) {
      const regex = containsRegex(filter.search);
      query.$or = [
        { question: { $regex: regex } },
        { topic: { $regex: regex } },
        { tags: { $regex: regex } },
      ];
    }
    return query;
  }

  async listQuestions(filter?: QuestionListFilter): Promise<QuestionPage> {
    const query = this.buildQuestionQuery(filter);
    const collection = getCollection<QuestionDocDoc>("questions");
    const total = await collection.countDocuments(query);
    const perPage = Math.min(
      MAX_QUESTIONS_PER_PAGE,
      Math.max(1, filter?.perPage ?? QUESTIONS_PER_PAGE),
    );
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const page = Math.max(1, filter?.page ?? 1);
    const docs = await collection
      .find(query)
      .sort({ createdAt: -1, id: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .toArray();
    const items = docs
      .map((doc) => parse(QuestionSchema, doc))
      .filter((question): question is Question => question !== null);
    return { items, total, page, perPage, totalPages };
  }

  async getQuestion(id: string): Promise<Question | null> {
    const doc = await getCollection<QuestionDocDoc>("questions").findOne({
      id,
    });
    return parse(QuestionSchema, doc);
  }

  async createQuestion(input: CreateQuestionInput): Promise<Question> {
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
    await getCollection<QuestionDocDoc>("questions").insertOne({ ...valid });
    return valid;
  }

  async updateQuestion(
    id: string,
    patch: UpdateQuestionPatch,
    updatedBy: string,
  ): Promise<Question | null> {
    const doc = await getCollection<QuestionDocDoc>(
      "questions",
    ).findOneAndUpdate(
      { id },
      { $set: { ...patch, updatedAt: nowIso(), updatedBy } },
      { returnDocument: "after" },
    );
    return parse(QuestionSchema, doc);
  }

  async duplicateQuestion(
    id: string,
    createdBy: string,
  ): Promise<Question | null> {
    const current = await this.getQuestion(id);
    if (!current) return null;
    const at = nowIso();
    const copy: Question = {
      ...current,
      id: `q-${randomUUID()}`,
      // A copy keeps its honest provenance (source/provider stay as-is).
      status: "draft",
      createdBy,
      createdAt: at,
      updatedAt: at,
      updatedBy: createdBy,
    };
    const valid = parseOrThrow(QuestionSchema, copy, "question duplicate");
    await getCollection<QuestionDocDoc>("questions").insertOne({ ...valid });
    return valid;
  }

  async setQuestionStatus(
    id: string,
    status: QuestionBankStatus,
    updatedBy: string,
  ): Promise<Question | null> {
    const doc = await getCollection<QuestionDocDoc>(
      "questions",
    ).findOneAndUpdate(
      { id },
      { $set: { status, updatedAt: nowIso(), updatedBy } },
      { returnDocument: "after" },
    );
    return parse(QuestionSchema, doc);
  }

  async bulkSetQuestionStatus(
    ids: string[],
    status: QuestionBankStatus,
    updatedBy: string,
  ): Promise<number> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return 0;
    const result = await getCollection<QuestionDocDoc>("questions").updateMany(
      { id: { $in: uniqueIds } },
      { $set: { status, updatedAt: nowIso(), updatedBy } },
    );
    return result.matchedCount;
  }

  // ---- worksheets (spec 20.7) -------------------------------------------------

  async listWorksheets(filter?: WorksheetListFilter): Promise<WorksheetDoc[]> {
    const query: Record<string, unknown> = {};
    if (filter?.status) query.status = filter.status;
    if (filter?.topic?.trim())
      query.topic = { $regex: containsRegex(filter.topic) };
    const docs = await getCollection<WorksheetDocDoc>("worksheets")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    return docs
      .map((doc) => parse(WorksheetDocSchema, doc))
      .filter((doc): doc is WorksheetDoc => doc !== null);
  }

  async getWorksheet(id: string): Promise<WorksheetDoc | null> {
    const doc = await getCollection<WorksheetDocDoc>("worksheets").findOne({
      id,
    });
    return parse(WorksheetDocSchema, doc);
  }

  async createWorksheet(input: CreateWorksheetInput): Promise<WorksheetDoc> {
    const at = nowIso();
    const doc: WorksheetDoc = {
      id: `ws-${randomUUID()}`,
      ...input,
      status: "draft",
      createdAt: at,
      updatedAt: at,
    };
    const valid = parseOrThrow(WorksheetDocSchema, doc, "worksheet");
    await getCollection<WorksheetDocDoc>("worksheets").insertOne({ ...valid });
    return valid;
  }

  async updateWorksheet(
    id: string,
    patch: UpdateWorksheetPatch,
    updatedBy: string,
  ): Promise<WorksheetDoc | null> {
    const doc = await getCollection<WorksheetDocDoc>(
      "worksheets",
    ).findOneAndUpdate(
      { id },
      { $set: { ...patch, updatedAt: nowIso(), updatedBy } },
      { returnDocument: "after" },
    );
    return parse(WorksheetDocSchema, doc);
  }

  async approveWorksheet(
    id: string,
    teacherId: string,
  ): Promise<WorksheetDoc | null> {
    const doc = await getCollection<WorksheetDocDoc>(
      "worksheets",
    ).findOneAndUpdate(
      { id },
      {
        $set: {
          ...approvalFields(teacherId),
          updatedAt: nowIso(),
          updatedBy: teacherId,
        },
      },
      { returnDocument: "after" },
    );
    return parse(WorksheetDocSchema, doc);
  }

  async deleteWorksheetDraft(id: string): Promise<boolean> {
    // The status predicate makes "only drafts are deletable" atomic.
    const result = await getCollection<WorksheetDocDoc>("worksheets").deleteOne(
      {
        id,
        status: "draft",
      },
    );
    return result.deletedCount === 1;
  }

  // ---- rubrics (spec 20.8) ------------------------------------------------------

  async listRubrics(filter?: RubricListFilter): Promise<RubricDoc[]> {
    const query: Record<string, unknown> = {};
    if (filter?.status) query.status = filter.status;
    if (filter?.topic?.trim()) {
      const regex = containsRegex(filter.topic);
      query.$or = [
        { assignmentTitle: { $regex: regex } },
        { topic: { $regex: regex } },
      ];
    }
    const docs = await getCollection<RubricDocDoc>("rubrics")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    return docs
      .map((doc) => parse(RubricDocSchema, doc))
      .filter((doc): doc is RubricDoc => doc !== null);
  }

  async getRubric(id: string): Promise<RubricDoc | null> {
    const doc = await getCollection<RubricDocDoc>("rubrics").findOne({ id });
    return parse(RubricDocSchema, doc);
  }

  async createRubric(input: CreateRubricInput): Promise<RubricDoc> {
    const at = nowIso();
    const doc: RubricDoc = {
      id: `rubric-${randomUUID()}`,
      ...input,
      status: "draft",
      createdAt: at,
      updatedAt: at,
    };
    const valid = parseOrThrow(RubricDocSchema, doc, "rubric");
    await getCollection<RubricDocDoc>("rubrics").insertOne({ ...valid });
    return valid;
  }

  async updateRubric(
    id: string,
    patch: UpdateRubricPatch,
    updatedBy: string,
  ): Promise<RubricDoc | null> {
    const doc = await getCollection<RubricDocDoc>("rubrics").findOneAndUpdate(
      { id },
      { $set: { ...patch, updatedAt: nowIso(), updatedBy } },
      { returnDocument: "after" },
    );
    return parse(RubricDocSchema, doc);
  }

  async approveRubric(
    id: string,
    teacherId: string,
  ): Promise<RubricDoc | null> {
    const doc = await getCollection<RubricDocDoc>("rubrics").findOneAndUpdate(
      { id },
      {
        $set: {
          ...approvalFields(teacherId),
          updatedAt: nowIso(),
          updatedBy: teacherId,
        },
      },
      { returnDocument: "after" },
    );
    return parse(RubricDocSchema, doc);
  }

  async deleteRubricDraft(id: string): Promise<boolean> {
    const result = await getCollection<RubricDocDoc>("rubrics").deleteOne({
      id,
      status: "draft",
    });
    return result.deletedCount === 1;
  }

  // ---- AI explainer (spec 20.6) ---------------------------------------------------

  async listExplanations(
    filter?: ExplanationListFilter,
  ): Promise<ExplanationDoc[]> {
    const query: Record<string, unknown> = {};
    if (filter?.status) query.status = filter.status;
    if (filter?.topic?.trim()) {
      const regex = containsRegex(filter.topic);
      query.$or = [
        { topic: { $regex: regex } },
        { question: { $regex: regex } },
      ];
    }
    const docs = await getCollection<ExplanationDocDoc>("explanations")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    return docs
      .map((doc) => parse(ExplanationDocSchema, doc))
      .filter((doc): doc is ExplanationDoc => doc !== null);
  }

  async getExplanation(id: string): Promise<ExplanationDoc | null> {
    const doc = await getCollection<ExplanationDocDoc>("explanations").findOne({
      id,
    });
    return parse(ExplanationDocSchema, doc);
  }

  async createExplanation(
    input: CreateExplanationInput,
  ): Promise<ExplanationDoc> {
    const at = nowIso();
    const doc: ExplanationDoc = {
      id: `expl-${randomUUID()}`,
      ...input,
      status: "draft",
      createdAt: at,
      updatedAt: at,
    };
    const valid = parseOrThrow(ExplanationDocSchema, doc, "explanation");
    await getCollection<ExplanationDocDoc>("explanations").insertOne({
      ...valid,
    });
    return valid;
  }

  async updateExplanation(
    id: string,
    patch: UpdateExplanationPatch,
    updatedBy: string,
  ): Promise<ExplanationDoc | null> {
    const doc = await getCollection<ExplanationDocDoc>(
      "explanations",
    ).findOneAndUpdate(
      { id },
      { $set: { ...patch, updatedAt: nowIso(), updatedBy } },
      { returnDocument: "after" },
    );
    return parse(ExplanationDocSchema, doc);
  }

  async approveExplanation(
    id: string,
    teacherId: string,
  ): Promise<ExplanationDoc | null> {
    const doc = await getCollection<ExplanationDocDoc>(
      "explanations",
    ).findOneAndUpdate(
      { id },
      {
        $set: {
          ...approvalFields(teacherId),
          updatedAt: nowIso(),
          updatedBy: teacherId,
        },
      },
      { returnDocument: "after" },
    );
    return parse(ExplanationDocSchema, doc);
  }

  async deleteExplanationDraft(id: string): Promise<boolean> {
    const result = await getCollection<ExplanationDocDoc>(
      "explanations",
    ).deleteOne({
      id,
      status: "draft",
    });
    return result.deletedCount === 1;
  }

  // ---- class analytics support (spec 20.9) --------------------------------------

  async listClassGroups(): Promise<ClassGroup[]> {
    const docs = await getCollection<ClassGroupDoc>("classGroups")
      .find({})
      .sort({ name: 1 })
      .toArray();
    return docs
      .map((doc) => parse(ClassGroupSchema, doc))
      .filter((doc): doc is ClassGroup => doc !== null);
  }

  async listQuizResults(classId?: string): Promise<QuizResult[]> {
    // Oldest first — ready for trend grouping.
    const docs = await getCollection<QuizResultDoc>("quizResults")
      .find(classId ? { classId } : {})
      .sort({ createdAt: 1 })
      .toArray();
    return docs
      .map((doc) => parse(QuizResultSchema, doc))
      .filter((doc): doc is QuizResult => doc !== null);
  }

  async recordQuizResult(input: CreateQuizResultInput): Promise<QuizResult> {
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
    await getCollection<QuizResultDoc>("quizResults").insertOne({ ...valid });
    return valid;
  }
}
