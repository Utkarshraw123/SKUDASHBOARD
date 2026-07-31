import { requireUser } from "@/lib/auth/require";
import { getDayChecks } from "@/lib/floor/readinessRepo";
import { canLogRuns, checklistProgress } from "@/lib/floor/checklist";
import LogoutButton from "@/components/floor/LogoutButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FloorHome() {
  const user = await requireUser();
  const date = new Date().toISOString().slice(0, 10);
  const view = await getDayChecks(date);
  const start = checklistProgress(view.items, view.checks, "start");
  const end = checklistProgress(view.items, view.checks, "end");
  const runsUnlocked = canLogRuns(view.day);

  return (
    <div className="min-h-full p-6 max-w-md mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-charcoal">Production</h1>
          <p className="text-text-muted text-sm">{date} · {user.name}</p>
        </div>
        <LogoutButton />
      </header>

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
