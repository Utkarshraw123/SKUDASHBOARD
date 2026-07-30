import { requireUser } from "@/lib/auth/require";
import { getDayChecks } from "@/lib/floor/readinessRepo";
import { canLogRuns } from "@/lib/floor/checklist";
import RunLogger from "@/components/floor/RunLogger";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  await requireUser();
  const date = new Date().toISOString().slice(0, 10);
  const view = await getDayChecks(date);
  if (!canLogRuns(view.day)) {
    return (
      <div className="min-h-full p-6 max-w-md mx-auto space-y-4">
        <p className="text-text-muted">Start-of-Day checks must be completed before logging runs.</p>
        <Link href="/floor/checklist/start" className="text-copper underline">Go to Start-of-Day checks</Link>
      </div>
    );
  }
  return <RunLogger date={date} />;
}
