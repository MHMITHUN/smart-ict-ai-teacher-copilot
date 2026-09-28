import { CheckCircle2, PencilLine } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ReviewStatus } from "@/lib/db/types";

/**
 * Review-workflow badge (spec 20.10): every artifact is a draft until a
 * teacher approves it.
 * - draft   -> "AI-generated draft — teacher review required"
 * - approved-> "Teacher approved"
 */

export function ReviewBadge({
  status,
  className,
}: {
  status: ReviewStatus;
  className?: string;
}) {
  if (status === "approved") {
    return (
      <Badge tone="success" className={cn("gap-1", className)}>
        <CheckCircle2 className="size-3" aria-hidden="true" />
        Teacher approved
      </Badge>
    );
  }
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center rounded-md border border-warning/20 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning",
        className,
      )}
    >
      <PencilLine className="mr-1 size-3" aria-hidden="true" />
      AI-generated draft — teacher review required
    </span>
  );
}
