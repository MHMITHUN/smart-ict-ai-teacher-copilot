import { NextResponse, type NextRequest } from "next/server";
import { apiGuard } from "@/lib/auth/guards";
import { getStore } from "@/lib/db";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Quiz export (spec 20.4): ?format=json (machine-readable) or ?format=txt
 * (plain-text copy with an answer key). Approved quizzes only — unreviewed
 * AI drafts are never exported.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = await apiGuard(req, ["TEACHER", "ADMIN"]);
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const store = await getStore();
  const quiz = await store.getQuiz(id);
  if (!quiz || quiz.status !== "approved") {
    return NextResponse.json(
      { error: "Quiz not found, or it is not approved yet." },
      { status: 404 },
    );
  }

  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const filename = `${slugify(quiz.content.title) || "quiz"}`;

  if (format === "txt") {
    const lines: string[] = [
      quiz.content.title,
      `${quiz.classLevel} · ${quiz.topic} · ${quiz.questionCount} questions · difficulty: ${quiz.content.difficulty}`,
      "",
      quiz.content.instructions,
      "",
    ];
    quiz.content.questions.forEach((question, index) => {
      lines.push(`${index + 1}. ${question.prompt}`);
      if (question.type === "mcq" && question.options) {
        question.options.forEach((option, optionIndex) => {
          lines.push(`   ${String.fromCharCode(65 + optionIndex)}) ${option}`);
        });
      }
      lines.push("");
    });
    lines.push("ANSWER KEY", "----------");
    quiz.content.questions.forEach((question, index) => {
      lines.push(`${index + 1}. ${question.answer} — ${question.explanation}`);
    });
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.txt"`,
      },
    });
  }

  return new NextResponse(
    JSON.stringify(
      {
        id: quiz.id,
        topic: quiz.topic,
        classLevel: quiz.classLevel,
        difficulty: quiz.content.difficulty,
        language: quiz.language,
        title: quiz.content.title,
        instructions: quiz.content.instructions,
        learningObjective: quiz.content.learningObjective,
        questions: quiz.content.questions,
        approvedAt: quiz.approvedAt,
        approvedBy: quiz.approvedBy,
        provider: quiz.provider,
        model: quiz.model,
      },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.json"`,
      },
    },
  );
}
