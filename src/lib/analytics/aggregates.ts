import type { QuizResult, Question } from "@/lib/db/types";
import type { Difficulty } from "@/lib/ai/schemas";

/**
 * Class-analytics aggregates (spec 20.9). Pure functions over QuizResult
 * rows and bank questions — the page feeds them one class's rows at a
 * time. AGGREGATED CLASS-LEVEL VIEW ONLY: nothing here keys on an
 * individual student; the caller must never render per-student views.
 */

/** score/total as a percentage for one result row. */
export function resultPct(row: QuizResult): number {
  return (row.score / row.total) * 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---- quiz average trend -----------------------------------------------------------

export interface TrendPoint {
  /** "YYYY-MM" — the calendar month of the attempts. */
  month: string;
  /** Human label, e.g. "Feb 2026". */
  label: string;
  /** Average percentage across the month's attempts. */
  averagePct: number;
  attempts: number;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Monthly average-% trend, oldest month first (line-chart ready). */
export function quizAverageTrend(results: QuizResult[]): TrendPoint[] {
  const byMonth = new Map<string, { pctSum: number; count: number }>();
  for (const row of results) {
    const key = monthKey(row.createdAt);
    const bucket = byMonth.get(key) ?? { pctSum: 0, count: 0 };
    bucket.pctSum += resultPct(row);
    bucket.count += 1;
    byMonth.set(key, bucket);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { pctSum, count }]) => ({
      month,
      label: monthLabel(month),
      averagePct: round1(pctSum / count),
      attempts: count,
    }));
}

// ---- topic performance + most-missed -----------------------------------------------

export interface TopicRow {
  topic: string;
  /** Average percentage across the topic's attempts. */
  averagePct: number;
  attempts: number;
  /** True when averagePct is below the attention threshold. */
  needsAttention: boolean;
}

function rowsByTopic(
  results: QuizResult[],
  sort: "best-first" | "worst-first",
  attentionBelowPct: number,
): TopicRow[] {
  const byTopic = new Map<string, { pctSum: number; count: number }>();
  for (const row of results) {
    const bucket = byTopic.get(row.topic) ?? { pctSum: 0, count: 0 };
    bucket.pctSum += resultPct(row);
    bucket.count += 1;
    byTopic.set(row.topic, bucket);
  }
  const rows = [...byTopic.entries()].map(([topic, { pctSum, count }]) => {
    const averagePct = round1(pctSum / count);
    return {
      topic,
      averagePct,
      attempts: count,
      needsAttention: averagePct < attentionBelowPct,
    };
  });
  return rows.sort((a, b) =>
    sort === "best-first"
      ? b.averagePct - a.averagePct || a.topic.localeCompare(b.topic)
      : a.averagePct - b.averagePct || a.topic.localeCompare(b.topic),
  );
}

/** Average % per topic, strongest topic first (bar-chart ready). */
export function topicPerformance(results: QuizResult[]): TopicRow[] {
  return rowsByTopic(results, "best-first", Number.POSITIVE_INFINITY);
}

/**
 * Most-missed concepts (spec 20.9): topics by average % ASCENDING — the
 * weakest first — with `needsAttention` flagged below 60% by default.
 */
export const MOST_MISSED_ATTENTION_PCT = 60;

export function mostMissedConcepts(
  results: QuizResult[],
  attentionBelowPct: number = MOST_MISSED_ATTENTION_PCT,
): TopicRow[] {
  return rowsByTopic(results, "worst-first", attentionBelowPct);
}

// ---- completion rate -----------------------------------------------------------------

export interface CompletionSummary {
  /** Distinct students who took at least one quiz in the window. */
  students: number;
  /** Distinct topics administered in the window. */
  topicsAdministered: number;
  /** students x topicsAdministered — the expected participation slots. */
  expected: number;
  /** Slots covered by at least one result (retakes do not double-count). */
  covered: number;
  /** Total result rows recorded (retakes included — can exceed expected). */
  recorded: number;
  /** covered / expected as a percentage (a retake never inflates it). */
  ratePct: number;
}

/**
 * Quiz completion among participating students: of the (student, topic)
 * slots that could have been sat, how many have at least one result.
 * Retakes (e.g. a September re-test of February's topic) cover the same
 * slot, so they add to `recorded` without inflating the rate.
 */
export function completionRate(results: QuizResult[]): CompletionSummary {
  const students = new Set<string>();
  const topics = new Set<string>();
  const slots = new Set<string>();
  for (const row of results) {
    students.add(row.studentName);
    topics.add(row.topic);
    slots.add(`${row.studentName}::${row.topic}`);
  }
  const expected = students.size * topics.size;
  const ratePct = expected === 0 ? 0 : (slots.size / expected) * 100;
  return {
    students: students.size,
    topicsAdministered: topics.size,
    expected,
    covered: slots.size,
    recorded: results.length,
    ratePct: round1(ratePct),
  };
}

// ---- overall class average -------------------------------------------------------------

/** Overall average % across every attempt in the window. */
export function classAveragePct(results: QuizResult[]): number {
  if (results.length === 0) return 0;
  const sum = results.reduce((total, row) => total + resultPct(row), 0);
  return round1(sum / results.length);
}

// ---- question difficulty distribution ---------------------------------------------------

export interface DifficultySlice {
  difficulty: Difficulty;
  count: number;
}

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

/** Count of bank questions per difficulty, fixed easy/medium/hard order. */
export function difficultyDistribution(
  questions: Question[],
): DifficultySlice[] {
  return DIFFICULTY_ORDER.map((difficulty) => ({
    difficulty,
    count: questions.filter((question) => question.difficulty === difficulty)
      .length,
  }));
}
