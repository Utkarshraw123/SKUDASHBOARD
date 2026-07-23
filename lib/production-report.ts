// Production report types + pure wastage math (no I/O, unit-testable)

export type ProductType = "jars" | "refills" | "daily_essentials" | "powders";

export const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: "jars", label: "Jars" },
  { value: "refills", label: "Refills" },
  { value: "daily_essentials", label: "Daily Essentials" },
  { value: "powders", label: "Powders" },
];

// Derive the FG product type from its description (specific keywords before generic).
export function deriveProductType(description: string): ProductType | "" {
  const d = (description ?? "").toLowerCase();
  if (d.includes("daily essential")) return "daily_essentials";
  if (d.includes("powder")) return "powders";
  if (d.includes("refill")) return "refills";
  if (d.includes("jar")) return "jars";
  return "";
}

// Validate a typed BBD. Empty is allowed; non-empty must be a real DD/MM/YYYY date.
export function isValidDMY(s: string): boolean {
  const t = (s ?? "").trim();
  if (!t) return true;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (!m) return false;
  const dd = +m[1], mm = +m[2], yyyy = +m[3];
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
}

// A finished-good batch produced on the work order.
export interface ProductBatchEntry {
  batch: string;
  bbd: string;
}

// One bulk consumed to make the finished good. Daily Essentials can use 3-4.
export interface BulkEntry {
  bulkCode: string;
  bulkDescription: string;
  bulkBatch: string;
  bulkBBD: string;
  used: number;          // bulk capsules consumed FROM THIS BULK
  wasteCapsules: number; // capsules wasted FROM THIS BULK
}

export interface ProductionReportInput {
  workOrder: string;
  sku: string;
  description: string;
  productType: string;
  batches: ProductBatchEntry[];  // one or more finished-good batches
  bulks: BulkEntry[];            // one or more bulks (per-bulk used + waste)
  made: number;                 // finished units produced (report-level)
  people: number;
  woStatus: string;             // "complete" | "partial" | ...
  // Ancillary waste is tied to the finished units (report-level, not per bulk).
  ancWaste: {
    jars: number;
    lids: number;
    labels: number;
    box: number;
    pouches: number;
    desiccants: number;
  };
  disposalNumber: string;       // ERP disposal reference for this WO's waste
  comments: string;
}

