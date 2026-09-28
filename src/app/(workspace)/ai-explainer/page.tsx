import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
import { getStore } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/guards";
import { canApproveArtifact } from "@/lib/artifacts/review-access";
import { getProviderInfo } from "@/lib/ai/provider";
import {
  approveExplanationAction,
  deleteExplanationDraftAction,
} from "@/app/actions/explanations";
import { DraftEditorShell } from "@/components/artifacts/DraftEditorShell";
import { ReviewBadge } from "@/components/artifacts/ReviewBadge";
import { ExplainerForm } from "@/components/explainer/ExplainerForm";
import { ExplanationEditor } from "@/components/explainer/ExplanationEditor";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "AI Explainer",
};

export const dynamic = "force-dynamic";

/**
 * AI Explainer (spec 20.6): teacher-mode explanations of student
 * confusions. Educational integrity is structural here: the prompt forbids
 * references (none are ever rendered), uncertainty surfaces in a prominent
 * uncertaintyNote, and the draft only becomes classroom-ready when a
 * teacher approves it (the "teacher-reviewed" state).
 */
export default async function AiExplainerPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const store = await getStore();
  const explanation = id ? await store.getExplanation(id) : null;
  const viewer = await getSessionUser();
  const canApprove = Boolean(
    viewer && explanation && canApproveArtifact(viewer, explanation),
  );
  const recent = await store.listExplanations();
  const providerInfo = getProviderInfo();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-fg">AI Explainer</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Paste a student&apos;s question and what confused them. The AI drafts
          a simple explanation, an analogy, a step-by-step breakdown, the
          common mistake and a practice question — for YOUR review first. When
          the model is unsure, it says so in an uncertainty note instead of
          inventing facts; references are never generated.
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircleQuestion className="size-4 text-accent" aria-hidden="true" />
                Explain a confusion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ExplainerForm mockMode={providerInfo.mockMode} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent explanations</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-4">
              {recent.length === 0 ? (
                <p className="text-sm text-muted">No explanations yet.</p>
              ) : (
                recent.slice(0, 6).map((item) => (
                  <Link
                    key={item.id}
                    href={`/ai-explainer?id=${item.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-fg">{item.question}</span>
                      <span className="text-xs text-muted">
                        {item.topic} · {formatDate(item.createdAt)}
                      </span>
                    </span>
                    <ReviewBadge status={item.status} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {explanation ? (
          <div className="flex flex-col gap-5">
            <DraftEditorShell
              title={explanation.question}
              artifactId={explanation.id}
              provider={explanation.provider}
              model={explanation.model}
              status={explanation.status}
              approvedAt={explanation.approvedAt}
              approveAction={approveExplanationAction}
              approveLabel="Approve as teacher-reviewed"
              canApprove={canApprove}
            >
              {explanation.confusion && (
                <p className="mb-4 rounded-lg border border-border bg-surface-2/60 px-4 py-3 text-sm text-muted">
                  <span className="font-medium text-fg">What confused them: </span>
                  {explanation.confusion}
                </p>
              )}
              <ExplanationEditor
                artifactId={explanation.id}
                initialContent={explanation.content}
              />
            </DraftEditorShell>

            {explanation.status === "draft" && (
              <Card>
                <CardContent className="flex flex-col gap-3 p-6">
                  <p className="text-sm text-muted">
                    Approving records this explanation as teacher-reviewed
                    (your account + time). Until then it stays a private draft
                    — share it with a class only after you have verified it.
                  </p>
                  <form action={deleteExplanationDraftAction} className="w-fit">
                    <input type="hidden" name="id" value={explanation.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="text-muted hover:text-danger"
                    >
                      Delete this draft
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <EmptyState
            icon={MessageCircleQuestion}
            title={id ? "Explanation not found" : "No draft open yet"}
            description={
              id
                ? "This explanation does not exist — it may have been deleted. Generate a new draft or reopen one from Recent explanations."
                : "Explain a confusion to see the draft here: simple explanation, analogy, steps, the common mistake and a practice question — every field editable."
            }
          />
        )}
      </div>
    </div>
  );
}
