import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { QuestionForm } from "@/components/question-bank/QuestionForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "New Question",
};

export const dynamic = "force-dynamic";

/** Manual question creation (spec 20.5): full field set, zod-validated. */
export default async function NewQuestionPage() {
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
        <h1 className="text-xl font-semibold tracking-tight text-fg">New question</h1>
        <p className="text-sm text-muted">
          Hand-written questions start as drafts, exactly like AI-generated
          ones — publish when ready.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Question details</CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionForm />
        </CardContent>
      </Card>
    </div>
  );
}
