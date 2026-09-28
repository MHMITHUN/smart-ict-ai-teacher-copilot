import type { Metadata } from "next";
import Link from "next/link";
import { Copy, FileText, Printer } from "lucide-react";
import { getStore } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/guards";
import { canApproveArtifact } from "@/lib/artifacts/review-access";
import { getProviderInfo } from "@/lib/ai/provider";
import {
  approveWorksheetAction,
  deleteWorksheetDraftAction,
} from "@/app/actions/worksheets";
import { DraftEditorShell } from "@/components/artifacts/DraftEditorShell";
import { ReviewBadge } from "@/components/artifacts/ReviewBadge";
import { WorksheetEditor } from "@/components/worksheets/WorksheetEditor";
import { WorksheetGeneratorForm } from "@/components/worksheets/WorksheetGeneratorForm";
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
  title: "Worksheets",
};

export const dynamic = "force-dynamic";

/**
 * Worksheet Generator (spec 20.7): two-pane generator with the full review
 * workflow. Approved worksheets unlock the printable paper view (answer
 * key on its own page section) and the copy-to-document plain-text view.
 */
export default async function WorksheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const store = await getStore();
  const worksheet = id ? await store.getWorksheet(id) : null;
  const viewer = await getSessionUser();
  const canApprove = Boolean(
    viewer && worksheet && canApproveArtifact(viewer, worksheet),
  );
  const recent = await store.listWorksheets();
  const providerInfo = getProviderInfo();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-fg">Worksheet Generator</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Describe the practice you want on the left; the AI drafts a complete
          worksheet on the right — sections, answer key and marking notes.
          Edit every part, approve it, then print a paper copy or copy the
          text into your own document.
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-accent" aria-hidden="true" />
                New worksheet draft
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorksheetGeneratorForm mockMode={providerInfo.mockMode} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent worksheets</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-4">
              {recent.length === 0 ? (
                <p className="text-sm text-muted">No worksheets yet.</p>
              ) : (
                recent.slice(0, 6).map((item) => (
                  <Link
                    key={item.id}
                    href={`/worksheets?id=${item.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-fg">
                        {item.content.title}
                      </span>
                      <span className="text-xs text-muted">
                        {item.content.sections.length} sections ·{" "}
                        {item.content.sections.reduce(
                          (sum, section) => sum + section.questions.length,
                          0,
                        )}{" "}
                        questions · {formatDate(item.createdAt)}
                      </span>
                    </span>
                    <ReviewBadge status={item.status} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {worksheet ? (
          <div className="flex flex-col gap-5">
            <DraftEditorShell
              title={worksheet.content.title}
              artifactId={worksheet.id}
              provider={worksheet.provider}
              model={worksheet.model}
              status={worksheet.status}
              approvedAt={worksheet.approvedAt}
              approveAction={approveWorksheetAction}
              approveLabel="Approve worksheet"
              canApprove={canApprove}
            >
              <WorksheetEditor artifactId={worksheet.id} initialContent={worksheet.content} />
            </DraftEditorShell>

            {worksheet.status === "approved" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Approved worksheet actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-3 pt-4">
                  <Link
                    href={`/worksheet-print/${worksheet.id}`}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
                  >
                    <Printer className="size-4" aria-hidden="true" />
                    Printable page
                  </Link>
                  <Link
                    href={`/worksheet-copy/${worksheet.id}`}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
                  >
                    <Copy className="size-4" aria-hidden="true" />
                    Copy-to-document view
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col gap-3 p-6">
                  <p className="text-sm text-muted">
                    Printing and the copy-to-document view unlock after you
                    approve this worksheet — unreviewed AI drafts are never
                    handed to a class (spec 20.10).
                  </p>
                  <form action={deleteWorksheetDraftAction} className="w-fit">
                    <input type="hidden" name="id" value={worksheet.id} />
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
            icon={FileText}
            title={id ? "Worksheet not found" : "No draft open yet"}
            description={
              id
                ? "This worksheet does not exist — it may have been deleted. Generate a new draft or reopen one from Recent worksheets."
                : "Generate a draft to review, edit and approve it here. Each draft comes with sections, an answer key and marking notes you can rewrite."
            }
          />
        )}
      </div>
    </div>
  );
}
