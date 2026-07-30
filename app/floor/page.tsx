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

      <Link href="/floor/checklist/start" className="block rounded-2xl bg-white border border-[#e4ddd4] p-5">
        <div className="flex items-center justify-between">
          <span className="font-medium text-charcoal">Start-of-Day checks</span>
          <span className="text-sm text-text-muted">{start.done}/{start.total}{view.day.startCompletedBy ? " ✓" : ""}</span>
        </div>
        {start.denyCount > 0 && <p className="text-sm text-amber-600 mt-1">{start.denyCount} denied</p>}
      </Link>

      {runsUnlocked ? (
        <Link href="/floor/runs" className="block rounded-2xl bg-copper text-white p-5 font-medium">
          Log production runs →
        </Link>
      ) : (
        <div className="rounded-2xl bg-[#f0e9e0] text-text-muted p-5 text-sm">
          Complete Start-of-Day checks to unlock run logging.
        </div>
      )}

      <Link href="/floor/checklist/end" className="block rounded-2xl bg-white border border-[#e4ddd4] p-5">
        <div className="flex items-center justify-between">
          <span className="font-medium text-charcoal">End-of-Day checks</span>
          <span className="text-sm text-text-muted">{end.done}/{end.total}{view.day.endCompletedBy ? " ✓" : ""}</span>
        </div>
      </Link>
    </div>
  );
}