export interface WastageResult {
  bulkCapsulesPct: number[]; // aligned 1:1 with input.bulks
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
 * Per-bulk capsule wastage % = capsuleWaste / used.
 * Ancillary wastage %        = partWaste / (made + partWaste).
 * Blended                    = QUANTITY-WEIGHTED average of every active part %,
 *                              each weighted by the quantity it was measured
 *                              against (bulk → used caps; ancillary → made+waste).
 *                              A part with tiny throughput can't skew the blend;
 *                              algebraically this equals 100 × Σwaste ÷ Σbase over
 *                              active parts. All results are percentages.
 */
export function computeWastage(input: ProductionReportInput): WastageResult {
  const { made, bulks, ancWaste } = input;

  const bulkCapsulesPct = bulks.map(b => (b.used > 0 ? pct((b.wasteCapsules / b.used) * 100) : 0));

  const anc = (w: number) => (made + w > 0 ? pct((w / (made + w)) * 100) : 0);
  const jarsPct = anc(ancWaste.jars);
  const lidsPct = anc(ancWaste.lids);
  const labelsPct = anc(ancWaste.labels);
  const boxPct = anc(ancWaste.box);
  const pouchesPct = anc(ancWaste.pouches);
  const desiccantsPct = anc(ancWaste.desiccants);

  // Blended: quantity-weighted mean of every part actually part of this production.
  // weight = the % denominator (bulk: used; ancillary: made + waste).
  let weightedSum = 0;
  let totalWeight = 0;
  const add = (pctVal: number, weight: number) => {
    if (weight > 0) { weightedSum += pctVal * weight; totalWeight += weight; }
  };
  bulks.forEach((b, i) => add(bulkCapsulesPct[i], b.used));
  add(jarsPct, made + ancWaste.jars);
  add(lidsPct, made + ancWaste.lids);
  add(labelsPct, made + ancWaste.labels);
  add(boxPct, made + ancWaste.box);
  add(pouchesPct, made + ancWaste.pouches);
  add(desiccantsPct, made + ancWaste.desiccants);

  const blendedPct = totalWeight > 0 ? pct(weightedSum / totalWeight) : 0;

  return { bulkCapsulesPct, jarsPct, lidsPct, labelsPct, boxPct, pouchesPct, desiccantsPct, blendedPct };
}

// Header schema. Columns A..AC (index 0..28) are UNCHANGED from the original
// single-row layout so existing rows and the performance read stay valid.
// Columns AD..AH (index 29..33) are appended for the new fields.
export const REPORT_HEADERS = [
  "Timestamp", "Work Order", "SKU", "Description",
  "Product Batch", "Product BBD", "Bulk Code", "Bulk Description", "Bulk Batch", "Bulk BBD",
  "Used", "Made", "People", "WO Status",
  "Waste Capsules", "Waste Jars", "Waste Lids", "Waste Labels", "Waste Box", "Waste Pouches", "Waste Desiccants",
  "Capsule Waste %", "Jars Waste %", "Lids Waste %", "Labels Waste %", "Box Waste %", "Pouches Waste %", "Desiccants Waste %",
  "Blended Waste %",
  "Product Type", "Disposal Number", "Comments", "Report ID", "Bulk Seq",
];

/**
 * One row PER BULK. The first bulk row carries the report-level fields
 * (product batches, made, people, ancillary waste, blended %); subsequent
 * bulk rows leave those blank so column sums don't double-count. Every row
 * shares the same Report ID and a "1/3"-style Bulk Seq for grouping.
 */
export function reportToRows(input: ProductionReportInput, w: WastageResult): (string | number)[][] {
  const ts = new Date().toISOString();
  const reportId = `${input.workOrder || "WO"}-${Date.now()}`;
  const batchesJoined = input.batches.map(b => b.batch).filter(s => s.trim() !== "").join(" | ");
  const bbdsJoined = input.batches.map(b => b.bbd).filter(s => s.trim() !== "").join(" | ");
  const n = input.bulks.length;

  return input.bulks.map((bk, i) => {
    const first = i === 0;
    const capPct = w.bulkCapsulesPct[i] ?? 0;
    return [
      ts,
      input.workOrder, input.sku, input.description,
      first ? batchesJoined : "", first ? bbdsJoined : "",
      bk.bulkCode, bk.bulkDescription, bk.bulkBatch, bk.bulkBBD,
      bk.used,                                   // Used (this bulk)
      first ? input.made : "",                   // Made (report-level)
      first ? input.people : "",                 // People
      input.woStatus,                            // WO Status
      bk.wasteCapsules,                          // Waste Capsules (this bulk)
      first ? input.ancWaste.jars : "",
      first ? input.ancWaste.lids : "",
      first ? input.ancWaste.labels : "",
      first ? input.ancWaste.box : "",
      first ? input.ancWaste.pouches : "",
      first ? input.ancWaste.desiccants : "",
      capPct,                                    // Capsule Waste % (this bulk)
      first ? w.jarsPct : "",
      first ? w.lidsPct : "",
      first ? w.labelsPct : "",
      first ? w.boxPct : "",
      first ? w.pouchesPct : "",
      first ? w.desiccantsPct : "",
      first ? w.blendedPct : "",                 // Blended Waste % (report-level)
      input.productType,                         // Product Type
      input.disposalNumber,                      // Disposal Number
      input.comments,                            // Comments
      reportId,                                  // Report ID
      `${i + 1}/${n}`,                           // Bulk Seq
    ];
  });
}
