import { fetchBulkOpenPOs } from "@/lib/sheets";
import FilterBar from "@/components/FilterBar";
import ExportCsvButton from "@/components/ExportCsvButton";
import { Suspense } from "react";

export const revalidate = 300;

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

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: { search?: string; vendor?: string; partType?: string; dateFrom?: string; dateTo?: string };
}) {
  const rows = await fetchBulkOpenPOs();

  const vendors = Array.from(new Set(rows.map((r) => r.vendorName).filter(Boolean))).sort();
  const partTypes = Array.from(new Set(rows.map((r) => r.partType).filter(Boolean))).sort();

  const search = searchParams.search?.toLowerCase() ?? "";
  const vendorFilter = searchParams.vendor ?? "";
  const partTypeFilter = searchParams.partType ?? "";
  const dateFrom = searchParams.dateFrom ?? "";
  const dateTo = searchParams.dateTo ?? "";

  let filtered = rows;
  if (search) filtered = filtered.filter((r) =>
    r.description.toLowerCase().includes(search) ||
    r.partNumber.toLowerCase().includes(search) ||
    r.order.toLowerCase().includes(search)
  );
  if (vendorFilter) filtered = filtered.filter((r) => r.vendorName === vendorFilter);
  if (partTypeFilter) filtered = filtered.filter((r) => r.partType === partTypeFilter);
  if (dateFrom || dateTo) filtered = filtered.filter((r) => inDateRange(r.dueDate, dateFrom, dateTo));

  const totalQty = filtered.reduce((sum, r) => sum + (r.orderQuantity ?? 0), 0);

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Bulk Open POs</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          {filtered.length} open purchase orders · {totalQty.toLocaleString()} units total
        </p>
      </div>

      <Suspense>
        <FilterBar
          searchPlaceholder="Search by part, description or PO…"
          filters={[
            { key: "vendor", label: "Vendor", options: vendors.map((v) => ({ value: v, label: v })) },
            { key: "partType", label: "Part Type", options: partTypes.map((t) => ({ value: t, label: t })) },
            { key: "dateFrom", label: "Due From", type: "date" },
            { key: "dateTo", label: "Due To", type: "date" },
          ]}
        />
      </Suspense>

      <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e4ddd4] bg-cream text-xs text-text-muted flex items-center justify-between">
          <span>Showing {filtered.length} of {rows.length} orders</span>
          <ExportCsvButton filename="open-purchase-orders" />
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-text-muted text-sm">No results match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream border-b border-[#e4ddd4]">
                <tr className="text-left">
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium whitespace-nowrap">PO Number</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Vendor</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium whitespace-nowrap">Part Number</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Description</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium whitespace-nowrap">Type</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium whitespace-nowrap">Date Raised</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium whitespace-nowrap">Due Date</th>
                  <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right whitespace-nowrap">Qty Ordered</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={`${r.order}-${r.partNumber}-${i}`} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-copper whitespace-nowrap">{r.order}</td>
                    <td className="px-4 py-3 text-charcoal text-xs max-w-[180px] truncate">{r.vendorName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-muted whitespace-nowrap">{r.partNumber}</td>
                    <td className="px-4 py-3 text-charcoal max-w-[200px] truncate">{r.description}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.partType ? <span className="rounded-full bg-cream-dark px-2.5 py-0.5 text-xs text-text-muted">{r.partType}</span> : "—"}
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">{r.date || "—"}</td>
                    <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">{r.dueDate || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-charcoal whitespace-nowrap">{r.orderQuantity?.toLocaleString() ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
