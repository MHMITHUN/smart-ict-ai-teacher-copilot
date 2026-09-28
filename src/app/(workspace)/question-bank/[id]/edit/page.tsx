import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getStore } from "@/lib/db";
import { QuestionForm } from "@/components/question-bank/QuestionForm";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Edit Question",
};

export const dynamic = "force-dynamic";

/** Edit any question field (spec 20.5); status/provenance are managed on the bank page. */
export default async function EditQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await getStore();
  const question = await store.getQuestion(id);
  if (!question) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/question-bank"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-fg hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Question Bank
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-fg">Edit question</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge tone={question.source === "ai" ? "accent" : "neutral"}>
            {question.source === "ai" ? `AI (${question.provider ?? "ai"})` : "Manual"}
          </Badge>
          <Badge tone={question.status === "published" ? "success" : question.status === "archived" ? "neutral" : "warning"}>
            {question.status}
          </Badge>
          <span>created {formatDate(question.createdAt)}</span>
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Question details</CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionForm initial={question} />
        </CardContent>
      </Card>
    </div>
  );
}
