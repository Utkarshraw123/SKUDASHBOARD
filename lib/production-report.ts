// Production report types + pure wastage math (no I/O, unit-testable)

export interface ProductionReportInput {
  workOrder: string;
  sku: string;
  description: string;
  productBatch: string;
  productBBD: string;
  bulkCode: string;
  bulkDescription: string;
  bulkBatch: string;
  bulkBBD: string;
  used: number;        // bulk capsules consumed
  made: number;        // units produced
  people: number;
  woStatus: string;    // "complete" | "partial" | ...
  waste: {
    capsules: number;
    jars: number;
    lids: number;
    labels: number;
    box: number;
    pouches: number;
    desiccants: number;
  };
}

export interface WastageResult {
  capsulesPct: number;
  jarsPct: number;
  lidsPct: number;
  labelsPct: number;
  boxPct: number;
  pouchesPct: number;
  desiccantsPct: number;
  blendedPct: number;
}

function pct(n: number): number {
  return Math.round(n * 10000) / 10000; // 4 dp, e.g. 0.0654 (%)
}

/**
 * Capsule/bulk wastage % = capsuleWaste / used.
 * Ancillary wastage %     = partWaste / (made + partWaste).
 * Blended                 = mean of the part percentages over parts actually consumed
 *                           (used>0 for capsules, or made+waste>0 for ancillaries).
 * All results are percentages (e.g. 0.065 means 0.065%).
 */
export function computeWastage(input: ProductionReportInput): WastageResult {
  const { used, made, waste } = input;

  const capsulesPct = used > 0 ? pct((waste.capsules / used) * 100) : 0;

  const anc = (w: number) => (made + w > 0 ? pct((w / (made + w)) * 100) : 0);
  const jarsPct = anc(waste.jars);
  const lidsPct = anc(waste.lids);
  const labelsPct = anc(waste.labels);
  const boxPct = anc(waste.box);
  const pouchesPct = anc(waste.pouches);
  const desiccantsPct = anc(waste.desiccants);

  // Blended: average of the parts that were actually part of this production.
  const parts: { pctVal: number; consumed: boolean }[] = [
    { pctVal: capsulesPct, consumed: used > 0 },
    { pctVal: jarsPct, consumed: made + waste.jars > 0 },
    { pctVal: lidsPct, consumed: made + waste.lids > 0 },
    { pctVal: labelsPct, consumed: made + waste.labels > 0 },
    { pctVal: boxPct, consumed: made + waste.box > 0 },
    { pctVal: pouchesPct, consumed: made + waste.pouches > 0 },
    { pctVal: desiccantsPct, consumed: made + waste.desiccants > 0 },
  ];
  const active = parts.filter(p => p.consumed);
  const blendedPct = active.length > 0 ? pct(active.reduce((s, p) => s + p.pctVal, 0) / active.length) : 0;

  return { capsulesPct, jarsPct, lidsPct, labelsPct, boxPct, pouchesPct, desiccantsPct, blendedPct };
}

export const REPORT_HEADERS = [
  "Timestamp", "Work Order", "SKU", "Description",
  "Product Batch", "Product BBD", "Bulk Code", "Bulk Description", "Bulk Batch", "Bulk BBD",
  "Used", "Made", "People", "WO Status",
  "Waste Capsules", "Waste Jars", "Waste Lids", "Waste Labels", "Waste Box", "Waste Pouches", "Waste Desiccants",
  "Capsule Waste %", "Jars Waste %", "Lids Waste %", "Labels Waste %", "Box Waste %", "Pouches Waste %", "Desiccants Waste %",
  "Blended Waste %",
];

export function reportToRow(input: ProductionReportInput, w: WastageResult): (string | number)[] {
  return [
    new Date().toISOString(),
    input.workOrder, input.sku, input.description,
    input.productBatch, input.productBBD, input.bulkCode, input.bulkDescription, input.bulkBatch, input.bulkBBD,
    input.used, input.made, input.people, input.woStatus,
    input.waste.capsules, input.waste.jars, input.waste.lids, input.waste.labels, input.waste.box, input.waste.pouches, input.waste.desiccants,
    w.capsulesPct, w.jarsPct, w.lidsPct, w.labelsPct, w.boxPct, w.pouchesPct, w.desiccantsPct,
    w.blendedPct,
  ];
}
