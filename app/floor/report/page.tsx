import Link from "next/link";
import { requireUser } from "@/lib/auth/require";
import { buildWorkOrderOptions } from "@/lib/report-options";
import ProductionReportForm from "@/components/ProductionReportForm";

export const dynamic = "force-dynamic";

export default async function FloorReportPage() {
  await requireUser();
  const options = await buildWorkOrderOptions();

  return (
    <div className="min-h-full p-5 max-w-md mx-auto space-y-4">
      <Link href="/floor" className="text-sm text-copper">&larr; Back</Link>
      <div>
        <h1 className="font-serif text-2xl text-charcoal">Report production</h1>
        <p className="text-sm text-text-muted">
          Select a work order, confirm the details, and record usage &amp; waste.
        </p>
      </div>
      <ProductionReportForm options={options} sessionAuth />
    </div>
  );
}
