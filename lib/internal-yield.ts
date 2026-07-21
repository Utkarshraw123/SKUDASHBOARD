// Internal Production Yield — pure engine (no I/O, unit-testable).
// Turns raw Production Report rows (Reports tab, cols A..AH) into the in-dashboard
// yield/wastage model: full line items, and wastage rolled up by work order, week,
// month and individual ancillary type, plus a batch-level compliance trace.
//
// Row schema (0-based), one row PER BULK; the primary row (Made populated) carries
// the report-level fields, secondary bulk rows repeat WO/SKU + their own bulk detail:
//  0 Timestamp 1 WorkOrder 2 SKU 3 Description 4 ProductBatch 5 ProductBBD
//  6 BulkCode 7 BulkDescription 8 BulkBatch 9 BulkBBD 10 Used 11 Made 12 People
//  13 WOStatus 14 WasteCapsules 15 WasteJars 16 WasteLids 17 WasteLabels 18 WasteBox
//  19 WastePouches 20 WasteDesiccants 21 CapsuleWaste% 22 JarsWaste% 23 LidsWaste%
//  24 LabelsWaste% 25 BoxWaste% 26 PouchesWaste% 27 DesiccantsWaste% 28 BlendedWaste%
//  29 ProductType 30 DisposalNumber 31 Comments 32 ReportID 33 BulkSeq

export const ANCILLARY_KEYS = ["jars", "lids", "labels", "box", "pouches", "desiccants"] as const;
export type AncillaryKey = (typeof ANCILLARY_KEYS)[number];

export const ANCILLARY_LABELS: Record<AncillaryKey, string> = {
  jars: "Jars", lids: "Lids", labels: "Labels", box: "Boxes", pouches: "Pouches", desiccants: "Desiccants",
};

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(/[,£%\s]/g, ""));
  return isNaN(n) ? 0 : n;
}
function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}
function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

// ---- Parsed structures -----------------------------------------------------

export interface ReportBulk {
  bulkCode: string;
  bulkDescription: string;
  bulkBatch: string;
  bulkBBD: string;
  used: number;
  wasteCapsules: number;
  capsuleWastePct: number;
}

export interface YieldReport {
  reportId: string;
  timestamp: string;
  dateISO: string;        // YYYY-MM-DD (from timestamp), "" if unparseable
  dateLabel: string;      // DD/MM/YYYY
  workOrder: string;
  sku: string;
  description: string;
  productType: string;
  productBatches: string[];
  productBBDs: string[];
  made: number;
  people: number;
  woStatus: string;
  ancWaste: Record<AncillaryKey, number>;
  ancPct: Record<AncillaryKey, number>;
  blendedPct: number;
  disposalNumber: string;
  comments: string;
  bulks: ReportBulk[];
  totalCapsulesWasted: number;
  totalAncillaryWasted: number;
}

export interface WoYield {
  workOrder: string;
  sku: string;
  description: string;
  productType: string;
  reports: number;
  made: number;
  capsulesWasted: number;
  ancillaryWasted: number;
  blendedPct: number;      // made-weighted
  disposalNumbers: string[];
  lastDateLabel: string;
}

export interface PeriodYield {
  key: string;             // sortable, e.g. "2026-W29" or "2026-07"
  label: string;           // display, e.g. "W29 · 2026" or "Jul 2026"
  reports: number;
  made: number;
  capsulesWasted: number;
  ancillaryWasted: number;
  blendedPct: number;      // made-weighted
}

export interface AncillaryYield {
  key: AncillaryKey;
  label: string;
  wasted: number;          // total units scrapped
  base: number;            // total (made + wasted) across reports that used it
  wastePct: number;        // 100 * wasted / base  (precise, not an average of %s)
}

export interface BatchTraceRow {
  dateLabel: string;
  workOrder: string;
  sku: string;
  description: string;
  productType: string;
  productBatch: string;
  productBBD: string;
  bulkCode: string;
  bulkDescription: string;
  bulkBatch: string;
  bulkBBD: string;
  made: number;
  used: number;
  wasteCapsules: number;
  capsuleWastePct: number;
  disposalNumber: string;
}

