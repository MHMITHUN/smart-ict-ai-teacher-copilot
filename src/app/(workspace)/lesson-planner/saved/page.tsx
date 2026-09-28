import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Copy, ExternalLink, FolderOpen, Trash2 } from "lucide-react";
import { getStore } from "@/lib/db";
import type { ReviewStatus } from "@/lib/db/types";
import {
  deleteLessonPlanAction,
  duplicateLessonPlanAction,
} from "@/app/actions/lessons";
import { ReviewBadge } from "@/components/artifacts/ReviewBadge";
import {
  Button,
  ConfirmSubmitButton,
  EmptyState,
  Table,
  TableBody,
  TD,
  TH,
  TableHead,
  TableRow,
  TableEmpty,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Saved Lessons",
};

export const dynamic = "force-dynamic";

/**
 * Saved lesson plans (spec 20.3): filter by topic/status, open one in the
 * editor, duplicate it, or delete a DRAFT (approved plans are kept — that is
 * the review workflow's paper trail).
 */
export default async function SavedLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; status?: string }>;
}) {
  const { topic = "", status = "" } = await searchParams;
  const store = await getStore();
  const lessons = await store.listLessonPlans({
    topic: topic || undefined,
    status: status === "draft" || status === "approved" ? (status as ReviewStatus) : undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight text-fg">Saved lessons</h1>
          <p className="text-sm text-muted">
            {lessons.length} lesson plan{lessons.length === 1 ? "" : "s"}
            {topic ? ` matching “${topic}”` : ""}
            {status ? ` · ${status}` : ""}.
          </p>
        </div>
        <Link
          href="/lesson-planner"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to generator
        </Link>
      </div>

      {/* Filters (GET form — the table re-renders from the URL). Plain
          markup: this page is a server component, so no client render-props. */}
      <form
        method="get"
        className="grid items-end gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[1fr_180px_auto]"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-topic" className="sr-only">
            Filter by topic
          </label>
          <input
            id="filter-topic"
            name="topic"
            defaultValue={topic}
            placeholder="Search topics (e.g. Network)"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-status" className="sr-only">
            Status
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={status}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
          </select>
        </div>
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
      </form>

      {lessons.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No lesson plans match"
          description="Adjust the filters, or generate a new lesson plan from the planner."
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TH>Title</TH>
              <TH>Topic</TH>
              <TH>Level</TH>
              <TH>Duration</TH>
              <TH>Status</TH>
              <TH>Updated</TH>
              <TH className="text-right">Actions</TH>
            </TableRow>
          </TableHead>
          <TableBody>
            {lessons.map((lesson) => (
              <TableRow key={lesson.id}>
                <TD className="max-w-64">
                  <Link
                    href={`/lesson-planner?id=${lesson.id}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {lesson.title}
                  </Link>
                </TD>
                <TD className="text-muted">{lesson.topic}</TD>
                <TD className="text-muted">{lesson.classLevel}</TD>
                <TD className="text-muted">{lesson.durationMin} min</TD>
                <TD>
                  <ReviewBadge status={lesson.status} />
                </TD>
                <TD className="whitespace-nowrap text-muted">
                  {formatDate(lesson.updatedAt)}
                </TD>
                <TD>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Link
                      href={`/lesson-planner?id=${lesson.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
                    >
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      Open
                    </Link>
                    <form action={duplicateLessonPlanAction}>
                      <input type="hidden" name="id" value={lesson.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        title="Duplicate as a new draft"
                      >
                        <Copy className="size-3.5" aria-hidden="true" />
                        Duplicate
                      </Button>
                    </form>
                    {lesson.status === "draft" && (
                      <form action={deleteLessonPlanAction}>
                        <input type="hidden" name="id" value={lesson.id} />
                        <ConfirmSubmitButton
                          label="Delete"
                          pendingLabel="Deleting..."
                          variant="ghost"
                          className="text-muted hover:text-danger"
                          confirm={`Delete the draft “${lesson.title}”? This cannot be undone.`}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </ConfirmSubmitButton>
                      </form>
                    )}
                  </div>
                </TD>
              </TableRow>
            ))}
            {lessons.length === 0 && (
              <TableEmpty colSpan={7}>No lesson plans match the filters.</TableEmpty>
            )}
          </TableBody>
        </Table>
      )}

      <p className="text-xs text-muted">
        Approved lesson plans are never deleted — the approval record is the
        audit trail for what you taught. Only drafts can be removed.
      </p>
    </div>
  );
}
