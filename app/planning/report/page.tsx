import { buildWorkOrderOptions, buildEditReport } from "@/lib/report-options";
import ProductionReportForm from "@/components/ProductionReportForm";

export const revalidate = 300;

export default async function ProductionReportPage({
  searchParams,
}: {
  searchParams: { edit?: string };
}) {
  const editId = searchParams.edit?.trim() || "";
  const [unique, editReport] = await Promise.all([
    buildWorkOrderOptions(),
    editId ? buildEditReport(editId) : Promise.resolve(undefined),
  ]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">
          {editReport ? "Edit Production Report" : "Production Report"}
        </h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          {editReport
            ? "Update this internal production report and save — the record is overwritten in place."
            : "Internal production reporting — select a work order, confirm the details, and record usage & waste."}
        </p>
      </div>
      <ProductionReportForm options={unique} editReport={editReport} />
    </div>
  );
}
