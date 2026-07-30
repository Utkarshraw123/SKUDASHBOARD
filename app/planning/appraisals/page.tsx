import { listRuns } from "@/lib/floor/runsRepo";
import { listMachines, listOperators } from "@/lib/floor/catalog";
import { aggregateByOperator, aggregateByMachine } from "@/lib/floor/appraisals";
import AppraisalsView from "@/components/AppraisalsView";
import FilterBar from "@/components/FilterBar";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

export default async function AppraisalsPage({
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

  const opName = new Map(operators.map((o) => [o.id, o.name]));
  const mName = new Map(machines.map((m) => [m.id, m.name]));

  const byOperator = aggregateByOperator(runs).map((r) => ({ ...r, name: opName.get(r.operatorId) ?? `#${r.operatorId}` }));
  const byMachine = aggregateByMachine(runs).map((r) => ({ ...r, name: mName.get(r.machineId) ?? `#${r.machineId}` }));

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Appraisals</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Per-operator and per-machine output, efficiency, throughput and downtime from logged production runs. Voids excluded.
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
      <AppraisalsView byOperator={byOperator} byMachine={byMachine} range={{ from, to }} />
    </div>
  );
}
