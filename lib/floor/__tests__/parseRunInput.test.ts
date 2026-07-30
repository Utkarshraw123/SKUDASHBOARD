import { describe, it, expect } from "vitest";
import { parseRunInput } from "../parseRunInput";

describe("parseRunInput", () => {
  it("coerces numeric fields and returns a clean RunInput", () => {
    const { input, errors } = parseRunInput({
      date: "2026-07-30", shift: "1", machineId: "2", operatorId: "3",
      productSku: "30000001", productDesc: "Iron", plannedQty: "100", actualQty: "90",
      startTime: "2026-07-30T06:00:00Z", endTime: "2026-07-30T10:00:00Z", downtimeMin: "5", comments: "",
    });
    expect(errors).toEqual([]);
    expect(input).toMatchObject({ machineId: 2, operatorId: 3, plannedQty: 100, actualQty: 90, downtimeMin: 5 });
  });

  it("returns validation errors for a bad body", () => {
    const { input, errors } = parseRunInput({ date: "", shift: "", machineId: 0, operatorId: 0, productSku: "" });
    expect(input).toBeUndefined();
    expect(errors.length).toBeGreaterThan(0);
  });
});
