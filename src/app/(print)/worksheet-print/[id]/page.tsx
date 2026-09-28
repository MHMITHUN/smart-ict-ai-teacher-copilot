import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { buildPrintableWorksheet } from "@/lib/artifacts/worksheet-text";
import { PrintableWorksheet } from "@/components/worksheets/PrintableWorksheet";

export const metadata: Metadata = {
  title: "Print Worksheet",
};

export const dynamic = "force-dynamic";

/**
 * Printable paper view (spec 20.7). OUTSIDE the workspace layout (no
 * sidebar on the printed page) but still login-gated, and APPROVED
 * worksheets only — unreviewed AI drafts are never printed for a class.
 */
export default async function WorksheetPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["TEACHER", "ADMIN"]);
  const { id } = await params;
  const store = await getStore();
  const worksheet = await store.getWorksheet(id);
  if (!worksheet || worksheet.status !== "approved") notFound();

  const model = buildPrintableWorksheet(worksheet);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 print:max-w-none print:p-0">
      <PrintableWorksheet model={model} backHref={`/worksheets?id=${worksheet.id}`} />
    </main>
  );
}
