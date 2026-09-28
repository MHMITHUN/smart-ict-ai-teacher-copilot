import type { Metadata } from "next";
import Link from "next/link";
import {
  Download,
  FileText,
  ListChecks,
  Printer,
  Send,
} from "lucide-react";
import { getStore } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/guards";
import { canApproveArtifact } from "@/lib/artifacts/review-access";
import { getProviderInfo } from "@/lib/ai/provider";
import {
  approveQuizAction,
  deleteQuizDraftAction,
  sendQuizToBankAction,
} from "@/app/actions/quizzes";
import { DraftEditorShell } from "@/components/artifacts/DraftEditorShell";
import { ReviewBadge } from "@/components/artifacts/ReviewBadge";
import { QuizEditor } from "@/components/quiz-generator/QuizEditor";
import { QuizGeneratorForm } from "@/components/quiz-generator/QuizGeneratorForm";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Quiz Generator",
};

export const dynamic = "force-dynamic";

/**
 * Quiz Generator (spec 20.4): two-pane generator with the full review
 * workflow. Approved quizzes gain: send-to-bank (deduped), JSON/text export
 * and a printable paper view with an answer-key toggle.
 */
export default async function QuizGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; sent?: string; skipped?: string }>;
}) {
  const { id, sent, skipped } = await searchParams;
  const store = await getStore();
  const quiz = id ? await store.getQuiz(id) : null;
  const viewer = await getSessionUser();
  const canApprove = Boolean(viewer && quiz && canApproveArtifact(viewer, quiz));
  const recent = await store.listQuizzes();
  const providerInfo = getProviderInfo();
  const sentCount = sent ? Number.parseInt(sent, 10) : null;
  const skippedCount = skipped ? Number.parseInt(skipped, 10) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-fg">Quiz Generator</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Set the parameters on the left; the AI drafts a complete quiz on the
          right. Edit any question, approve it, then send the questions to your
          bank or print a paper copy.
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <div className="flex flex-col gap-6">
          {/* Left pane: generator form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="size-4 text-accent" aria-hidden="true" />
                New quiz draft
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuizGeneratorForm mockMode={providerInfo.mockMode} />
            </CardContent>
          </Card>

          {/* Recent quizzes (reopen any draft/approved quiz). */}
          <Card>
            <CardHeader>
              <CardTitle>Recent quizzes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-4">
              {recent.length === 0 ? (
                <p className="text-sm text-muted">No quizzes yet.</p>
              ) : (
                recent.slice(0, 6).map((item) => (
                  <Link
                    key={item.id}
                    href={`/quiz-generator?id=${item.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-fg">
                        {item.content.title}
                      </span>
                      <span className="text-xs text-muted">
                        {item.questionCount} questions · {formatDate(item.createdAt)}
                      </span>
                    </span>
                    <ReviewBadge status={item.status} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right pane: the draft editor */}
        {quiz ? (
          <div className="flex flex-col gap-5">
            {sentCount !== null && (
              <Alert tone="success" title="Questions sent to the bank">
                {sentCount} question{sentCount === 1 ? "" : "s"} inserted
                {skippedCount
                  ? `, ${skippedCount} skipped (already in the bank)`
                  : ""}
                . Review them on the Question Bank page — new questions start
                as drafts there too.
              </Alert>
            )}

            <DraftEditorShell
              title={quiz.content.title}
              artifactId={quiz.id}
              provider={quiz.provider}
              model={quiz.model}
              status={quiz.status}
              approvedAt={quiz.approvedAt}
              approveAction={approveQuizAction}
              approveLabel="Approve quiz"
              canApprove={canApprove}
            >
              <QuizEditor artifactId={quiz.id} initialContent={quiz.content} />
            </DraftEditorShell>

            {quiz.status === "approved" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Approved quiz actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-3 pt-4">
                  <form action={sendQuizToBankAction}>
                    <input type="hidden" name="id" value={quiz.id} />
                    <Button type="submit">
                      <Send className="size-4" aria-hidden="true" />
                      Send questions to Question Bank
                    </Button>
                  </form>
                  <a
                    href={`/api/quizzes/${quiz.id}/export?format=json`}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
                  >
                    <Download className="size-4" aria-hidden="true" />
                    Export JSON
                  </a>
                  <a
                    href={`/api/quizzes/${quiz.id}/export?format=txt`}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
                  >
                    <FileText className="size-4" aria-hidden="true" />
                    Export text
                  </a>
                  <Link
                    href={`/quiz-print/${quiz.id}`}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
                  >
                    <Printer className="size-4" aria-hidden="true" />
                    Print view
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col gap-3 p-6">
                  <p className="text-sm text-muted">
                    Export, printing and send-to-bank unlock after you approve
                    this quiz — the review workflow (spec 20.10) keeps
                    unreviewed AI output out of your question bank.
                  </p>
                  <form action={deleteQuizDraftAction} className="w-fit">
                    <input type="hidden" name="id" value={quiz.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-muted hover:text-danger">
                      Delete this draft
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <EmptyState
            icon={ListChecks}
            title={id ? "Quiz not found" : "No draft open yet"}
            description={
              id
                ? "This quiz does not exist — it may have been deleted. Generate a new draft or reopen one from Recent quizzes."
                : "Generate a draft to review, edit and approve it here. MCQ, true/false, short answer, fill-in-the-blank and viva questions are all supported."
            }
          />
        )}
      </div>
    </div>
  );
}
