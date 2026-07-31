import type { ChecklistItem, ReadinessCheck, ReadinessDay, Phase, CheckResult } from "./types";

export interface ChecklistProgress {
  done: number;
  total: number;
  denyCount: number;
  complete: boolean;
}

export function checklistProgress(
  items: ChecklistItem[],
  checks: ReadinessCheck[],
  phase: Phase,
): ChecklistProgress {
  const phaseChecks = checks.filter((c) => c.phase === phase);
  const answered = new Set(phaseChecks.map((c) => c.itemId));
  const denyCount = phaseChecks.filter((c) => c.result === "deny").length;
  const done = items.filter((i) => answered.has(i.id)).length;
  return { done, total: items.length, denyCount, complete: done === items.length && items.length > 0 };
}

export function validateCheckResult(result: CheckResult, comment: string): string | null {
  if (result === "deny" && comment.trim() === "") {
    return "A comment is required when denying an item.";
  }
  return null;
}

export function phaseComplete(items: ChecklistItem[], checks: ReadinessCheck[], phase: Phase): boolean {
  return checklistProgress(items, checks, phase).complete;
}

// Runs may be logged once the Start phase is signed off by a supervisor.
// (No second approval / cross-check is required — one supervisor completing the
// Start-of-Day checklist is sufficient. Changed 2026-07-31 per user request.)
export function canLogRuns(day: ReadinessDay): boolean {
  return day.startCompletedBy != null;
}
