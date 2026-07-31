import Link from "next/link";
import { requireUser } from "@/lib/auth/require";
import { buildWorkOrderOptions, buildEditReport } from "@/lib/report-options";
import ProductionReportForm from "@/components/ProductionReportForm";

export const dynamic = "force-dynamic";

export default async function FloorReportPage({
  searchParams,
}: {
  searchParams: { edit?: string };
}) {
  await requireUser();
  const editId = searchParams.edit?.trim() || "";
  const [options, editReport] = await Promise.all([
    buildWorkOrderOptions(),
    editId ? buildEditReport(editId) : Promise.resolve(undefined),
  ]);
  const isEdit = !!editReport;

  return (
    <div className="min-h-full p-5 max-w-md mx-auto space-y-4">
      <Link href="/floor" className="text-sm text-copper">&larr; Back</Link>
      <div>
        <h1 className="font-serif text-2xl text-charcoal">
          {isEdit ? "Edit production report" : "Report production"}
        </h1>
        <p className="text-sm text-text-muted">
          {isEdit
            ? "Correct this report and save — the record is overwritten in place."
            : "Select a work order, confirm the details, and record usage & waste."}
        </p>
      </div>
      <ProductionReportForm options={options} editReport={editReport} sessionAuth />
    </div>
  );
}
