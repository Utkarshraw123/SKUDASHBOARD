import { listRuns } from "@/lib/floor/runsRepo";
import { listMachines, listOperators } from "@/lib/floor/catalog";
import { efficiency } from "@/lib/floor/metrics";
import RunsRegisterView from "@/components/RunsRegisterView";
import FilterBar from "@/components/FilterBar";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export default async function RunsRegisterPage({
  searchParams,
}: {
  searchParams: { dateFrom?: string; dateTo?: string };
}) {
  const def = monthRange();
  const from = searchParams.dateFrom ?? def.from;
  const to = searchParams.dateTo ?? def.to;

  const [runs, machines, operators] = await Promise.all([
    listRuns({ from, to }),
    listMachines(),
    listOperators(),
  ]);
  const mName = new Map(machines.map((m) => [m.id, m.name]));
  const opName = new Map(operators.map((o) => [o.id, o.name]));

  const rows = runs.map((r) => ({
    id: r.id,
    date: r.date,
    shift: r.shift,
    machine: mName.get(r.machineId) ?? `#${r.machineId}`,
    operator: opName.get(r.operatorId) ?? `#${r.operatorId}`,
    product: r.productDesc,
    planned: r.plannedQty,
    actual: r.actualQty,
    efficiency: efficiency(r.actualQty, r.plannedQty),
    downtimeMin: r.downtimeMin,
    void: r.void,
    voidReason: r.voidReason,
  }));

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Runs register</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Every logged machine run — one row each. Voided runs are flagged and excluded from appraisal totals.
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
      <RunsRegisterView rows={rows} range={{ from, to }} />
    </div>
  );
}
