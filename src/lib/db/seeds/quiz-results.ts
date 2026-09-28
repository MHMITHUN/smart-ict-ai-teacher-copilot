import type { CreateQuizResultInput } from "../types";

/**
 * Fictional quiz results powering Class Analytics (spec 20.9). Fully
 * deterministic (an LCG keyed by class + topic + student), fixed Feb-Sep
 * 2026 dates, realistic per-class/per-topic score distributions: younger
 * classes find logic gates and C programming hardest, the HSC intro CSE
 * group performs best, and every class improves on the September Number
 * Systems re-test after remedial teaching.
 *
 * These rows feed AGGREGATES ONLY — the app has no individual-student
 * tracking. Names are invented demo people, never real students.
 */

const TOTAL_PER_QUIZ = 10;

/** Topic quiz calendar (2026): month, day, plus a September re-test. */
interface QuizDay {
  topic: string;
  month: number; // 1-12
  day: number;
  /** Score bump applied on the re-test after remedial teaching. */
  bump?: number;
}

const QUIZ_DAYS: QuizDay[] = [
  { topic: "Number Systems", month: 2, day: 12 },
  { topic: "Logic Gates", month: 3, day: 9 },
  { topic: "Computer Network", month: 4, day: 16 },
  { topic: "C Programming", month: 6, day: 11 },
  { topic: "Database", month: 8, day: 6 },
  { topic: "Number Systems", month: 9, day: 10, bump: 8 },
];

interface ClassPlan {
  classId: string;
  /** Fictional participating students (8-12 per administered quiz). */
  students: string[];
  /** Base average % per topic for this class. */
  base: Record<string, number>;
}

const CLASS_PLANS: ClassPlan[] = [
  {
    classId: "cls-nine-ict",
    students: [
      "Arif Chowdhury",
      "Sadia Islam",
      "Rakib Hasan",
      "Mitu Akter",
      "Naeem Sarkar",
      "Farzana Rahman",
      "Imran Kabir",
      "Tisha Noor",
      "Sajid Mahmud",
      "Rima Khatun",
      "Dipto Barua",
      "Lamia Haque",
    ],
    base: {
      "Number Systems": 62,
      "Logic Gates": 48,
      "Computer Network": 70,
      "C Programming": 45,
      Database: 58,
    },
  },
  {
    classId: "cls-ten-ict",
    students: [
      "Ruhan Mollah",
      "Sumaiya Binte",
      "Ashik Mia",
      "Nabila Sharmin",
      "Tarek Aziz",
      "Puja Das",
      "Rifat Jahan",
      "Ovi Talukder",
      "Shanta Parvin",
      "Zahid Nolan",
      "Mim Sultana",
    ],
    base: {
      "Number Systems": 72,
      "Logic Gates": 55,
      "Computer Network": 78,
      "C Programming": 58,
      Database: 66,
    },
  },
  {
    classId: "cls-hsc1-cse",
    students: [
      "Nafis Anwar",
      "Tasnim Alam",
      "Shakib Reza",
      "Ishita Chowdhury",
      "Raisul Karim",
      "Ontora Begum",
      "Fahim Dastagir",
      "Nusrat Mimi",
      "Sabbir Osmani",
      "Tania Lucky",
    ],
    base: {
      "Number Systems": 84,
      "Logic Gates": 76,
      "Computer Network": 82,
      "C Programming": 80,
      Database: 74,
    },
  },
];

// ---- deterministic pseudo-random (same seeds -> identical rows) -------------

function hashSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function lcg(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function isoDate(month: number, day: number, minuteOffset: number): string {
  // 09:30 local demo hour, UTC ISO string (dates are display-only).
  return `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T09:30:${String(
    minuteOffset % 60,
  ).padStart(2, "0")}.000Z`;
}

/** Score /10 from a base average % +- a deterministic spread. */
function scoreFromPct(basePct: number, rand: () => number): number {
  const pct = basePct + (rand() * 28 - 14);
  return Math.max(
    2,
    Math.min(TOTAL_PER_QUIZ, Math.round((pct / 100) * TOTAL_PER_QUIZ)),
  );
}

/**
 * Build every seeded quiz result. Per class: 5 topic quizzes + 1 September
 * re-test; 8-12 fictional students each, with a few absentees so the
 * completion aggregate stays honest (never exactly 100%).
 */
export function buildQuizResultSeeds(): CreateQuizResultInput[] {
  const rows: CreateQuizResultInput[] = [];
  let minuteCursor = 0;

  for (const plan of CLASS_PLANS) {
    for (const quiz of QUIZ_DAYS) {
      const base = plan.base[quiz.topic] + (quiz.bump ?? 0);
      // Absentees: everyone sits the first quiz; later quizzes lose 0-2
      // students; the September re-test keeps roughly three quarters.
      const absent =
        quiz.bump !== undefined
          ? Math.max(0, plan.students.length - 9)
          : quiz.month > 2
            ? Math.floor(
                lcg(hashSeed(`${plan.classId}${quiz.topic}${quiz.month}`))() *
                  3,
              )
            : 0;
      const present = plan.students.slice(0, plan.students.length - absent);

      for (const student of present) {
        const rand = lcg(
          hashSeed(`${plan.classId}|${quiz.topic}|${student}|${quiz.month}`),
        );
        const score = scoreFromPct(base, rand);
        minuteCursor += 1;
        rows.push({
          classId: plan.classId,
          topic: quiz.topic,
          studentName: student,
          score,
          total: TOTAL_PER_QUIZ,
          createdAt: isoDate(quiz.month, quiz.day, minuteCursor),
        });
      }
    }
  }
  return rows;
}
