import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiGuard } from "@/lib/auth/guards";
import { getStore } from "@/lib/db";
import type { Question } from "@/lib/db/types";
import { QuestionTypeSchema, DifficultySchema } from "@/lib/ai/schemas";

export const dynamic = "force-dynamic";

/**
 * Question Bank export (spec 20.5): PUBLISHED questions only — drafts and
 * archived items never leave the bank. ?format=json or ?format=csv, with the
 * same filters the listing page uses (topic, difficulty, type, search).
 */
const FilterSchema = z.object({
  format: z.enum(["json", "csv"]).default("json"),
  topic: z.string().trim().max(120).optional(),
  difficulty: DifficultySchema.optional(),
  type: QuestionTypeSchema.optional(),
  search: z.string().trim().max(200).optional(),
});

const CSV_COLUMNS = [
  "question",
  "type",
  "difficulty",
  "topic",
  "tags",
  "learningObjective",
  "options",
  "answer",
  "explanation",
] as const;

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function questionToRow(question: Question): string[] {
  return [
    question.question,
    question.type,
    question.difficulty,
    question.topic,
    question.tags.join("; "),
    question.learningObjective,
    (question.options ?? []).join(" | "),
    question.answer,
    question.explanation,
  ];
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = await apiGuard(req, ["TEACHER", "ADMIN"]);
  if ("response" in guard) return guard.response;

  const raw = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = FilterSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid export filters." }, { status: 400 });
  }

  const store = await getStore();
  // Published only — that is the export rule.
  const page = await store.listQuestions({
    status: "published",
    topic: parsed.data.topic,
    difficulty: parsed.data.difficulty,
    type: parsed.data.type,
    search: parsed.data.search,
    perPage: 100,
  });
  let questions = page.items;
  if (page.total > page.perPage) {
    // Pull every published page (bounded by total, max 100/page).
    const all: Question[] = [...questions];
    for (let p = 2; p <= page.totalPages && p <= 50; p += 1) {
      const next = await store.listQuestions({
        status: "published",
        topic: parsed.data.topic,
        difficulty: parsed.data.difficulty,
        type: parsed.data.type,
        search: parsed.data.search,
        perPage: 100,
        page: p,
      });
      all.push(...next.items);
    }
    questions = all;
  }

  if (questions.length === 0) {
    return NextResponse.json(
      { error: "No published questions match — publish questions before exporting." },
      { status: 404 },
    );
  }

  const suffix = parsed.data.topic ? `-${parsed.data.topic.toLowerCase().replace(/\s+/g, "-")}` : "";

  if (parsed.data.format === "csv") {
    const rows = [
      CSV_COLUMNS.join(","),
      ...questions.map((question) => questionToRow(question).map(csvCell).join(",")),
    ];
    // UTF-8 BOM so Excel renders Bangla/unicode correctly.
    return new NextResponse(`﻿${rows.join("\r\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="question-bank${suffix}.csv"`,
      },
    });
  }

  return new NextResponse(JSON.stringify(questions, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="question-bank${suffix}.json"`,
    },
  });
}
