import { ROLE_FRAME, JSON_CONTRACT, INTEGRITY_RULES, formatInputBlock } from "./shared";

/** Teacher inputs for quiz generation (spec 20.4). */
export interface QuizPromptInput {
  topic: string;
  classLevel: string;
  questionCount: number;
  /** "mixed" = vary per-question difficulty (easy/medium/hard blend). */
  difficulty: "easy" | "medium" | "hard" | "mixed";
  /** Question types requested; "Mixed" means choose a sensible variety. */
  questionTypes: string[];
  learningObjective?: string;
  /** Response language for student-facing text (default English). */
  language?: string;
}

const FIELD_CONTRACT = `Return a JSON object with EXACTLY these fields:
{
  "title": string — quiz title including the topic,
  "instructions": string — 1-2 sentences of student-facing instructions,
  "difficulty": "easy" | "medium" | "hard" — the quiz's OVERALL difficulty; when a mix of difficulties was requested use "medium" and vary each question's own difficulty,
  "learningObjective": string — the objective this quiz measures,
  "questions": array of EXACTLY the requested number of question objects, each:
  {
    "prompt": string — the question text, no numbering,
    "type": "mcq" | "true_false" | "short_answer" | "fill_blank" | "viva",
    "options": string[] — REQUIRED only for "mcq": exactly 4 distinct options,
    "answer": string — the correct answer; for mcq it must equal one of the options; for true_false exactly "true" or "false"; for fill_blank the missing word/phrase; for viva a model answer of 2-4 sentences,
    "explanation": string — why the answer is correct, for the teacher,
    "difficulty": "easy" | "medium" | "hard"
  }
}
The requested questionTypes may list the value "Mixed" — that means choose a sensible variety across the five types.`;

const MINI_EXAMPLE = `Worked mini-example (shape only — adapt fully to the inputs, never copy it literally):
{"title":"Number Systems Quiz","instructions":"Answer every question. For MCQs circle one option.","difficulty":"medium","learningObjective":"Students can convert between decimal and binary.","questions":[{"prompt":"What is the binary form of the decimal number 10?","type":"mcq","options":["1000","1010","1100","1110"],"answer":"1010","explanation":"10 = 8 + 2 = 1x8 + 0x4 + 1x2 + 0x1 = 1010.","difficulty":"easy"},{"prompt":"The binary number 1011 equals decimal 11.","type":"true_false","answer":"true","explanation":"8 + 0 + 2 + 1 = 11.","difficulty":"easy"},{"prompt":"Convert the decimal number 25 to binary.","type":"short_answer","answer":"11001","explanation":"25 = 16 + 8 + 1.","difficulty":"medium"}]}`;

export function buildQuizPrompt(input: QuizPromptInput): string {
  return [
    ROLE_FRAME,
    "",
    "TASK: Generate a complete quiz for the following parameters.",
    "",
    "TEACHER INPUTS:",
    formatInputBlock(input),
    "",
    FIELD_CONTRACT,
    "",
    MINI_EXAMPLE,
    "",
    JSON_CONTRACT,
    INTEGRITY_RULES,
  ].join("\n");
}
