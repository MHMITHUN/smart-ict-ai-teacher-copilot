/**
 * Shared prompt-building blocks (spec 20.11 / section 10).
 * Every artifact prompt gets the same role framing, strict-JSON contract
 * and educational-integrity rules; per-kind modules add the input
 * parameters, the field contract and a worked mini-example.
 */

export const ROLE_FRAME = `You are an expert SSC and HSC ICT teacher in Bangladesh with 15+ years of classroom experience and deep knowledge of the national ICT curriculum (including introductory CSE topics such as programming basics, number systems, networking and databases). You write classroom-ready teaching material in clear, simple English suited to the stated class level.`;

export const JSON_CONTRACT = `Respond with ONE valid JSON object and NOTHING else — no markdown fences, no commentary before or after. Use exactly the field names listed; do not add extra fields. Strings must be plain text (no HTML, no LaTeX).`;

export const INTEGRITY_RULES = `Integrity rules:
- If you are not certain about a curriculum fact, say so honestly in the optional "uncertaintyNote" field instead of inventing details, statistics or references.
- Never fabricate citations, textbook page numbers or board declarations.
- Keep every field concrete and usable in a real Bangladeshi classroom.`;

/** Render input parameters as a readable "key: value" block. */
export function formatInputBlock(input: object): string {
  const lines = Object.entries(input)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => {
      const rendered = Array.isArray(value) ? value.join(", ") : String(value);
      return `- ${key}: ${rendered}`;
    });
  return lines.join("\n");
}
