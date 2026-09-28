import type { WorksheetSpec } from "@/lib/ai/schemas";

/**
 * Worksheet export surfaces (spec 20.7): the print model (numbered
 * questions grouped by section, answer key separate) and the
 * copy-to-document plain-text rendering. Pure functions — unit-tested for
 * shape so both the printable page and the copy view agree.
 */

export interface PrintableWorksheetQuestion {
  /** Continuous 1-based numbering across all sections. */
  number: number;
  question: string;
}

export interface PrintableWorksheetSection {
  heading: string;
  questions: PrintableWorksheetQuestion[];
}

export interface PrintableWorksheetModel {
  title: string;
  classLevel: string;
  topic: string;
  learningGoals: string[];
  instructions: string;
  sections: PrintableWorksheetSection[];
  answerKey: string[];
  teacherNotes: string;
  /** Total question count (the answer key should match it). */
  questionCount: number;
}

/** Flatten a worksheet into a print-ready model with continuous numbering. */
export function buildPrintableWorksheet(worksheet: {
  topic: string;
  classLevel: string;
  content: WorksheetSpec;
}): PrintableWorksheetModel {
  let number = 0;
  const sections = worksheet.content.sections.map((section) => ({
    heading: section.heading,
    questions: section.questions.map((question) => {
      number += 1;
      return { number, question };
    }),
  }));
  return {
    title: worksheet.content.title,
    classLevel: worksheet.classLevel,
    topic: worksheet.topic,
    learningGoals: worksheet.content.learningGoals,
    instructions: worksheet.content.instructions,
    sections,
    answerKey: worksheet.content.answerKey,
    teacherNotes: worksheet.content.teacherNotes,
    questionCount: number,
  };
}

/**
 * Copy-to-document plain text (spec 20.7): select-all friendly, one
 * question per line, answer key and teacher notes after a clear divider so
 * pasting into Word/Google Docs keeps the structure.
 */
export function worksheetPlainText(worksheet: {
  topic: string;
  classLevel: string;
  content: WorksheetSpec;
}): string {
  const model = buildPrintableWorksheet(worksheet);
  const lines: string[] = [
    model.title,
    `${model.classLevel} — ${model.topic}`,
    "",
    "Learning goals:",
    ...model.learningGoals.map((goal) => `- ${goal}`),
    "",
    `Instructions: ${model.instructions}`,
    "",
  ];

  for (const section of model.sections) {
    lines.push(section.heading);
    for (const question of section.questions) {
      lines.push(`${question.number}. ${question.question}`);
    }
    lines.push("");
  }

  lines.push("Answer key", "----------");
  model.answerKey.forEach((answer, index) => {
    lines.push(`${index + 1}. ${answer}`);
  });
  lines.push("", `Teacher notes: ${model.teacherNotes}`);

  return lines.join("\n");
}
