import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, FolderOpen } from "lucide-react";
import { getStore } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/guards";
import { canApproveArtifact } from "@/lib/artifacts/review-access";
import { getProviderInfo } from "@/lib/ai/provider";
import { approveLessonPlanAction } from "@/app/actions/lessons";
import { DraftEditorShell } from "@/components/artifacts/DraftEditorShell";
import { LessonEditor } from "@/components/lesson-planner/LessonEditor";
import { LessonGeneratorForm } from "@/components/lesson-planner/LessonGeneratorForm";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Lesson Planner",
};

export const dynamic = "force-dynamic";

/**
 * Lesson Planner (spec 20.3): two-pane generator. Left: the teacher's
 * inputs; right: the generated draft as a fully editable structured editor
 * inside the review shell (draft until a teacher approves it).
 */
export default async function LessonPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const store = await getStore();
  const lesson = id ? await store.getLessonPlan(id) : null;
  const viewer = await getSessionUser();
  const canApprove = Boolean(viewer && lesson && canApproveArtifact(viewer, lesson));
  const providerInfo = getProviderInfo();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-fg">Lesson Planner</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            Describe the lesson on the left; the AI drafts a complete plan on
            the right. Edit every field, then approve it for your class.
          </p>
        </div>
        <Link
          href="/lesson-planner/saved"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <FolderOpen className="size-4" aria-hidden="true" />
          Saved lessons
        </Link>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        {/* Left pane: generator form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="size-4 text-accent" aria-hidden="true" />
              New lesson draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LessonGeneratorForm mockMode={providerInfo.mockMode} />
          </CardContent>
        </Card>

        {/* Right pane: the draft editor */}
        {lesson ? (
          <DraftEditorShell
            title={`${lesson.content.title} · ${formatDate(lesson.createdAt)}`}
            artifactId={lesson.id}
            provider={lesson.provider}
            model={lesson.model}
            status={lesson.status}
            approvedAt={lesson.approvedAt}
            approveAction={approveLessonPlanAction}
            approveLabel="Approve lesson plan"
            canApprove={canApprove}
          >
            <LessonEditor artifactId={lesson.id} initialContent={lesson.content} />
          </DraftEditorShell>
        ) : (
          <EmptyState
            icon={BookOpen}
            title={id ? "Lesson plan not found" : "No draft open yet"}
            description={
              id
                ? "This lesson plan does not exist — it may have been deleted. Generate a new draft or open one from Saved lessons."
                : "Generate a draft to review and edit it here. Every field stays editable until you approve the plan."
            }
          />
        )}
      </div>
    </div>
  );
}
