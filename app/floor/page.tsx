import { requireUser } from "@/lib/auth/require";
import { getDayChecks } from "@/lib/floor/readinessRepo";
import { listRuns } from "@/lib/floor/runsRepo";
import { canLogRuns, checklistProgress } from "@/lib/floor/checklist";
import { fetchProductionReportRows } from "@/lib/sheets";
import { computeInternalYield, reportsOnDate } from "@/lib/internal-yield";
import LogoutButton from "@/components/floor/LogoutButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FloorHome() {
  const user = await requireUser();
  const date = new Date().toISOString().slice(0, 10);
  const [view, runs, reportRows] = await Promise.all([
    getDayChecks(date),
    listRuns({ date }),
    fetchProductionReportRows(),
  ]);
  const start = checklistProgress(view.items, view.checks, "start");
  const end = checklistProgress(view.items, view.checks, "end");
  const runsUnlocked = canLogRuns(view.day);

  const runsToday = runs.filter((r) => !r.void).length;
  const reportsToday = reportsOnDate(computeInternalYield(reportRows).reports, date);

  return (
    <div className="min-h-full p-6 max-w-md mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-charcoal">Welcome, {user.name.split(" ")[0]}</h1>
          <p className="text-text-muted text-sm">{date}</p>
        </div>
        <LogoutButton />
      </header>

      {/* Today's activity — lets a supervisor confirm their submissions landed */}
      <section className="rounded-2xl bg-white border border-[#e4ddd4] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium text-charcoal">Today's activity</span>
          <span className="text-sm text-text-muted">
            {reportsToday.length} report{reportsToday.length === 1 ? "" : "s"} · {runsToday} run{runsToday === 1 ? "" : "s"}
          </span>
        </div>
        {reportsToday.length === 0 && runsToday === 0 ? (
          <p className="text-sm text-text-muted">Nothing logged yet today.</p>
        ) : (
          <ul className="space-y-2">
            {reportsToday.map((r) => (
              <li key={r.reportId}>
                <Link
                  href={`/floor/report?edit=${encodeURIComponent(r.reportId)}`}
                  className="flex items-center justify-between rounded-xl border border-[#efe8df] px-3 py-2.5"
                >
                  <span className="text-sm text-charcoal truncate mr-2">
                    {r.workOrder}
                    {r.description ? ` · ${r.description}` : ""}
                  </span>
                  <span className="text-xs text-copper shrink-0">Edit &rarr;</span>
                </Link>
              </li>
            ))}
            {runsToday > 0 && (
              <li>
                <Link href="/floor/runs" className="flex items-center justify-between rounded-xl border border-[#efe8df] px-3 py-2.5">
                  <span className="text-sm text-charcoal">{runsToday} production run{runsToday === 1 ? "" : "s"} logged</span>
                  <span className="text-xs text-copper shrink-0">View &rarr;</span>
                </Link>
              </li>
            )}
          </ul>
        )}
      </section>

      {/* Startup checks (SU04 Start-of-Day) */}
      <Link href="/floor/checklist/start" className="block rounded-2xl bg-white border border-[#e4ddd4] p-5">
        <div className="flex items-center justify-between">
          <span className="font-medium text-charcoal">Startup checks</span>
          <span className="text-sm text-text-muted">{start.done}/{start.total}{view.day.startCompletedBy ? " ✓" : ""}</span>
        </div>
        <p className="text-sm text-text-muted mt-1">SU04 start-of-day warehouse checks.</p>
        {start.denyCount > 0 && <p className="text-sm text-amber-600 mt-1">{start.denyCount} denied</p>}
      </Link>

      {/* Log inputs (production runs) — gated on startup checks */}
      {runsUnlocked ? (
        <Link href="/floor/runs" className="block rounded-2xl bg-white border border-[#e4ddd4] p-5">
          <span className="font-medium text-charcoal">Log inputs</span>
          <p className="text-sm text-text-muted mt-1">Record per-machine production runs and output.</p>
        </Link>
      ) : (
        <div className="block rounded-2xl bg-[#f0e9e0] border border-[#e4ddd4] p-5">
          <span className="font-medium text-text-muted">Log inputs</span>
          <p className="text-sm text-text-muted mt-1">Complete Startup checks to unlock run logging.</p>
        </div>
      )}

      {/* Report production (detailed wastage / yield report) */}
      <Link href="/floor/report" className="block rounded-2xl bg-copper text-white p-5">
        <span className="font-medium">Report production</span>
        <p className="text-sm text-white/85 mt-1">Log a work order's usage, waste &amp; batches.</p>
      </Link>

      {/* End-of-day checks (SU04 End-of-Day) */}
      <Link href="/floor/checklist/end" className="block rounded-2xl bg-white border border-[#e4ddd4] p-5">
        <div className="flex items-center justify-between">
          <span className="font-medium text-charcoal">End-of-day checks</span>
          <span className="text-sm text-text-muted">{end.done}/{end.total}{view.day.endCompletedBy ? " ✓" : ""}</span>
        </div>
        <p className="text-sm text-text-muted mt-1">SU04 end-of-day warehouse checks.</p>
      </Link>

      {user.role === "admin" && (
        <Link href="/floor/admin" className="block rounded-2xl bg-white border border-[#e4ddd4] p-4 text-copper font-medium">
          Admin — manage users, machines &amp; checklist →
        </Link>
      )}
    </div>
  );
}
