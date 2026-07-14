import { fetchProductionInput, fetchProductionReports, fetchSkus } from "@/lib/sheets";
import { computePerformance } from "@/lib/performance";
import PerformanceView from "@/components/PerformanceView";
import FilterBar from "@/components/FilterBar";
import { Suspense } from "react";

export const revalidate = 300;

function parseDMY(s: string): Date | null {
  if (!s || !s.trim()) return null;
  const p = s.trim().split("/");
  if (p.length === 3) { const d = new Date(`${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`); return isNaN(d.getTime()) ? null : d; }
  return null;
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string; machine?: string; employee?: string; shift?: string };
}) {
  const [input, reports, skus] = await Promise.all([
    fetchProductionInput(),
    fetchProductionReports(),
    fetchSkus(),
  ]);

  const skuDesc = new Map(skus.map(s => [s.skuCode, s.description]));

  const { dateFrom, dateTo, machine, employee, shift } = searchParams;
  const filtered = input.filter(r => {
    if (machine && r.machine !== machine) return false;
    if (employee && r.employee !== employee) return false;
    if (shift && r.shift !== shift) return false;
    if (dateFrom || dateTo) {
      const d = parseDMY(r.date);
      if (!d) return false;
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo)) return false;
    }
    return true;
  });

  const data = computePerformance(filtered, reports, skuDesc);

  const machines = Array.from(new Set(input.map(r => r.machine).filter(Boolean))).sort();
  const employees = Array.from(new Set(input.map(r => r.employee).filter(Boolean))).sort();
  const shifts = Array.from(new Set(input.map(r => r.shift).filter(Boolean))).sort();

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Production Performance</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Inside the production room — output, efficiency, yield &amp; wastage by machine, employee, shift and product
        </p>
      </div>

      <Suspense>
        <FilterBar
          searchPlaceholder=""
          periodKeys={{ from: "dateFrom", to: "dateTo" }}
          filters={[
            { key: "machine", label: "Machine", options: machines.map(m => ({ value: m, label: m })) },
            { key: "employee", label: "Employee", options: employees.map(e => ({ value: e, label: e })) },
            { key: "shift", label: "Shift", options: shifts.map(s => ({ value: s, label: s })) },
            { key: "dateFrom", label: "From", type: "date" },
            { key: "dateTo", label: "To", type: "date" },
          ]}
        />
      </Suspense>

      <PerformanceView data={data} />
    </div>
  );
}
