import { fetchProduction } from "@/lib/sheets";
import FilterBar from "@/components/FilterBar";
import { Suspense } from "react";

export const revalidate = 300;

function StatusBadge({ status }: { status: "complete" | "partial" | "open" }) {
  const map = {
    complete: "bg-emerald-100 text-emerald-700",
    partial: "bg-amber-100 text-amber-700",
    open: "bg-blue-100 text-blue-700",
  };
  const labels = { complete: "Complete", partial: "Partial", open: "Open" };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status]}`}>{labels[status]}</span>;
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

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: { search?: string; vendor?: string; orderType?: string; status?: string; poStatus?: string; dateFrom?: string; dateTo?: string };
}) {
  const rows = await fetchProduction();

  const vendors = Array.from(new Set(rows.map((r) => r.vendorName).filter(Boolean))).sort();
  const orderTypes = Array.from(new Set(rows.map((r) => r.orderType).filter(Boolean))).sort();
  const poStatuses = Array.from(new Set(rows.map((r) => r.poStatus).filter(Boolean))).sort();

  const search = searchParams.search?.toLowerCase() ?? "";
  const vendorFilter = searchParams.vendor ?? "";
  const orderTypeFilter = searchParams.orderType ?? "";
  const statusFilter = searchParams.status ?? "";
  const poStatusFilter = searchParams.poStatus ?? "";
  const dateFrom = searchParams.dateFrom ?? "";
  const dateTo = searchParams.dateTo ?? "";

  let filtered = rows;
  if (search) filtered = filtered.filter((r) =>
    r.description.toLowerCase().includes(search) ||
    r.partNumber.toLowerCase().includes(search) ||
    r.order.toLowerCase().includes(search) ||
    r.workOrder.toLowerCase().includes(search)
  );
  if (vendorFilter) filtered = filtered.filter((r) => r.vendorName === vendorFilter);
  if (orderTypeFilter) filtered = filtered.filter((r) => r.orderType === orderTypeFilter);
  if (statusFilter) filtered = filtered.filter((r) => r.status === statusFilter);
  if (poStatusFilter) filtered = filtered.filter((r) => r.poStatus === poStatusFilter);
  if (dateFrom || dateTo) filtered = filtered.filter((r) => inDateRange(r.dueDate, dateFrom, dateTo));

  const counts = {
    open: rows.filter((r) => r.status === "open").length,
    partial: rows.filter((r) => r.status === "partial").length,
    complete: rows.filter((r) => r.status === "complete").length,
  };

  // Total cost = open orders only (cost per unit × quantity ordered)
  const totalCost = filtered
    .filter((r) => r.status === "open")
    .map((r) => (r.costPerUnit ?? 0) * (r.quantity ?? 0))
    .reduce((s, n) => s + n, 0);

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">External Production</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">Purchase Orders & Work Orders with external vendors</p>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Open Orders", value: counts.open, color: "text-blue-600" },
          { label: "Partial", value: counts.partial, color: "text-amber-600" },
          { label: "Complete", value: counts.complete, color: "text-emerald-600" },
          { label: "Total Cost (filtered)", value: `£${totalCost.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`, color: "text-copper" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-[#e4ddd4] px-5 py-4">
            <p className="text-xs tracking-widest uppercase text-text-muted mb-1">{label}</p>
            <p className={`text-2xl font-serif font-medium ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <Suspense>
        <FilterBar
          searchPlaceholder="Search by part, description, PO or WO…"
          filters={[
            { key: "vendor", label: "Vendor", options: vendors.map((v) => ({ value: v, label: v })) },
            { key: "orderType", label: "Order Type", options: orderTypes.map((t) => ({ value: t, label: t })) },
            { key: "status", label: "Status", options: [
              { value: "open", label: "Open" },
              { value: "partial", label: "Partial" },
              { value: "complete", label: "Complete" },
            ]},
            { key: "poStatus", label: "PO Status", options: poStatuses.map((s) => ({ value: s, label: s })) },
            { key: "dateFrom", label: "Due From", type: "date" },
            { key: "dateTo", label: "Due To", type: "date" },
          ]}
        />
      </Suspense>

      <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e4ddd4] bg-cream text-xs text-text-muted">
          Showing {filtered.length} of {rows.length} orders
        </div>
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-text-muted text-sm">No results match your filters.</p>
        ) : (
          <>
            {/* Card layout — mobile / narrow screens */}
            <div className="md:hidden divide-y divide-[#e4ddd4]/60">
              {filtered.map((r, i) => (
                <div key={`${r.order}-${r.partNumber}-${i}`} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-charcoal text-sm font-medium leading-snug">{r.description}</p>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-text-muted mb-3">{r.vendorName}{r.orderType ? ` · ${r.orderType}` : ""}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div><span className="text-text-muted">PO </span><span className="font-mono text-copper">{r.order || "—"}</span></div>
                    <div><span className="text-text-muted">WO </span><span className="font-mono text-text-muted">{r.workOrder || "—"}</span></div>
                    <div><span className="text-text-muted">Part </span><span className="font-mono text-text-muted">{r.partNumber || "—"}</span></div>
                    <div><span className="text-text-muted">Due </span><span className="text-charcoal">{r.dueDate || "—"}</span></div>
                    <div><span className="text-text-muted">Qty </span><span className="text-charcoal">{r.quantity?.toLocaleString() ?? "—"}</span></div>
                    <div><span className="text-text-muted">Received </span><span className="text-charcoal">{r.received?.toLocaleString() ?? "—"}</span></div>
                    <div><span className="text-text-muted">Cost </span><span className="font-medium text-charcoal">{r.cost || "—"}</span></div>
                    <div><span className="text-text-muted">PO Status </span><span className="text-charcoal">{r.poStatus || "—"}</span></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Table layout — md and up */}
            <div className="hidden md:block overflow-x-auto">
              <table className="text-sm" style={{ tableLayout: "fixed", minWidth: "1260px", width: "100%" }}>
                <colgroup>
                  <col style={{ width: "6.5rem" }} />
                  <col style={{ width: "6.5rem" }} />
                  <col style={{ width: "9rem" }} />
                  <col style={{ width: "6rem" }} />
                  <col style={{ width: "7rem" }} />
                  <col style={{ width: "16rem" }} />
                  <col style={{ width: "7rem" }} />
                  <col style={{ width: "7rem" }} />
                  <col style={{ width: "5rem" }} />
                  <col style={{ width: "5.5rem" }} />
                  <col style={{ width: "6rem" }} />
                  <col style={{ width: "6.5rem" }} />
                  <col style={{ width: "5.5rem" }} />
                </colgroup>
                <thead className="bg-cream border-b border-[#e4ddd4]">
                  <tr className="text-left">
                    <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">PO Number</th>
                    <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">WO Number</th>
                    <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Vendor</th>
                    <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Type</th>
                    <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Part</th>
                    <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Description</th>
                    <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Date Raised</th>
                    <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Due Date</th>
                    <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right">Qty</th>
                    <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right">Received</th>
                    <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium text-right">Cost</th>
                    <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">PO Status</th>
                    <th className="px-4 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={`${r.order}-${r.partNumber}-${i}`} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-copper overflow-hidden"><span className="block truncate">{r.order || "—"}</span></td>
                      <td className="px-4 py-3 font-mono text-xs text-text-muted overflow-hidden"><span className="block truncate">{r.workOrder || "—"}</span></td>
                      <td className="px-4 py-3 text-charcoal text-xs overflow-hidden"><span className="block truncate">{r.vendorName}</span></td>
                      <td className="px-4 py-3 overflow-hidden">
                        <span className="inline-block max-w-full truncate rounded-full bg-cream-dark px-2.5 py-0.5 text-xs text-text-muted align-middle">{r.orderType || "—"}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-muted overflow-hidden"><span className="block truncate">{r.partNumber}</span></td>
                      <td className="px-4 py-3 text-charcoal overflow-hidden"><span className="block truncate">{r.description}</span></td>
                      <td className="px-4 py-3 text-text-muted text-xs overflow-hidden"><span className="block truncate">{r.raisedDate || "—"}</span></td>
                      <td className="px-4 py-3 text-text-muted text-xs overflow-hidden"><span className="block truncate">{r.dueDate || "—"}</span></td>
                      <td className="px-4 py-3 text-right text-charcoal overflow-hidden"><span className="block truncate">{r.quantity?.toLocaleString() ?? "—"}</span></td>
                      <td className="px-4 py-3 text-right text-text-muted overflow-hidden"><span className="block truncate">{r.received?.toLocaleString() ?? "—"}</span></td>
                      <td className="px-4 py-3 text-right font-medium text-charcoal overflow-hidden"><span className="block truncate">{r.cost || "—"}</span></td>
                      <td className="px-4 py-3 text-xs text-text-muted overflow-hidden"><span className="block truncate">{r.poStatus || "—"}</span></td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
