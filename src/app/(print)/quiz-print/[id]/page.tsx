import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { PrintableQuiz } from "@/components/quiz-generator/PrintableQuiz";

export const metadata: Metadata = {
  title: "Print Quiz",
};

export const dynamic = "force-dynamic";

/**
 * Printable paper view (spec 20.4). Sits OUTSIDE the workspace layout on
 * purpose — no sidebar or banner on the printed page — but still guards the
 * session itself and only opens APPROVED quizzes (unreviewed AI drafts are
 * never printed for a class).
 */
export default async function QuizPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["TEACHER", "ADMIN"]);
  const { id } = await params;
  const store = await getStore();
  const quiz = await store.getQuiz(id);
  if (!quiz || quiz.status !== "approved") notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 print:max-w-none print:p-0">
      <PrintableQuiz
        title={quiz.content.title}
        meta={`${quiz.classLevel} · ${quiz.topic} · ${quiz.content.questions.length} questions · difficulty: ${quiz.content.difficulty}`}
        content={quiz.content}
        backHref={`/quiz-generator?id=${quiz.id}`}
      />
    </main>
  );
}
