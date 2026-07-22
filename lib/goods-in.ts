// Goods In — pure helpers (no I/O). Turns Open Purchase Orders into goods-in
// "tasks for the day", and parses/serialises the Goods In records (filled
// QA13-CF01 forms) that persist to the Goods In sheet tab.

import type { BulkPoRow } from "./types";

export type GoodsInStatus = "awaiting" | "booked_in";
export type Urgency = "overdue" | "today" | "soon" | "later" | "none";

export interface GoodsInTask {
  po: string;
  partNumber: string;
  description: string;
  partType: string;
  supplier: string;
  quantity: number | null;
  dueDate: string;   // DD/MM/YYYY as recorded
  dueISO: string;    // YYYY-MM-DD for sorting; "" if unparseable
  status: GoodsInStatus;
  urgency: Urgency;
}

export interface GoodsInRecord {
  timestamp: string;
  po: string;
  partNumber: string;
  description: string;
  quantity: string;
  supplier: string;
  supplierProductCode: string;
  batchLot: string;
  bbd: string;
  haulier: string;
  date: string;
  time: string;
  cofaReceived: string;      // "Yes" | "No" | ""
  comments: string;
  coaUrl: string;
  docUrls: string[];
  status: string;            // "Booked in"
}

// Sheet column order for the Goods In tab (append-only, like Reports).
export const GOODS_IN_HEADERS = [
  "Timestamp", "PO Number", "Part Number", "Description", "Quantity", "Supplier",
  "Supplier Product Code", "Batch/Lot No.", "BBD", "Haulier", "Date", "Time",
  "CofA Received", "Comments", "COA URL", "Document URLs", "Status",
];

function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

// DD/MM/YYYY → Date (local midnight); null if unparseable.
export function parseDMY(s: string): Date | null {
  if (!s || !s.trim()) return null;
  const p = s.trim().split("/");
  if (p.length !== 3) return null;
  const [dd, mm, yyyy] = [Number(p[0]), Number(p[1]), Number(p[2])];
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(yyyy, mm - 1, dd);
  return isNaN(d.getTime()) ? null : d;
}
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function recordToRow(r: GoodsInRecord): (string | number)[] {
  return [
    r.timestamp, r.po, r.partNumber, r.description, r.quantity, r.supplier,
    r.supplierProductCode, r.batchLot, r.bbd, r.haulier, r.date, r.time,
    r.cofaReceived, r.comments, r.coaUrl, r.docUrls.join(" | "), r.status,
  ];
}

export function parseGoodsInRecords(rows: (string | number)[][]): GoodsInRecord[] {
  return rows
    .filter(r => str(r[1]) !== "") // must have a PO
    .map(r => ({
      timestamp: str(r[0]),
      po: str(r[1]),
      partNumber: str(r[2]),
      description: str(r[3]),
      quantity: str(r[4]),
      supplier: str(r[5]),
      supplierProductCode: str(r[6]),
      batchLot: str(r[7]),
      bbd: str(r[8]),
      haulier: str(r[9]),
      date: str(r[10]),
      time: str(r[11]),
      cofaReceived: str(r[12]),
      comments: str(r[13]),
      coaUrl: str(r[14]),
      docUrls: str(r[15]).split("|").map(s => s.trim()).filter(Boolean),
      status: str(r[16]) || "Booked in",
    }))
    .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || "")); // newest first
}

// Build the goods-in task list from open POs. Booked-in POs (a record exists)
// are flagged; the rest are "awaiting". Sorted overdue/today first, then soonest.
export function buildGoodsInTasks(pos: BulkPoRow[], records: GoodsInRecord[], today = new Date()): GoodsInTask[] {
  const t0 = new Date(today); t0.setHours(0, 0, 0, 0);
  const bookedPOs = new Set(records.map(r => r.po));

  const urgencyOf = (due: Date | null): Urgency => {
    if (!due) return "none";
    const days = Math.round((due.getTime() - t0.getTime()) / 86400000);
    if (days < 0) return "overdue";
    if (days === 0) return "today";
    if (days <= 7) return "soon";
    return "later";
  };
  const rank: Record<Urgency, number> = { overdue: 0, today: 1, soon: 2, later: 3, none: 4 };

  const tasks = pos.map((p): GoodsInTask => {
    const due = parseDMY(p.dueDate);
    return {
      po: p.order,
      partNumber: p.partNumber,
      description: p.description,
      partType: p.partType,
      supplier: p.vendorName,
      quantity: p.orderQuantity,
      dueDate: p.dueDate,
      dueISO: due ? toISO(due) : "",
      status: bookedPOs.has(p.order) ? "booked_in" : "awaiting",
      urgency: urgencyOf(due),
    };
  });

  return tasks.sort((a, b) => {
    // awaiting before booked-in; then by urgency; then soonest due date
    if (a.status !== b.status) return a.status === "awaiting" ? -1 : 1;
    if (rank[a.urgency] !== rank[b.urgency]) return rank[a.urgency] - rank[b.urgency];
    return (a.dueISO || "9999").localeCompare(b.dueISO || "9999");
  });
}

export function summarise(tasks: GoodsInTask[]) {
  const awaiting = tasks.filter(t => t.status === "awaiting");
  return {
    total: tasks.length,
    awaiting: awaiting.length,
    bookedIn: tasks.length - awaiting.length,
    dueToday: awaiting.filter(t => t.urgency === "today").length,
    overdue: awaiting.filter(t => t.urgency === "overdue").length,
  };
}
