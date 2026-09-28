import {
  ROLE_FRAME,
  JSON_CONTRACT,
  INTEGRITY_RULES,
  formatInputBlock,
} from "./shared";

/** Teacher inputs for the AI explainer (spec 20.6). */
export interface ExplainerPromptInput {
  question: string;
  /** The student's specific confusion, if captured. */
  confusion?: string;
  topic: string;
  /** "student" = simple student-facing language, "teacher" = teacher-facing. */
  audience?: "student" | "teacher";
}

const FIELD_CONTRACT = `Return a JSON object with EXACTLY these fields:
{
  "simpleExplanation": string — 2-4 sentences a struggling student can follow,
  "analogy": string — one everyday-life analogy (Bangladeshi context preferred),
  "stepByStep": string[] — the idea broken into ordered steps, one string per step,
  "commonMistake": string — the mistake students typically make with this exact question,
  "practiceQuestion": {
    "question": string — one practice question testing the same idea,
    "answer": string — its answer
  },
  "uncertaintyNote": string — OPTIONAL: include ONLY if you are not fully certain about the answer; never invent facts to fill it
}`;

const MINI_EXAMPLE = `Worked mini-example (shape only — adapt fully to the inputs, never copy it literally):
{"simpleExplanation":"Binary uses only 0 and 1 because a computer's memory is made of switches that are either off (0) or on (1). Every number you write in decimal can be rebuilt from these switches.","analogy":"Think of a row of light switches: each switch is worth double the one on its right, and you choose on or off for each to build the total you want.","stepByStep":["Write the place values 16, 8, 4, 2, 1.","Find the biggest place value that fits into your number and put 1 there.","Subtract it and repeat with what is left.","Every place value you did not use gets 0."],"commonMistake":"Students write place values left to right starting at 1, so the number comes out reversed.","practiceQuestion":{"question":"Convert decimal 13 to binary.","answer":"1101"},"uncertaintyNote":"Skip this field when certain."}`;

/** Educational integrity (spec 20.6): explanations carry NO references. */
const NO_REFERENCES_RULE = `Reference rule (educational integrity):
- Do not include references, citations, textbook names, page numbers or URLs in ANY field. This explanation is verified by the teacher, not sourced by you — fabricating a reference is worse than giving none.`;

export function buildExplainerPrompt(input: ExplainerPromptInput): string {
  return [
    ROLE_FRAME,
    "",
    "TASK: Explain the following question so the stated audience fully understands it.",
    "",
    "TEACHER INPUTS:",
    formatInputBlock(input),
    "",
    FIELD_CONTRACT,
    "",
    MINI_EXAMPLE,
    "",
    NO_REFERENCES_RULE,
    "",
    JSON_CONTRACT,
    INTEGRITY_RULES,
  ].join("\n");
}
