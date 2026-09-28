"use client";

import { useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";

/** Submit button for the DraftEditorShell approve form, with pending state. */
export function ApproveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} className="w-fit">
      {!pending && <CheckCircle2 className="size-4" aria-hidden="true" />}
      {pending ? "Approving..." : label}
    </Button>
  );
}
