import type { ZodType } from "zod";
import { topicProfile } from "./mock-content";
import {
  DEFAULT_MODELS,
  runGeneration,
  type ArtifactKind,
  type AiProvider,
  type GenerationResult,
  type ProviderName,
} from "./provider";
import type { QuizQuestion } from "./schemas/quiz";

/**
 * Mock provider (spec 36 — demo honesty). Deterministic, template-based
 * sample drafts derived from the teacher's own inputs (topic, level,
 * duration...). Clearly stamped provider "mock" — the UI labels every mock
 * artifact and the workspace banner explains how to enable real
 * generation. Server-side only, like every provider.
 *
 * Content comes from the curated SSC/HSC ICT topic library in
 * mock-content.ts, with an honest generic fallback for unknown topics.
 */

// ---- small input coercion helpers (inputs arrive as Record<string, unknown>) ----

function str(
  input: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = input[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function int(
  input: Record<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = input[key];
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function strList(input: Record<string, unknown>, key: string): string[] {
  const value = input[key];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

/** Cycle a pool deterministically: index 0..infinity maps into pool slots. */
function cyclic<T>(pool: T[], index: number): T {
  return pool[((index % pool.length) + pool.length) % pool.length];
}

// ---- per-kind deterministic builders ----------------------------------------

function buildLesson(input: Record<string, unknown>) {
  const topic = str(input, "topic", "the lesson topic");
  const classLevel = str(input, "classLevel", "HSC");
  const durationMin = int(input, "durationMin", 40, 5, 240);
  const assessmentStyle = str(input, "assessmentStyle", "oral questioning");
  const p = topicProfile(topic);

  const teacherObjectives = strList(input, "objectives");
  const learningObjectives =
    teacherObjectives.length > 0
      ? teacherObjectives.slice(0, 5)
      : [
          `Explain what ${topic} means and why it matters in ICT`,
          `Apply ${topic} to solve simple classroom examples`,
          `Identify one common mistake students make with ${topic}`,
        ];

  return {
    title: `${topic} — ${classLevel} (${durationMin} min)`,
    learningObjectives,
    warmUp: `Write "${topic}" on the board and ask students to list anything they already know about it. After two minutes, collect their ideas, praise accurate ones, and correct just one misconception so the lesson starts from what they actually believe.`,
    conceptExplanation: `${p.summary}\n\nKey ideas to develop on the board:\n${p.mcq
      .map((item) => `- ${item.prompt} (${item.answer}) — ${item.explanation}`)
      .join("\n")}\n\nWorked example to walk through slowly: ${p.example}`,
    activity: `Pair work (8-10 min): one student explains ${topic} to their partner using the board notes, then the partner repeats it back in their own words. Swap after the first round. Circulate and note pairs that get stuck — those notes drive the recap.`,
    practice: `Individual practice: students work through ${p.qa[0].q} Then two more exercises in the same pattern. Encourage showing every step; steps earn marks even when the final answer slips.`,
    assessment: `Match the requested style (${assessmentStyle}): ask ${p.qa[1].q} to three different students, then set a two-question exit ticket — ${p.tf[0].statement.replace(/\.$/, "")}? and one fresh exercise in the same pattern as the practice.`,
    homework: `At home, students write their own example of ${topic} from daily life (one paragraph) and solve ${p.qa.length > 1 ? p.qa[1].q : p.qa[0].q} Collect and skim before the next class.`,
    differentiation: {
      support: `Provide a partially completed version of the worked example (${p.example.slice(0, 60)}...) so weaker students fill gaps instead of starting from nothing; pair them for the activity.`,
      core: `All students complete the worked example, the practice set and the exit ticket as delivered.`,
      stretch: `Fast finishers answer: ${p.qa[0].q} in two different ways, then write a viva-style question on ${topic} for the class to try tomorrow.`,
    },
  };
}

function buildQuiz(input: Record<string, unknown>) {
  const topic = str(input, "topic", "the quiz topic");
  const classLevel = str(input, "classLevel", "HSC");
  const questionCount = int(input, "questionCount", 5, 1, 30);
  const requestedDifficulty = str(input, "difficulty", "medium").toLowerCase();
  const isMixed = requestedDifficulty === "mixed";
  const difficulty = (
    ["easy", "medium", "hard"].includes(requestedDifficulty)
      ? requestedDifficulty
      : "medium"
  ) as "easy" | "medium" | "hard";
  const difficultyCycle: ("easy" | "medium" | "hard")[] = [
    "easy",
    "medium",
    "hard",
  ];
  const language = str(input, "language", "English");
  // Bangla-medium classrooms keep technical terms in English; the mock
  // wraps the topic library in parameterized Bangla template strings.
  const isBangla = /bangla|bengali|বাংলা/i.test(language);
  const p = topicProfile(topic);
  const teacherObjective = str(input, "learningObjective", "");

  const requestedTypes = strList(input, "questionTypes")
    .map((type) => type.trim().toLowerCase())
    .filter((type) =>
      ["mcq", "true_false", "short_answer", "fill_blank", "viva"].includes(
        type,
      ),
    );
  const typeSequence =
    requestedTypes.length > 0
      ? requestedTypes
      : ["mcq", "short_answer", "true_false", "fill_blank", "viva"];

  const questions: QuizQuestion[] = [];
  // The topic pools are small; when a count cycles a pool twice, vary the
  // prompt instead of repeating the same question in one quiz.
  const usedPrompts = new Set<string>();
  function uniquePrompt(base: string): string {
    if (!usedPrompts.has(base)) {
      usedPrompts.add(base);
      return base;
    }
    let variant = 2;
    while (usedPrompts.has(`${base} (variant ${variant})`)) variant += 1;
    const prompt = `${base} (variant ${variant})`;
    usedPrompts.add(prompt);
    return prompt;
  }

  for (let i = 0; i < questionCount; i += 1) {
    // "mixed" = vary per-question difficulty deterministically.
    const questionDifficulty = isMixed
      ? cyclic(difficultyCycle, i)
      : difficulty;
    const type = cyclic(typeSequence, i);
    if (type === "mcq") {
      const item = cyclic(p.mcq, i);
      questions.push({
        prompt: uniquePrompt(item.prompt),
        type: "mcq",
        options: [...item.options],
        answer: item.answer,
        explanation: item.explanation,
        difficulty: questionDifficulty,
      });
    } else if (type === "true_false") {
      const item = cyclic(p.tf, i);
      questions.push({
        prompt: uniquePrompt(
          isBangla
            ? `সত্য না মিথ্যা: ${item.statement}`
            : `True or false: ${item.statement}`,
        ),
        type: "true_false",
        answer: item.answer,
        explanation: item.explanation,
        difficulty: questionDifficulty,
      });
    } else if (type === "fill_blank") {
      const item = cyclic(p.cloze, i);
      questions.push({
        prompt: uniquePrompt(
          isBangla
            ? `ফাঁকা স্থানটি পূরণ করো: ${item.sentence}`
            : `Fill in the blank: ${item.sentence}`,
        ),
        type: "fill_blank",
        answer: item.answer,
        explanation: isBangla
          ? `পূরণ করা বাক্য: ${item.sentence.replace("___", item.answer)}`
          : `The completed sentence is: ${item.sentence.replace("___", item.answer)}`,
        difficulty: questionDifficulty,
      });
    } else if (type === "viva") {
      const item = cyclic(p.qa, i);
      questions.push({
        prompt: uniquePrompt(
          isBangla
            ? `মৌখিক প্রশ্ন: ${item.q} উত্তরের কারণ জোরে বলো।`
            : `Viva: ${item.q} Explain your reasoning aloud.`,
        ),
        type: "viva",
        answer: `${item.a} (model answer)`,
        explanation: item.explanation,
        difficulty: questionDifficulty,
      });
    } else {
      const item = cyclic(p.qa, i);
      questions.push({
        prompt: uniquePrompt(item.q),
        type: "short_answer",
        answer: item.a,
        explanation: item.explanation,
        difficulty: questionDifficulty,
      });
    }
  }

  const banglaDifficulty = { easy: "সহজ", medium: "মাঝারি", hard: "কঠিন" }[
    difficulty
  ];
  const instructions = isBangla
    ? `সবগুলো ${questionCount}টি প্রশ্নের উত্তর দাও। MCQ-তে একটি অপশন বেছে নাও, সংক্ষিপ্ত প্রশ্নের উত্তরে ধাপ দেখাও। এই কুইজটি ${topic} সম্পর্কে তোমার ধারণা যাচাই করে।`
    : `Answer all ${questionCount} questions. For MCQs circle one option; for short answers show your working. This quiz checks your understanding of ${topic}.`;

  return {
    title: isBangla
      ? `${topic} কুইজ — ${classLevel}`
      : `${topic} Quiz — ${classLevel}`,
    instructions,
    difficulty,
    learningObjective: isBangla
      ? teacherObjective ||
        `শিক্ষার্থীরা ${topic} বিষয়ে ${banglaDifficulty} মানের প্রশ্নের সঠিক উত্তর দিতে পারবে।`
      : teacherObjective ||
        `Students can answer ${difficulty} questions on ${topic}.`,
    questions,
  };
}

function buildWorksheet(input: Record<string, unknown>) {
  const topic = str(input, "topic", "the worksheet topic");
  const classLevel = str(input, "classLevel", "HSC");
  const teacherGoals = strList(input, "learningGoals");
  const p = topicProfile(topic);

  const partA = [
    `Fill in the blank: ${p.cloze[0].sentence}`,
    `True or false: ${p.tf[0].statement}`,
    p.qa[0].q,
  ];
  const partB = [
    p.qa.length > 1 ? p.qa[1].q : p.qa[0].q,
    `Work through this step by step, showing every stage: ${p.example}`,
  ];
  const partC = [
    `Explain ${topic} to a classmate who missed the lesson, in no more than four sentences.`,
    `Invent one exam-style question on ${topic} and write its model answer.`,
  ];

  const sections = [
    { heading: "Part A: Warm-up (recall)", questions: partA },
    { heading: "Part B: Practice (apply)", questions: partB },
    { heading: "Part C: Challenge (create)", questions: partC },
  ];

  const answerKey = [
    p.cloze[0].answer,
    p.tf[0].answer,
    p.qa[0].a,
    p.qa.length > 1 ? p.qa[1].a : p.qa[0].a,
    "Full working following the method from the board example; award method marks even if the final value slips.",
    "Four accurate sentences naming the definition, one example and one use of the topic.",
    "Any question that requires understanding, not just recall, with a correct model answer.",
  ];

  return {
    title: `${topic} Practice Worksheet — ${classLevel}`,
    learningGoals:
      teacherGoals.length > 0
        ? teacherGoals.slice(0, 5)
        : [
            `Recall the key facts of ${topic}`,
            `Apply ${topic} to structured questions with full working`,
            `Explain ${topic} clearly in writing`,
          ],
    instructions: `Write your answers in the space after each question. Show your working in Part B — method earns marks. Time: about 25 minutes for Parts A and B, extra time for Part C.`,
    sections,
    answerKey,
    teacherNotes: `Marking guide: Part A 1 mark each; Part B 2 marks each (1 method, 1 answer); Part C up to 3 marks for accuracy and clarity. Common error to watch for: ${p.misconception}`,
  };
}

function buildRubric(input: Record<string, unknown>) {
  const assignmentTitle = str(input, "assignmentTitle", "the assignment");
  const classLevel = str(input, "classLevel", "HSC");
  const criteriaCount = int(input, "criteriaCount", 4, 3, 6);
  const totalPoints = int(input, "totalPoints", 100, 5, 1000);
  const topic = str(input, "topic", assignmentTitle);

  const definitions: Array<{
    criterion: string;
    excellent: string;
    good: string;
    developing: string;
    beginning: string;
  }> = [
    {
      criterion: "Understanding of the topic",
      excellent: `Explains ${topic} accurately and completely, in the student's own words, with a correct example.`,
      good: `Explains ${topic} accurately with minor gaps; example is mostly correct.`,
      developing: `Explanation of ${topic} is partly accurate but relies on memorised wording.`,
      beginning: `Explanation of ${topic} is incorrect or missing.`,
    },
    {
      criterion: "Correct method and working",
      excellent:
        "Method is fully correct and every step of the working is shown.",
      good: "Method correct; one or two steps of working are missing.",
      developing: "Method partly correct; working is patchy.",
      beginning: "Method incorrect or no working shown.",
    },
    {
      criterion: "Presentation and clarity",
      excellent: "Answers are neat, labelled and easy to follow.",
      good: "Answers are clear with minor presentation slips.",
      developing: "Answers are hard to follow in places.",
      beginning: "Answers are disorganised or unreadable.",
    },
    {
      criterion: "Completion and timeliness",
      excellent: "All tasks completed and submitted on time.",
      good: "All but one small task completed on time.",
      developing: "Several tasks incomplete or submitted late.",
      beginning: "Most tasks incomplete.",
    },
    {
      criterion: "Independent problem solving",
      excellent:
        "Attempts every challenge task without help and checks the results.",
      good: "Attempts challenge tasks with minimal prompting.",
      developing: "Needs regular guidance to progress.",
      beginning: "Does not attempt tasks without step-by-step help.",
    },
    {
      criterion: "Use of correct terminology",
      excellent: `Uses the exact technical terms of ${topic} correctly throughout.`,
      good: "Technical terms mostly correct.",
      developing: "Terms used loosely or interchangeably.",
      beginning: "Technical terms not used or misused.",
    },
  ];

  const chosen = definitions.slice(0, criteriaCount);
  // Deterministic weight distribution: front-loaded, remainder on the last criterion.
  const weights = chosen.map((_, index) => {
    const remaining = chosen.length - index;
    if (index === chosen.length - 1) return 0; // filled from the remainder below
    return Math.max(1, Math.round(totalPoints / (remaining + 1)));
  });
  const allocated = weights.reduce((sum, weight) => sum + weight, 0);
  weights[weights.length - 1] = Math.max(1, totalPoints - allocated);

  const criteria = chosen.map((definition, index) => ({
    ...definition,
    points: weights[index],
  }));

  return {
    title: `${assignmentTitle} — Rubric (${classLevel})`,
    criteria,
    totalPoints: criteria.reduce((sum, criterion) => sum + criterion.points, 0),
  };
}

function buildExplainer(input: Record<string, unknown>) {
  const topic = str(input, "topic", "the topic");
  const p = topicProfile(topic);
  const result: Record<string, unknown> = {
    simpleExplanation: p.summary,
    analogy: p.analogy,
    stepByStep: [
      `State the definition in one sentence (anchor everything to it).`,
      ...p.qa.map((item) => `${item.q} — ${item.a}`),
      `Redo the worked example yourself without looking: ${p.example}`,
    ],
    commonMistake: p.misconception,
    practiceQuestion: {
      question: p.qa[0].q,
      answer: p.qa[0].a,
    },
  };
  if (p.generic) {
    result.uncertaintyNote =
      "This is a generic sample explanation (mock mode) — verify the topic-specific details against your textbook before classroom use.";
  }
  return result;
}

export class MockProvider implements AiProvider {
  readonly name: ProviderName = "mock";
  readonly model: string = DEFAULT_MODELS.mock;

  async generate<T>(
    kind: ArtifactKind,
    input: Record<string, unknown>,
    schema: ZodType<T>,
  ): Promise<GenerationResult<T>> {
    return runGeneration(kind, input, schema, {
      name: this.name,
      model: this.model,
      repairable: false,
      produce: async () => this.build(kind, input),
    });
  }

  /** Deterministic: same kind + input always produces the same draft. */
  private build(kind: ArtifactKind, input: Record<string, unknown>): unknown {
    switch (kind) {
      case "lesson":
        return buildLesson(input);
      case "quiz":
        return buildQuiz(input);
      case "worksheet":
        return buildWorksheet(input);
      case "rubric":
        return buildRubric(input);
      case "explainer":
        return buildExplainer(input);
    }
  }
}
