import { describe, it, expect } from "vitest";
import { aggregateByOperator, aggregateByMachine } from "../appraisals";
import type { Run } from "../types";

function run(p: Partial<Run>): Run {
  return {
    id: 1, date: "2026-07-30", shift: "1", machineId: 1, operatorId: 1,
    productSku: "X", productDesc: "X", plannedQty: 100, actualQty: 90,
    startTime: "2026-07-30T06:00:00Z", endTime: "2026-07-30T10:00:00Z",
    downtimeMin: 0, comments: null, loggedBy: 1, createdAt: "", updatedAt: "",
    void: false, voidReason: null, voidedBy: null, voidedAt: null, ...p,
  };
}

describe("aggregateByOperator", () => {
  it("sums output/downtime, derives efficiency, counts distinct days, excludes voids", () => {
    const runs = [
      run({ id: 1, operatorId: 10, date: "2026-07-30", actualQty: 90, plannedQty: 100, downtimeMin: 10 }),
      run({ id: 2, operatorId: 10, date: "2026-07-31", actualQty: 60, plannedQty: 100, downtimeMin: 5 }),
      run({ id: 3, operatorId: 20, date: "2026-07-30", actualQty: 40, plannedQty: 50 }),
      run({ id: 4, operatorId: 10, date: "2026-07-30", actualQty: 999, plannedQty: 999, void: true }),
    ];
    const rows = aggregateByOperator(runs);
    const op10 = rows.find((r) => r.operatorId === 10)!;
    expect(op10.runCount).toBe(2);
    expect(op10.totalActual).toBe(150);
    expect(op10.totalPlanned).toBe(200);
    expect(op10.efficiency).toBeCloseTo(0.75);
    expect(op10.totalDowntimeMin).toBe(15);
    expect(op10.daysWorked).toBe(2);
    expect(rows.length).toBe(2);
  });
});

describe("aggregateByMachine", () => {
  it("groups by machine and derives efficiency", () => {
    const runs = [
      run({ id: 1, machineId: 5, actualQty: 90, plannedQty: 100 }),
      run({ id: 2, machineId: 5, actualQty: 80, plannedQty: 100 }),
      run({ id: 3, machineId: 6, actualQty: 10, plannedQty: 40 }),
    ];
    const rows = aggregateByMachine(runs);
    expect(rows.find((r) => r.machineId === 5)!.efficiency).toBeCloseTo(170 / 200);
    expect(rows.find((r) => r.machineId === 6)!.totalActual).toBe(10);
  });
});
