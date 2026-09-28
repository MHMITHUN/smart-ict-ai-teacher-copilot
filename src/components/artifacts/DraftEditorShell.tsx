import { Alert } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { AiProviderName, ReviewStatus } from "@/lib/db/types";
import { APPROVAL_DENIED_NOTE } from "@/lib/artifacts/review-access";
import { AIBadge } from "./AIBadge";
import { ReviewBadge } from "./ReviewBadge";
import { ApproveButton } from "./ApproveButton";

/**
 * DraftEditorShell — the reusable review frame for every AI artifact
 * (spec 20.10). Chunks B/C instantiate it per artifact type:
 *
 *   <DraftEditorShell
 *     title={doc.content.title}
 *     artifactId={doc.id}
 *     provider={doc.provider}
 *     model={doc.model}
 *     status={doc.status}
 *     approvedAt={doc.approvedAt}
 *     approveAction={approveLessonPlanAction}   // server action, reads FormData "id"
 *   >
 *     ... the editable fields (the teacher can edit EVERY field before approving)
 *   </DraftEditorShell>
 *
 * Contract for the approve server action (B/C write one per artifact type):
 *   - signature: (formData: FormData) => Promise<void>
 *   - read the artifact id from formData.get("id")
 *   - verify the session (requireRole) INSIDE the action
 *   - stamp approval with approvalFields(teacher.id) from "@/lib/db/types"
 *   - revalidatePath(...) or redirect as fits the page
 *
 * This component is server-safe (no "use client"); the pending state on
 * the approve button comes from the small ApproveButton client component.
 */

export interface DraftEditorShellProps {
  title: string;
  artifactId: string;
  provider: AiProviderName;
  model: string;
  status: ReviewStatus;
  /** ISO date of approval, shown when status is "approved". */
  approvedAt?: string;
  /** Server action invoked with FormData { id } — see the contract above. */
  approveAction: (formData: FormData) => Promise<void>;
  /** Defaults to "Approve as reviewed". */
  approveLabel?: string;
  /**
   * Review-access rule (spec 20.10): all teachers see and edit drafts, but
   * only the creator or an admin may approve. Defaults to true; pages pass
   * canApproveArtifact(user, doc). The server action enforces it regardless.
   */
  canApprove?: boolean;
  children: React.ReactNode;
}

export function DraftEditorShell({
  title,
  artifactId,
  provider,
  model,
  status,
  approvedAt,
  approveAction,
  approveLabel = "Approve as reviewed",
  canApprove = true,
  children,
}: DraftEditorShellProps) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-fg">
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <AIBadge provider={provider} model={model} />
          <ReviewBadge status={status} />
        </div>
      </div>

      {status === "draft" ? (
        <Alert tone="warning" title="AI-generated draft — teacher review required">
          This is a draft produced by AI. Read every field, edit anything that
          does not fit your class, then approve when you are satisfied. Nothing
          here is final until a teacher approves it.
        </Alert>
      ) : (
        <Alert tone="success" title="Teacher approved">
          This artifact was reviewed and approved
          {approvedAt ? ` on ${formatDate(approvedAt)}` : ""}. You can still
          edit it — your changes are saved to the approved copy.
        </Alert>
      )}

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        {children}
      </div>

      {status === "draft" && canApprove && (
        <form action={approveAction} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={artifactId} />
          <ApproveButton label={approveLabel} />
          <p className="text-xs text-muted">
            Approving records your account and the time of approval.
          </p>
        </form>
      )}

      {status === "draft" && !canApprove && (
        <Alert tone="info" title="Approval reserved for the owner">
          {APPROVAL_DENIED_NOTE}
        </Alert>
      )}
    </section>
  );
}
