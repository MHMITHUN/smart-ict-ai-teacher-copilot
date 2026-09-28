import {
  ROLE_FRAME,
  JSON_CONTRACT,
  INTEGRITY_RULES,
  formatInputBlock,
} from "./shared";

/** Teacher inputs for worksheet generation (spec 20.7). */
export interface WorksheetPromptInput {
  topic: string;
  classLevel: string;
  /** Desired number of sections (default 3 if unset). */
  sectionCount?: number;
  /** Extra focus the teacher wants (optional). */
  focus?: string;
  /** How easy/hard the questions should lean (optional). */
  difficultyMix?: string;
  /** Teacher-supplied goals echoed into learningGoals (optional). */
  learningGoals?: string[];
}

const FIELD_CONTRACT = `Return a JSON object with EXACTLY these fields:
{
  "title": string — worksheet title including the topic,
  "learningGoals": string[] — 2-4 goals this worksheet develops,
  "instructions": string — student-facing instructions at the top of the sheet,
  "sections": array of section objects:
  {
    "heading": string — e.g. "Part A: Warm-up questions",
    "questions": string[] — 3-6 numbered-ready question strings
  },
  "answerKey": string[] — the correct answer for EVERY question, in the same order as the sections' questions,
  "teacherNotes": string — how to run and mark the worksheet
}`;

const MINI_EXAMPLE = `Worked mini-example (shape only — adapt fully to the inputs, never copy it literally):
{"title":"Number Systems Practice Worksheet","learningGoals":["Convert between decimal and binary","Convert between decimal and hexadecimal"],"instructions":"Write your answers in the space after each question. Show your working.","sections":[{"heading":"Part A: Decimal to binary","questions":["Convert 23 to binary.","Convert 64 to binary."]},{"heading":"Part B: Binary to decimal","questions":["Convert 10101 to decimal."]}],"answerKey":["10111","1000000","21"],"teacherNotes":"Part A is 1 mark each; Part B requires showing place-value expansion. Common error: forgetting the 0 placeholder."}`;

export function buildWorksheetPrompt(input: WorksheetPromptInput): string {
  return [
    ROLE_FRAME,
    "",
    "TASK: Generate a printable practice worksheet for the following parameters.",
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