export interface InternalYield {
  reports: YieldReport[];        // newest first
  byWorkOrder: WoYield[];        // worst wastage first
  byWeek: PeriodYield[];         // chronological
  byMonth: PeriodYield[];        // chronological
  byAncillary: AncillaryYield[]; // worst wastage first
  batches: BatchTraceRow[];      // one per bulk line, newest first (compliance trace)
  summary: {
    reports: number;
    workOrders: number;
    totalOutput: number;
    overallBlendedPct: number;   // made-weighted across all reports
    capsulesWasted: number;
    ancillaryWasted: number;
    lastDateLabel: string;
  };
}

// ---- Date helpers ----------------------------------------------------------

function parseTs(ts: string): Date | null {
  if (!ts) return null;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function ddmmyyyy(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
// ISO-8601 week number + ISO week-year.
function isoWeek(d: Date): { key: string; label: string } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday of this week
  const year = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(
    ((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
  );
  return { key: `${year}-W${String(week).padStart(2, "0")}`, label: `W${week} · ${year}` };
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthOf(d: Date): { key: string; label: string } {
  return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
}

// Made-weighted mean of report blended %s.
function weightedBlended(reports: { blendedPct: number; made: number }[]): number {
  let ws = 0, w = 0;
  for (const r of reports) { if (r.made > 0) { ws += r.blendedPct * r.made; w += r.made; } }
  return w > 0 ? round(ws / w) : 0;
}

// ---- Grouping raw rows into reports ----------------------------------------

export function parseReports(rows: (string | number)[][]): YieldReport[] {
  // group by Report ID; legacy rows (no ID) key on WO + timestamp.
  const groups = new Map<string, (string | number)[][]>();
  for (const r of rows) {
    const wo = str(r[1]);
    if (!wo) continue; // skip blank/header-ish rows
    const id = str(r[32]) || `${wo}|${str(r[0])}`;
    (groups.get(id) ?? groups.set(id, []).get(id)!).push(r);
  }

  const reports: YieldReport[] = [];
  groups.forEach((lines, id) => {
    // primary row = Made populated; fall back to first line.
    const primary = lines.find(r => str(r[11]) !== "") ?? lines[0];
    const d = parseTs(str(primary[0]));
    const made = num(primary[11]);

    const bulks: ReportBulk[] = lines
      .filter(r => str(r[6]) !== "") // has a bulk code
      .map(r => ({
        bulkCode: str(r[6]),
        bulkDescription: str(r[7]),
        bulkBatch: str(r[8]),
        bulkBBD: str(r[9]),
        used: num(r[10]),
        wasteCapsules: num(r[14]),
        capsuleWastePct: num(r[21]),
      }));

    const ancWaste = {
      jars: num(primary[15]), lids: num(primary[16]), labels: num(primary[17]),
      box: num(primary[18]), pouches: num(primary[19]), desiccants: num(primary[20]),
    } as Record<AncillaryKey, number>;
    const ancPct = {
      jars: num(primary[22]), lids: num(primary[23]), labels: num(primary[24]),
      box: num(primary[25]), pouches: num(primary[26]), desiccants: num(primary[27]),
    } as Record<AncillaryKey, number>;

    reports.push({
      reportId: id,
      timestamp: str(primary[0]),
      dateISO: d ? isoDate(d) : "",
      dateLabel: d ? ddmmyyyy(d) : "",
      workOrder: str(primary[1]),
      sku: str(primary[2]),
      description: str(primary[3]),
      productType: str(primary[29]),
      productBatches: str(primary[4]).split("|").map(s => s.trim()).filter(Boolean),
      productBBDs: str(primary[5]).split("|").map(s => s.trim()).filter(Boolean),
      made,
      people: num(primary[12]),
      woStatus: str(primary[13]),
      ancWaste,
      ancPct,
      blendedPct: num(primary[28]),
      disposalNumber: str(primary[30]),
      comments: str(primary[31]),
      bulks,
      totalCapsulesWasted: bulks.reduce((s, b) => s + b.wasteCapsules, 0),
      totalAncillaryWasted: ANCILLARY_KEYS.reduce((s, k) => s + ancWaste[k], 0),
    });
  });

  // newest first
  reports.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return reports;
}

// ---- Aggregations ----------------------------------------------------------

export function computeInternalYield(rows: (string | number)[][]): InternalYield {
  const reports = parseReports(rows);

  // By work order
  const woMap = new Map<string, YieldReport[]>();
  for (const r of reports) (woMap.get(r.workOrder) ?? woMap.set(r.workOrder, []).get(r.workOrder)!).push(r);
  const byWorkOrder: WoYield[] = [];
  woMap.forEach((rs, wo) => {
    const first = rs[0];
    byWorkOrder.push({
      workOrder: wo,
      sku: first.sku,
      description: first.description,
      productType: first.productType,
      reports: rs.length,
      made: rs.reduce((s, r) => s + r.made, 0),
      capsulesWasted: rs.reduce((s, r) => s + r.totalCapsulesWasted, 0),
      ancillaryWasted: rs.reduce((s, r) => s + r.totalAncillaryWasted, 0),
      blendedPct: weightedBlended(rs),
      disposalNumbers: Array.from(new Set(rs.map(r => r.disposalNumber).filter(Boolean))),
      lastDateLabel: rs.map(r => r.dateLabel).filter(Boolean).sort().reverse()[0] ?? "",
    });
  });
  byWorkOrder.sort((a, b) => b.blendedPct - a.blendedPct);

  // By period (week / month)
  const periodAgg = (keyer: (d: Date) => { key: string; label: string }): PeriodYield[] => {
    const map = new Map<string, { label: string; rs: YieldReport[] }>();
    for (const r of reports) {
      const d = parseTs(r.timestamp);
      if (!d) continue;
      const { key, label } = keyer(d);
      const g = map.get(key) ?? map.set(key, { label, rs: [] }).get(key)!;
      g.rs.push(r);
    }
    const out: PeriodYield[] = [];
    map.forEach(({ label, rs }, key) => {
      out.push({
        key, label,
        reports: rs.length,
        made: rs.reduce((s, r) => s + r.made, 0),
        capsulesWasted: rs.reduce((s, r) => s + r.totalCapsulesWasted, 0),
        ancillaryWasted: rs.reduce((s, r) => s + r.totalAncillaryWasted, 0),
        blendedPct: weightedBlended(rs),
      });
    });
    out.sort((a, b) => a.key.localeCompare(b.key)); // chronological
    return out;
  };
  const byWeek = periodAgg(isoWeek);
  const byMonth = periodAgg(monthOf);

  // By ancillary type — precise pooled %: 100 * Σwaste / Σ(made + waste)
  const byAncillary: AncillaryYield[] = ANCILLARY_KEYS.map(k => {
    let wasted = 0, base = 0;
    for (const r of reports) {
      const w = r.ancWaste[k];
      if (w > 0 || r.made > 0) { wasted += w; base += r.made + w; }
    }
    return { key: k, label: ANCILLARY_LABELS[k], wasted, base, wastePct: base > 0 ? round((wasted / base) * 100) : 0 };
  }).sort((a, b) => b.wastePct - a.wastePct);

  // Batch trace (one row per bulk line) — compliance
  const batches: BatchTraceRow[] = [];
  for (const r of reports) {
    const pBatch = r.productBatches.join(" | ");
    const pBBD = r.productBBDs.join(" | ");
    for (const b of r.bulks) {
      batches.push({
        dateLabel: r.dateLabel,
        workOrder: r.workOrder,
        sku: r.sku,
        description: r.description,
        productType: r.productType,
        productBatch: pBatch,
        productBBD: pBBD,
        bulkCode: b.bulkCode,
        bulkDescription: b.bulkDescription,
        bulkBatch: b.bulkBatch,
        bulkBBD: b.bulkBBD,
        made: r.made,
        used: b.used,
        wasteCapsules: b.wasteCapsules,
        capsuleWastePct: b.capsuleWastePct,
        disposalNumber: r.disposalNumber,
      });
    }
  }

  const totalOutput = reports.reduce((s, r) => s + r.made, 0);
  const summary = {
    reports: reports.length,
    workOrders: woMap.size,
    totalOutput,
    overallBlendedPct: weightedBlended(reports),
    capsulesWasted: reports.reduce((s, r) => s + r.totalCapsulesWasted, 0),
    ancillaryWasted: reports.reduce((s, r) => s + r.totalAncillaryWasted, 0),
    lastDateLabel: reports.map(r => r.dateLabel).filter(Boolean)[0] ?? "",
  };

  return { reports, byWorkOrder, byWeek, byMonth, byAncillary, batches, summary };
}
