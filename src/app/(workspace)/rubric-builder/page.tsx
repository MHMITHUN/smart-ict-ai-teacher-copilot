import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { getStore } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/guards";
import { canApproveArtifact } from "@/lib/artifacts/review-access";
import { getProviderInfo } from "@/lib/ai/provider";
import {
  approveRubricAction,
  deleteRubricDraftAction,
} from "@/app/actions/rubrics";
import { DraftEditorShell } from "@/components/artifacts/DraftEditorShell";
import { ReviewBadge } from "@/components/artifacts/ReviewBadge";
import { RubricEditor } from "@/components/rubrics/RubricEditor";
import { RubricGeneratorForm } from "@/components/rubrics/RubricGeneratorForm";
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
  title: "Rubric Builder",
};

export const dynamic = "force-dynamic";

/**
 * Rubric Builder (spec 20.8): generate a criteria table (criterion x
 * Excellent/Good/Developing/Beginning x points), edit every cell, watch
 * the auto total, then approve.
 */
export default async function RubricBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const store = await getStore();
  const rubric = id ? await store.getRubric(id) : null;
  const viewer = await getSessionUser();
  const canApprove = Boolean(viewer && rubric && canApproveArtifact(viewer, rubric));
  const recent = await store.listRubrics();
  const providerInfo = getProviderInfo();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-fg">Rubric Builder</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Name the assignment and pick how many criteria you judge it on; the
          AI drafts a four-level rubric (Excellent / Good / Developing /
          Beginning) with points that sum to your total. Rewrite any cell
          before approving — the total updates as you edit.
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="size-4 text-accent" aria-hidden="true" />
                New rubric draft
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RubricGeneratorForm mockMode={providerInfo.mockMode} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent rubrics</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-4">
              {recent.length === 0 ? (
                <p className="text-sm text-muted">No rubrics yet.</p>
              ) : (
                recent.slice(0, 6).map((item) => (
                  <a
                    key={item.id}
                    href={`/rubrics?id=${item.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-fg">
                        {item.content.title}
                      </span>
                      <span className="text-xs text-muted">
                        {item.content.criteria.length} criteria ·{" "}
                        {item.content.totalPoints} points · {formatDate(item.createdAt)}
                      </span>
                    </span>
                    <ReviewBadge status={item.status} />
                  </a>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {rubric ? (
          <div className="flex flex-col gap-5">
            <DraftEditorShell
              title={rubric.content.title}
              artifactId={rubric.id}
              provider={rubric.provider}
              model={rubric.model}
              status={rubric.status}
              approvedAt={rubric.approvedAt}
              approveAction={approveRubricAction}
              approveLabel="Approve rubric"
              canApprove={canApprove}
            >
              <RubricEditor artifactId={rubric.id} initialContent={rubric.content} />
            </DraftEditorShell>

            {rubric.status === "draft" && (
              <Card>
                <CardContent className="flex flex-col gap-3 p-6">
                  <p className="text-sm text-muted">
                    Approved rubrics become your marking reference in the
                    Content Library. Only drafts are deletable — approvals are
                    the review workflow&apos;s paper trail.
                  </p>
                  <form action={deleteRubricDraftAction} className="w-fit">
                    <input type="hidden" name="id" value={rubric.id} />
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
            icon={ClipboardCheck}
            title={id ? "Rubric not found" : "No draft open yet"}
            description={
              id
                ? "This rubric does not exist — it may have been deleted. Generate a new draft or reopen one from Recent rubrics."
                : "Generate a draft to review, edit and approve it here. Criteria count 3-6 keeps marking fast while still separating excellence from effort."
            }
          />
        )}
      </div>
    </div>
  );
}
