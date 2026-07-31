import { describe, it, expect } from "vitest";
import { reportsOnDate } from "../internal-yield";
import type { YieldReport } from "../internal-yield";

function rpt(id: string, dateISO: string): YieldReport {
  return {
    reportId: id, timestamp: `${dateISO}T10:00:00.000Z`, dateISO, dateLabel: "",
    workOrder: "WO" + id, sku: "", description: "", productType: "",
    productBatches: [], productBBDs: [], made: 0, people: 0, woStatus: "",
    ancWaste: { jars: 0, lids: 0, labels: 0, box: 0, pouches: 0, desiccants: 0 },
    ancPct: { jars: 0, lids: 0, labels: 0, box: 0, pouches: 0, desiccants: 0 },
    blendedPct: 0, disposalNumber: "", comments: "", bulks: [],
    totalCapsulesWasted: 0, totalAncillaryWasted: 0,
  };
}

describe("reportsOnDate", () => {
  const reports = [rpt("a", "2026-07-31"), rpt("b", "2026-07-30"), rpt("c", "2026-07-31")];
  it("returns only reports whose dateISO matches", () => {
    expect(reportsOnDate(reports, "2026-07-31").map((r) => r.reportId)).toEqual(["a", "c"]);
  });
  it("returns an empty array when nothing matches", () => {
    expect(reportsOnDate(reports, "2026-07-29")).toEqual([]);
  });
});
