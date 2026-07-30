import { describe, it, expect } from "vitest";
import { checklistProgress, validateCheckResult, phaseComplete, canLogRuns } from "../checklist";
import type { ChecklistItem, ReadinessCheck, ReadinessDay } from "../types";

const items: ChecklistItem[] = [
  { id: 1, sortOrder: 1, category: "Env", label: "A", critical: false },
  { id: 2, sortOrder: 2, category: "Env", label: "B", critical: true },
];
function check(p: Partial<ReadinessCheck>): ReadinessCheck {
  return { itemId: 1, phase: "start", result: "confirm", comment: null, checkedBy: 1, checkedAt: "", ...p };
}

describe("checklistProgress", () => {
  it("counts done/total and flags denies + missing-critical", () => {
    const checks = [check({ itemId: 1, result: "deny", comment: "x" })];
    const p = checklistProgress(items, checks, "start");
    expect(p.done).toBe(1);
    expect(p.total).toBe(2);
    expect(p.denyCount).toBe(1);
    expect(p.complete).toBe(false);
  });
  it("is complete when every item has a result for the phase", () => {
    const checks = [check({ itemId: 1 }), check({ itemId: 2 })];
    expect(checklistProgress(items, checks, "start").complete).toBe(true);
  });
  it("ignores checks from the other phase", () => {
    const checks = [check({ itemId: 1, phase: "end" }), check({ itemId: 2, phase: "end" })];
    expect(checklistProgress(items, checks, "start").done).toBe(0);
  });
});

describe("validateCheckResult", () => {
  it("requires a comment on deny", () => {
    expect(validateCheckResult("deny", "")).toBe("A comment is required when denying an item.");
    expect(validateCheckResult("deny", "spill")).toBeNull();
    expect(validateCheckResult("confirm", "")).toBeNull();
  });
});

describe("phaseComplete / canLogRuns", () => {
  it("phaseComplete mirrors progress.complete", () => {
    const checks = [check({ itemId: 1 }), check({ itemId: 2 })];
    expect(phaseComplete(items, checks, "start")).toBe(true);
  });
  it("canLogRuns true only when start phase is completed on the day", () => {
    const open: ReadinessDay = {
      id: 1, date: "2026-07-30", templateId: 1, startCompletedBy: null, startCompletedAt: null,
      startCrossCheckBy: null, endCompletedBy: null, endCompletedAt: null, endCrossCheckBy: null, status: "open",
    };
    expect(canLogRuns(open)).toBe(false);
    expect(canLogRuns({ ...open, startCompletedBy: 1, startCrossCheckBy: 2, status: "started" })).toBe(true);
  });
});
