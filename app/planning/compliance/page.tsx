import { listReadinessDaysInRange } from "@/lib/floor/readinessRepo";
import { summarizeCompliance } from "@/lib/floor/compliance";
import { getClient } from "@/lib/db/client";
import ComplianceView from "@/components/ComplianceView";
import FilterBar from "@/components/FilterBar";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string };
}) {
  const def = monthRange();
  const from = searchParams.dateFrom ?? def.from;
  const to = searchParams.dateTo ?? def.to;

  const bundles = await listReadinessDaysInRange(from, to);
  const days = summarizeCompliance(bundles);

  const usersRes = await getClient().execute("SELECT id, name FROM users");
  const uName = new Map(usersRes.rows.map((r) => [r.id as number, r.name as string]));
  const name = (id: number | null) => (id == null ? "—" : uName.get(id) ?? `#${id}`);

  const rows = days.map((d) => ({
    ...d,
    startCompletedName: name(d.startCompletedBy),
    startCrossCheckName: name(d.startCrossCheckBy),
    endCompletedName: name(d.endCompletedBy),
    endCrossCheckName: name(d.endCrossCheckBy),
  }));

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">SU04 compliance</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Warehouse Start-Up checks by day — who completed and cross-checked each phase, and any denied items (flagged amber).
        </p>
      </div>
      <Suspense>
        <FilterBar
          periodKeys={{ from: "dateFrom", to: "dateTo" }}
          filters={[
            { key: "dateFrom", label: "From", type: "date" },
            { key: "dateTo", label: "To", type: "date" },
          ]}
        />
      </Suspense>
      <ComplianceView rows={rows} range={{ from, to }} />
    </div>
  );
}
