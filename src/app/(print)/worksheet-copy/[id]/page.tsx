import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { worksheetPlainText } from "@/lib/artifacts/worksheet-text";
import { WorksheetCopyView } from "@/components/worksheets/WorksheetCopyView";

export const metadata: Metadata = {
  title: "Copy Worksheet Text",
};

export const dynamic = "force-dynamic";

/**
 * Copy-to-document view (spec 20.7): the approved worksheet as plain,
 * select-all-friendly text for pasting into Word / Google Docs. Same
 * guards as the printable page: login required, approved drafts only.
 */
export default async function WorksheetCopyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["TEACHER", "ADMIN"]);
  const { id } = await params;
  const store = await getStore();
  const worksheet = await store.getWorksheet(id);
  if (!worksheet || worksheet.status !== "approved") notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <WorksheetCopyView
        text={worksheetPlainText(worksheet)}
        backHref={`/worksheets?id=${worksheet.id}`}
      />
    </main>
  );
}
