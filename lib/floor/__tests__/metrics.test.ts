import { describe, it, expect } from "vitest";
import { efficiency, effectiveHours, throughput, summarizeRuns } from "../metrics";
import type { Run } from "../types";

function run(partial: Partial<Run>): Run {
  return {
    id: 1, date: "2026-07-30", shift: "1", machineId: 1, operatorId: 1,
    productSku: "30000001", productDesc: "X", plannedQty: 100, actualQty: 90,
    startTime: "2026-07-30T06:00:00Z", endTime: "2026-07-30T10:00:00Z",
    downtimeMin: 0, comments: null, loggedBy: 1,
    createdAt: "", updatedAt: "", void: false,
    voidReason: null, voidedBy: null, voidedAt: null, ...partial,
  };
}

describe("efficiency", () => {
  it("is actual/planned", () => expect(efficiency(90, 100)).toBeCloseTo(0.9));
  it("is null when planned is 0 or missing", () => {
    expect(efficiency(90, 0)).toBeNull();
    expect(efficiency(90, null)).toBeNull();
    expect(efficiency(null, 100)).toBeNull();
  });
});

describe("effectiveHours", () => {
  it("subtracts downtime from elapsed", () => {
    expect(effectiveHours("2026-07-30T06:00:00Z", "2026-07-30T10:00:00Z", 30)).toBeCloseTo(3.5);
  });
  it("is null when times missing or end < start", () => {
    expect(effectiveHours(null, "2026-07-30T10:00:00Z", 0)).toBeNull();
    expect(effectiveHours("2026-07-30T10:00:00Z", "2026-07-30T06:00:00Z", 0)).toBeNull();
  });
});

describe("throughput", () => {
  it("is actual per effective hour", () => {
    expect(throughput(350, "2026-07-30T06:00:00Z", "2026-07-30T10:00:00Z", 30)).toBeCloseTo(100);
  });
  it("is null when effective hours is 0 or null", () => {
    expect(throughput(350, "2026-07-30T06:00:00Z", "2026-07-30T06:00:00Z", 0)).toBeNull();
  });
});

describe("summarizeRuns", () => {
  it("excludes void runs and totals per operator", () => {
    const runs = [
      run({ id: 1, operatorId: 10, actualQty: 90, plannedQty: 100, downtimeMin: 10 }),
      run({ id: 2, operatorId: 20, actualQty: 40, plannedQty: 50, downtimeMin: 5 }),
      run({ id: 3, operatorId: 10, actualQty: 999, plannedQty: 999, void: true }),
    ];
    const t = summarizeRuns(runs);
    expect(t.runCount).toBe(2);
    expect(t.totalActual).toBe(130);
    expect(t.totalPlanned).toBe(150);
    expect(t.avgEfficiency).toBeCloseTo(130 / 150);
    expect(t.totalDowntimeMin).toBe(15);
    expect(t.perOperator.find((p) => p.operatorId === 10)!.actual).toBe(90);
  });
});
