import type {
  AiProviderName,
  ExplanationDoc,
  LessonPlanDoc,
  QuizDoc,
  ReviewStatus,
  RubricDoc,
  WorksheetDoc,
} from "@/lib/db/types";

/**
 * Content Library (spec 20.2): one unified, read-only listing across every
 * artifact type. APPROVED artifacts only — drafts stay in their generators
 * until a teacher reviews them (spec 20.10), so the library is the "safe to
 * reuse" surface. Pure functions; the page supplies store results.
 */

export const LIBRARY_TYPES = [
  "lesson",
  "quiz",
  "worksheet",
  "rubric",
  "explanation",
] as const;
export type LibraryArtifactType = (typeof LIBRARY_TYPES)[number];

export interface LibraryEntry {
  id: string;
  type: LibraryArtifactType;
  title: string;
  /** One-line context line under the title. */
  subtitle: string;
  topic: string;
  status: ReviewStatus;
  provider: AiProviderName;
  createdAt: string;
  approvedAt?: string;
  /** Link to the artifact's own page. */
  href: string;
}

export const LIBRARY_TYPE_LABELS: Record<LibraryArtifactType, string> = {
  lesson: "Lesson plan",
  quiz: "Quiz",
  worksheet: "Worksheet",
  rubric: "Rubric",
  explanation: "Explanation",
};

/** Plural labels for filter chips and counts (quizzes, not "quizs"). */
export const LIBRARY_TYPE_PLURAL_LABELS: Record<LibraryArtifactType, string> = {
  lesson: "Lesson plans",
  quiz: "Quizzes",
  worksheet: "Worksheets",
  rubric: "Rubrics",
  explanation: "Explanations",
};

/**
 * Build library entries from catalog docs. Drafts are DROPPED here (the
 * library is approved-only by definition) — pages should still pass
 * status-filtered lists so stores do the heavy lifting.
 */
export function buildLibraryEntries(input: {
  lessons: LessonPlanDoc[];
  quizzes: QuizDoc[];
  worksheets: WorksheetDoc[];
  rubrics: RubricDoc[];
  explanations: ExplanationDoc[];
}): LibraryEntry[] {
  const entries: LibraryEntry[] = [
    ...input.lessons
      .filter((doc) => doc.status === "approved")
      .map<LibraryEntry>((doc) => ({
        id: doc.id,
        type: "lesson",
        title: doc.content.title,
        subtitle: `${doc.classLevel} · ${doc.durationMin} min`,
        topic: doc.topic,
        status: doc.status,
        provider: doc.provider,
        createdAt: doc.createdAt,
        approvedAt: doc.approvedAt,
        href: `/lesson-planner?id=${doc.id}`,
      })),
    ...input.quizzes
      .filter((doc) => doc.status === "approved")
      .map<LibraryEntry>((doc) => ({
        id: doc.id,
        type: "quiz",
        title: doc.content.title,
        subtitle: `${doc.classLevel} · ${doc.questionCount} questions · ${doc.difficulty}`,
        topic: doc.topic,
        status: doc.status,
        provider: doc.provider,
        createdAt: doc.createdAt,
        approvedAt: doc.approvedAt,
        href: `/quiz-generator?id=${doc.id}`,
      })),
    ...input.worksheets
      .filter((doc) => doc.status === "approved")
      .map<LibraryEntry>((doc) => ({
        id: doc.id,
        type: "worksheet",
        title: doc.content.title,
        subtitle: `${doc.classLevel} · ${countWorksheetQuestions(doc)} questions`,
        topic: doc.topic,
        status: doc.status,
        provider: doc.provider,
        createdAt: doc.createdAt,
        approvedAt: doc.approvedAt,
        href: `/worksheets?id=${doc.id}`,
      })),
    ...input.rubrics
      .filter((doc) => doc.status === "approved")
      .map<LibraryEntry>((doc) => ({
        id: doc.id,
        type: "rubric",
        title: doc.content.title,
        subtitle: `${doc.classLevel} · ${doc.content.criteria.length} criteria · ${doc.content.totalPoints} points`,
        topic: doc.topic,
        status: doc.status,
        provider: doc.provider,
        createdAt: doc.createdAt,
        approvedAt: doc.approvedAt,
        href: `/rubric-builder?id=${doc.id}`,
      })),
    ...input.explanations
      .filter((doc) => doc.status === "approved")
      .map<LibraryEntry>((doc) => ({
        id: doc.id,
        type: "explanation",
        title: doc.question,
        subtitle: `${doc.topic} · ${doc.audience === "teacher" ? "teacher mode" : "student mode"}`,
        topic: doc.topic,
        status: doc.status,
        provider: doc.provider,
        createdAt: doc.createdAt,
        approvedAt: doc.approvedAt,
        href: `/ai-explainer?id=${doc.id}`,
      })),
  ];

  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function countWorksheetQuestions(doc: WorksheetDoc): number {
  return doc.content.sections.reduce(
    (sum, section) => sum + section.questions.length,
    0,
  );
}

export interface LibraryFilter {
  type?: LibraryArtifactType;
  /** Case-insensitive contains on title, topic or subtitle. */
  search?: string;
}

export function filterLibraryEntries(
  entries: LibraryEntry[],
  filter: LibraryFilter,
): LibraryEntry[] {
  let out = entries;
  if (filter.type) {
    out = out.filter((entry) => entry.type === filter.type);
  }
  const search = filter.search?.trim().toLowerCase();
  if (search) {
    out = out.filter(
      (entry) =>
        entry.title.toLowerCase().includes(search) ||
        entry.topic.toLowerCase().includes(search) ||
        entry.subtitle.toLowerCase().includes(search),
    );
  }
  return out;
}

/** Count of approved entries per type, plus the "all" total. */
export function countLibraryEntriesByType(entries: LibraryEntry[]): {
  all: number;
  lesson: number;
  quiz: number;
  worksheet: number;
  rubric: number;
  explanation: number;
} {
  const counts = {
    all: entries.length,
    lesson: 0,
    quiz: 0,
    worksheet: 0,
    rubric: 0,
    explanation: 0,
  };
  for (const entry of entries) counts[entry.type] += 1;
  return counts;
}
