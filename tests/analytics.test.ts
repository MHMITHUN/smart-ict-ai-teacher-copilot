import { describe, expect, it } from "vitest";
import type { QuizResult, Question } from "@/lib/db/types";
import {
  classAveragePct,
  completionRate,
  difficultyDistribution,
  mostMissedConcepts,
  quizAverageTrend,
  topicPerformance,
} from "@/lib/analytics/aggregates";

/**
 * Class-analytics aggregates (spec 20.9): pure functions over QuizResult
 * rows — averages, monthly trend grouping, most-missed ordering (weakest
 * first, <60% flagged), completion among participants, and the bank's
 * difficulty distribution.
 */

function row(overrides: Partial<QuizResult>): QuizResult {
  return {
    id: `row-${Math.random().toString(36).slice(2)}`,
    classId: "cls-test",
    topic: "Number Systems",
    studentName: "Student",
    score: 5,
    total: 10,
    createdAt: "2026-02-01T09:00:00.000Z",
    ...overrides,
  };
}

describe("quizAverageTrend: monthly grouping", () => {
  it("averages within a month and orders oldest first", () => {
    const results = [
      row({ createdAt: "2026-03-05T09:00:00.000Z", score: 9 }), // 90%
      row({ createdAt: "2026-02-02T09:00:00.000Z", score: 8 }), // 80%
      row({ createdAt: "2026-02-20T09:00:00.000Z", score: 6 }), // 60%
    ];
    const trend = quizAverageTrend(results);
    expect(trend).toHaveLength(2);
    expect(trend[0].month).toBe("2026-02");
    expect(trend[0].averagePct).toBe(70); // (80+60)/2
    expect(trend[0].attempts).toBe(2);
    expect(trend[1].month).toBe("2026-03");
    expect(trend[1].averagePct).toBe(90);
    expect(trend[1].label).toBe("Mar 2026");
  });

  it("returns an empty trend for no results", () => {
    expect(quizAverageTrend([])).toEqual([]);
  });
});

describe("classAveragePct", () => {
  it("averages score/total across attempts (not naive score means)", () => {
    const results = [
      row({ score: 7, total: 10 }),
      row({ score: 18, total: 20 }), // 90% — different totals must weight correctly
    ];
    expect(classAveragePct(results)).toBe(80); // (70+90)/2
  });

  it("is 0 with no attempts", () => {
    expect(classAveragePct([])).toBe(0);
  });
});

describe("topicPerformance + mostMissedConcepts ordering", () => {
  const results = [
    row({ topic: "Logic Gates", score: 3 }), // 30%
    row({ topic: "Logic Gates", score: 5 }), // 50% -> avg 40%
    row({ topic: "Database", score: 8 }), // 80%
    row({ topic: "C Programming", score: 6 }), // 60%
  ];

  it("topicPerformance lists strongest first", () => {
    const topics = topicPerformance(results);
    expect(topics.map((t) => t.topic)).toEqual([
      "Database",
      "C Programming",
      "Logic Gates",
    ]);
    expect(topics[0].averagePct).toBe(80);
  });

  it("mostMissedConcepts lists weakest FIRST and flags under 60%", () => {
    const missed = mostMissedConcepts(results);
    expect(missed.map((t) => t.topic)).toEqual([
      "Logic Gates",
      "C Programming",
      "Database",
    ]);
    expect(missed[0].averagePct).toBe(40);
    expect(missed[0].needsAttention).toBe(true); // 40 < 60
    expect(missed[1].needsAttention).toBe(false); // 60 is not < 60
    expect(missed[2].needsAttention).toBe(false);
  });

  it("honours a custom attention threshold", () => {
    const missed = mostMissedConcepts(results, 65);
    expect(missed.filter((t) => t.needsAttention).map((t) => t.topic)).toEqual([
      "Logic Gates",
      "C Programming",
    ]);
  });
});

describe("completionRate among participating students", () => {
  it("expected = distinct students x distinct topics; absences lower the rate", () => {
    // 2 students, 2 topics -> 4 expected; one student missed one topic.
    const results = [
      row({ studentName: "A", topic: "Number Systems" }),
      row({ studentName: "B", topic: "Number Systems" }),
      row({ studentName: "A", topic: "Database" }),
    ];
    const completion = completionRate(results);
    expect(completion.students).toBe(2);
    expect(completion.topicsAdministered).toBe(2);
    expect(completion.expected).toBe(4);
    expect(completion.covered).toBe(3);
    expect(completion.recorded).toBe(3);
    expect(completion.ratePct).toBe(75);
  });

  it("100% when everyone sat everything; 0% with no results", () => {
    const full = [
      row({ studentName: "A", topic: "T1" }),
      row({ studentName: "B", topic: "T1" }),
    ];
    expect(completionRate(full).ratePct).toBe(100);
    expect(completionRate([]).ratePct).toBe(0);
  });

  it("a retake of the same topic adds a row but never inflates the rate", () => {
    const results = [
      row({ studentName: "A", topic: "T1" }),
      row({ studentName: "A", topic: "T1" }), // September re-test of Feb's topic
    ];
    const completion = completionRate(results);
    expect(completion.recorded).toBe(2); // honest raw count
    expect(completion.covered).toBe(1); // one slot
    expect(completion.ratePct).toBe(100);
  });
});

describe("difficultyDistribution of the bank", () => {
  function question(difficulty: "easy" | "medium" | "hard"): Question {
    return {
      id: `q-${difficulty}-${Math.random().toString(36).slice(2)}`,
      question: "Q?",
      type: "short_answer",
      difficulty,
      topic: "T",
      learningObjective: "Obj",
      answer: "A",
      explanation: "E",
      tags: [],
      status: "published",
      source: "manual",
      createdBy: "usr-teacher-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  }

  it("counts per difficulty in fixed easy/medium/hard order", () => {
    const questions = [
      question("easy"),
      question("easy"),
      question("easy"),
      question("hard"),
    ];
    const slices = difficultyDistribution(questions);
    expect(slices).toEqual([
      { difficulty: "easy", count: 3 },
      { difficulty: "medium", count: 0 },
      { difficulty: "hard", count: 1 },
    ]);
  });
});

describe("demo seeds feed the aggregates (integration smoke)", () => {
  // Seeds the full DemoStore (4 scrypt password hashes + 183 results), so it
  // legitimately outruns the 5s unit default on slower machines.
  it(
    "every class has results across all 5 topics plus the re-test",
    async () => {
    const { getStore, resetStoreForTests } = await import("@/lib/db");
    delete process.env.MONGODB_URI;
    resetStoreForTests();
    const store = await getStore();

    const classes = await store.listClassGroups();
    expect(classes).toHaveLength(3);

    for (const group of classes) {
      const results = await store.listQuizResults(group.id);
      expect(results.length).toBeGreaterThan(30);
      const topics = new Set(results.map((r) => r.topic));
      expect(topics.size).toBe(5); // 5 topics, Number Systems twice
      const months = new Set(quizAverageTrend(results).map((t) => t.month));
      expect(months.size).toBe(6); // Feb, Mar, Apr, Jun, Aug + the Sep re-test
      // Aggregated view only: names never surface through the aggregates.
      const completion = completionRate(results);
      expect(completion.students).toBeGreaterThan(0);
      expect(completion.ratePct).toBeLessThanOrEqual(100);
    }
    },
    30_000,
  );
});
