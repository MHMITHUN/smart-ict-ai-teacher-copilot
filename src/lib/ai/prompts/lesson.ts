import { ROLE_FRAME, JSON_CONTRACT, INTEGRITY_RULES, formatInputBlock } from "./shared";

/** Teacher inputs for lesson-plan generation (spec 20.3). */
export interface LessonPromptInput {
  topic: string;
  classLevel: string;
  durationMin: number;
  /** Optional focus objectives the teacher wants covered. */
  objectives?: string[];
  priorKnowledge?: string;
  assessmentStyle?: string;
}

const FIELD_CONTRACT = `Return a JSON object with EXACTLY these fields:
{
  "title": string — lesson title including the topic,
  "learningObjectives": string[] — 3-5 measurable objectives ("Students will be able to ..."),
  "warmUp": string — a 3-5 minute hook activity connected to the topic,
  "conceptExplanation": string — the core explanation, 150-300 words, simple classroom language with a small worked example if relevant,
  "activity": string — a hands-on classroom activity (pair/group/individual) on the topic,
  "practice": string — in-class practice tasks students do on their own,
  "assessment": string — how the teacher checks learning in this lesson (must match the requested assessment style),
  "homework": string — take-home task,
  "differentiation": {
    "support": string — adaptation for struggling students,
    "core": string — the standard path,
    "stretch": string — extension for advanced students
  }
}`;

const MINI_EXAMPLE = `Worked mini-example (shape only — adapt fully to the inputs, never copy it literally):
{"title":"Number Systems: Converting Decimal to Binary","learningObjectives":["Students will be able to convert decimal numbers to binary using repeated division","Students will be able to verify a conversion by expanding binary place values"],"warmUp":"Ask students how a computer stores the number 9 if it only knows 0 and 1, then collect guesses on the board.","conceptExplanation":"Explain place values in base 10, then base 2 ...","activity":"In pairs, students convert 5 decimal numbers to binary using the division-remainder method and check each other's work.","practice":"Individual: convert 45 and 156 to binary, then convert 1011 back to decimal.","assessment":"Oral questioning plus a 3-question exit ticket.","homework":"Convert the birth years of three family members to binary.","differentiation":{"support":"Provide a pre-labeled place-value table.","core":"Standard division-remainder method.","stretch":"Convert decimal fractions to binary."}}`;

export function buildLessonPrompt(input: LessonPromptInput): string {
  return [
    ROLE_FRAME,
    "",
    "TASK: Draft a complete lesson plan for the following lesson.",
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
