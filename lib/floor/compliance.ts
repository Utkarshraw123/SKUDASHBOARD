import type { ChecklistItem, ReadinessCheck, ReadinessDay, Phase } from "./types";

export interface DayBundle {
  day: ReadinessDay;
  items: ChecklistItem[];
  checks: ReadinessCheck[];
}

export interface Deny {
  itemLabel: string;
  comment: string;
  critical: boolean;
}

export interface ComplianceDay {
  date: string;
  status: ReadinessDay["status"];
  startCompletedBy: number | null;
  startCompletedAt: string | null;
  startCrossCheckBy: number | null;
  endCompletedBy: number | null;
  endCompletedAt: string | null;
  endCrossCheckBy: number | null;
  total: number;
  startAnswered: number;
  endAnswered: number;
  startDenies: Deny[];
  endDenies: Deny[];
  hasDeny: boolean;
}

function deniesFor(items: ChecklistItem[], checks: ReadinessCheck[], phase: Phase): Deny[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return checks
    .filter((c) => c.phase === phase && c.result === "deny")
    .map((c) => ({
      itemLabel: byId.get(c.itemId)?.label ?? `#${c.itemId}`,
      comment: c.comment ?? "",
      critical: byId.get(c.itemId)?.critical ?? false,
    }));
}

function answered(checks: ReadinessCheck[], phase: Phase): number {
  return new Set(checks.filter((c) => c.phase === phase).map((c) => c.itemId)).size;
}

export function summarizeCompliance(bundles: DayBundle[]): ComplianceDay[] {
  return bundles
    .map(({ day, items, checks }) => {
      const startDenies = deniesFor(items, checks, "start");
      const endDenies = deniesFor(items, checks, "end");
      return {
        date: day.date,
        status: day.status,
        startCompletedBy: day.startCompletedBy,
        startCompletedAt: day.startCompletedAt,
        startCrossCheckBy: day.startCrossCheckBy,
        endCompletedBy: day.endCompletedBy,
        endCompletedAt: day.endCompletedAt,
        endCrossCheckBy: day.endCrossCheckBy,
        total: items.length,
        startAnswered: answered(checks, "start"),
        endAnswered: answered(checks, "end"),
        startDenies,
        endDenies,
        hasDeny: startDenies.length + endDenies.length > 0,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
