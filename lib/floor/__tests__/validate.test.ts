import { describe, it, expect } from "vitest";
import { validateRunInput } from "../validate";
import type { RunInput } from "../types";

function input(p: Partial<RunInput> = {}): RunInput {
  return {
    date: "2026-07-30", shift: "1", machineId: 1, operatorId: 1,
    productSku: "30000001", productDesc: "X", plannedQty: 100, actualQty: 90,
    startTime: "2026-07-30T06:00:00Z", endTime: "2026-07-30T10:00:00Z",
    downtimeMin: 0, comments: null, ...p,
  };
}

describe("validateRunInput", () => {
  it("passes a well-formed run", () => expect(validateRunInput(input())).toEqual([]));
  it("requires date, shift, machine, operator, product", () => {
    const errs = validateRunInput(input({ date: "", shift: "", machineId: 0, operatorId: 0, productSku: "" }));
    expect(errs.length).toBeGreaterThanOrEqual(4);
  });
  it("rejects negatives and end<start", () => {
    expect(validateRunInput(input({ actualQty: -1 }))).toContain("Actual quantity must be 0 or more.");
    expect(validateRunInput(input({ plannedQty: -5 }))).toContain("Planned quantity must be 0 or more.");
    expect(validateRunInput(input({ downtimeMin: -1 }))).toContain("Downtime must be 0 or more.");
    expect(validateRunInput(input({ startTime: "2026-07-30T10:00:00Z", endTime: "2026-07-30T06:00:00Z" })))
      .toContain("End time must be after start time.");
  });
});
