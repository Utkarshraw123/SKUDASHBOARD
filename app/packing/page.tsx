import { fetchPackingSchedule, fetchWNPPlanning, fetchSkus } from "@/lib/sheets";
import { futureDateFull } from "@/lib/markets";
import FilterBar from "@/components/FilterBar";
import { Suspense } from "react";

export const revalidate = 0;

type Urgency = "overdue" | "this_week" | "upcoming" | "planned" | "not_planned" | "sufficient_stock";

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const map: Record<Urgency, string> = {
    overdue: "bg-red-100 text-red-700",
    this_week: "bg-amber-100 text-amber-700",
    upcoming: "bg-cream-dark text-text-muted",
    planned: "bg-emerald-100 text-emerald-700",
    not_planned: "bg-red-100 text-red-700",
    sufficient_stock: "bg-blue-100 text-blue-700",
  };
  const labels: Record<Urgency, string> = {
    overdue: "Overdue",
    this_week: "Due This Week",
    upcoming: "Upcoming",
    planned: "Planned (Internal)",
    not_planned: "Not Planned ⚠",
    sufficient_stock: "Sufficient Stock",
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${map[urgency]}`}>{labels[urgency]}</span>;
}

function parseDDMMYYYY(s: string): Date | null {
  if (!s || s.trim() === "") return null;
  const parts = s.trim().split("/");
  if (parts.length === 3) return new Date(`${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`);
  return null;
}

function inDateRange(dateStr: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const d = parseDDMMYYYY(dateStr);
  if (!d) return true;
  if (from && d < new Date(from)) return false;
  if (to && d > new Date(to)) return false;
  return true;
}

export default async function PackingPage({
  searchParams,
}: {
  searchParams: { search?: string; vendor?: string; urgency?: string; dateFrom?: string; dateTo?: string };
}) {
  const [rows, planningRows, skuRows] = await Promise.all([
    fetchPackingSchedule(),
    fetchWNPPlanning(),
    fetchSkus(),
  ]);

  // Build a set of product codes that are in WNP planning (planned or in progress)
  const plannedInWNP = new Set(
    planningRows
      .filter((r) => r.status === "planned" || r.status === "in_progress")
      .map((r) => r.productCode)
  );

  // Build a cover map from SKU data (keyed by SKU code)
  const coverMap = new Map<string, number>();
  for (const s of skuRows) {
    if (s.skuCode && s.totalWeeksCover !== null) {
      coverMap.set(s.skuCode.trim(), s.totalWeeksCover);
    }
  }

  // Augment rows with resolved urgency
  const augmented = rows.map((r) => {
    const isInternal = !r.vendorName.trim();
    let urgency: Urgency;
    if (isInternal) {
      if (plannedInWNP.has(r.partNumber)) {
        urgency = "planned";
      } else {
        const cover = coverMap.get(r.partNumber.trim());
        urgency = (cover !== undefined && cover >= 16) ? "sufficient_stock" : "not_planned";
      }
    } else {
      urgency = r.urgency as Urgency;
    }
    return { ...r, resolvedVendor: isInternal ? "Internal Production" : r.vendorName, urgency };
  });

  const vendors = Array.from(new Set(augmented.map((r) => r.resolvedVendor).filter(Boolean))).sort();

  const search = searchParams.search?.toLowerCase() ?? "";
  const vendorFilter = searchParams.vendor ?? "";
  const urgencyFilter = searchParams.urgency ?? "";
  const dateFrom = searchParams.dateFrom ?? "";
  const dateTo = searchParams.dateTo ?? "";

  let filtered = [...augmented].sort((a, b) => {
    const da = parseDDMMYYYY(a.dueDate)?.getTime() ?? Infinity;
    const db = parseDDMMYYYY(b.dueDate)?.getTime() ?? Infinity;
    return da - db;
  });

  if (search) filtered = filtered.filter((r) =>
    r.description.toLowerCase().includes(search) ||
    r.partNumber.toLowerCase().includes(search) ||
    r.purchaseOrder.toLowerCase().includes(search)
  );
  if (vendorFilter) filtered = filtered.filter((r) => r.resolvedVendor === vendorFilter);
  if (urgencyFilter) filtered = filtered.filter((r) => r.urgency === urgencyFilter);
  if (dateFrom || dateTo) filtered = filtered.filter((r) => inDateRange(r.dueDate, dateFrom, dateTo));

  const counts = {
    overdue: augmented.filter((r) => r.urgency === "overdue").length,
    this_week: augmented.filter((r) => r.urgency === "this_week").length,
    not_planned: augmented.filter((r) => r.urgency === "not_planned").length,
    planned: augmented.filter((r) => r.urgency === "planned").length,
    upcoming: augmented.filter((r) => r.urgency === "upcoming").length,
    sufficient_stock: augmented.filter((r) => r.urgency === "sufficient_stock").length,
  };

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Packing Schedule</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">Active packing orders — sorted by due date</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: "Overdue", count: counts.overdue, color: "text-red-600" },
          { label: "Due This Week", count: counts.this_week, color: "text-amber-600" },
          { label: "Not Planned ⚠", count: counts.not_planned, color: "text-red-600" },
          { label: "Planned (Internal)", count: counts.planned, color: "text-emerald-600" },
          { label: "Upcoming", count: counts.upcoming, color: "text-charcoal" },
          { label: "Sufficient Stock", count: counts.sufficient_stock, color: "text-blue-600" },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-[#e4ddd4] px-4 py-4">
            <p className="text-[10px] tracking-widest uppercase text-text-muted mb-1">{label}</p>
            <p className={`text-2xl font-serif font-medium ${color}`}>{count}</p>
          </div>
        ))}
      </div>

      <Suspense>
        <FilterBar
          searchPlaceholder="Search by part, description or PO…"
          filters={[
            { key: "urgency", label: "Urgency", options: [
              { value: "overdue", label: "Overdue (External)" },
              { value: "this_week", label: "Due This Week" },
              { value: "upcoming", label: "Upcoming" },
              { value: "planned", label: "Planned (Internal)" },
              { value: "not_planned", label: "Not Planned ⚠" },
              { value: "sufficient_stock", label: "Sufficient Stock" },
            ]},
            { key: "vendor", label: "Vendor", options: vendors.map((v) => ({ value: v, label: v })) },
            { key: "dateFrom", label: "Due From", type: "date" },
            { key: "dateTo", label: "Due To", type: "date" },
          ]}
        />
      </Suspense>

      <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e4ddd4] bg-cream text-xs text-text-muted">
          Showing {filtered.length} of {augmented.length} orders
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-text-muted text-sm">No results match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream border-b border-[#e4ddd4]">
                <tr className="text-left">
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium whitespace-nowrap">Part Number</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Description</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium whitespace-nowrap">Due Date</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium whitespace-nowrap">PO Number</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right whitespace-nowrap">Balance</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Vendor</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const rowBg =
                    r.urgency === "overdue" || r.urgency === "not_planned" ? "bg-red-50/30" :
                    r.urgency === "this_week" ? "bg-amber-50/20" :
                    r.urgency === "planned" ? "bg-emerald-50/20" :
                    r.urgency === "sufficient_stock" ? "bg-blue-50/20" : "";
                  return (
                    <tr key={`${r.purchaseOrder}-${r.partNumber}-${i}`} className={`border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors ${rowBg}`}>
                      <td className="px-4 py-3 font-mono text-xs text-copper whitespace-nowrap">{r.partNumber}</td>
                      <td className="px-4 py-3 text-charcoal max-w-[240px] truncate">{r.description}</td>
                      <td className="px-4 py-3 text-text-muted text-xs font-medium whitespace-nowrap">{futureDateFull(r.dueDate) || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-text-muted whitespace-nowrap">{r.purchaseOrder || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-charcoal whitespace-nowrap">{r.balance?.toLocaleString() ?? "—"}</td>
                      <td className="px-4 py-3 text-xs max-w-[160px] truncate">
                        <span className={r.resolvedVendor === "Internal Production" ? "text-copper font-medium" : "text-text-muted"}>
                          {r.resolvedVendor}
                        </span>
                      </td>
                      <td className="px-4 py-3"><UrgencyBadge urgency={r.urgency} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
