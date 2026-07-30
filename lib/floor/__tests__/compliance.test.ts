import { describe, it, expect } from "vitest";
import { summarizeCompliance, type DayBundle } from "../compliance";
import type { ChecklistItem, ReadinessCheck, ReadinessDay } from "../types";

const items: ChecklistItem[] = [
  { id: 1, sortOrder: 1, category: "Env", label: "Area clear", critical: false },
  { id: 2, sortOrder: 2, category: "Env", label: "Pest-free", critical: true },
];
function day(p: Partial<ReadinessDay>): ReadinessDay {
  return { id: 1, date: "2026-07-30", templateId: 1, startCompletedBy: null, startCompletedAt: null,
    startCrossCheckBy: null, endCompletedBy: null, endCompletedAt: null, endCrossCheckBy: null, status: "open", ...p };
}
function check(p: Partial<ReadinessCheck>): ReadinessCheck {
  return { itemId: 1, phase: "start", result: "confirm", comment: null, checkedBy: 1, checkedAt: "", ...p };
}

describe("summarizeCompliance", () => {
  it("reports signers, answered counts, and surfaces denies with comments", () => {
    const bundles: DayBundle[] = [{
      day: day({ startCompletedBy: 1, startCrossCheckBy: 2, status: "started" }),
      items,
      checks: [
        check({ itemId: 1, phase: "start", result: "confirm" }),
        check({ itemId: 2, phase: "start", result: "deny", comment: "droppings seen" }),
      ],
    }];
    const [row] = summarizeCompliance(bundles);
    expect(row.date).toBe("2026-07-30");
    expect(row.startCompletedBy).toBe(1);
    expect(row.startCrossCheckBy).toBe(2);
    expect(row.startAnswered).toBe(2);
    expect(row.total).toBe(2);
    expect(row.endAnswered).toBe(0);
    expect(row.startDenies).toEqual([{ itemLabel: "Pest-free", comment: "droppings seen", critical: true }]);
    expect(row.hasDeny).toBe(true);
  });

  it("orders rows by date descending", () => {
    const rows = summarizeCompliance([
      { day: day({ date: "2026-07-29" }), items, checks: [] },
      { day: day({ date: "2026-07-31" }), items, checks: [] },
    ]);
    expect(rows.map((r) => r.date)).toEqual(["2026-07-31", "2026-07-29"]);
  });
});
