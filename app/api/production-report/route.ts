import { NextRequest, NextResponse } from "next/server";
import {
  computeWastage, reportToRows, REPORT_HEADERS,
  type ProductionReportInput, type ProductBatchEntry, type BulkEntry,
} from "@/lib/production-report";
import { appendProductionReport } from "@/lib/sheets";

export const runtime = "nodejs";

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const password = String(body.password ?? "");
  const expected = process.env.PRODUCTION_REPORT_PASSWORD ?? "12345";
  if (password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  if (!body.workOrder) {
    return NextResponse.json({ error: "Work Order is required" }, { status: 400 });
  }

  // Batches: keep only rows that carry a batch or BBD; always keep at least one.
  const rawBatches = Array.isArray(body.batches) ? body.batches : [];
  const batches: ProductBatchEntry[] = rawBatches
    .map((b): ProductBatchEntry => {
      const o = (b ?? {}) as Record<string, unknown>;
      return { batch: String(o.batch ?? ""), bbd: String(o.bbd ?? "") };
    })
    .filter(b => b.batch.trim() !== "" || b.bbd.trim() !== "");
  if (batches.length === 0) batches.push({ batch: "", bbd: "" });

  // Bulks: keep rows that carry any bulk detail; require at least one.
  const rawBulks = Array.isArray(body.bulks) ? body.bulks : [];
  const bulks: BulkEntry[] = rawBulks
    .map((b): BulkEntry => {
      const o = (b ?? {}) as Record<string, unknown>;
      return {
        bulkCode: String(o.bulkCode ?? ""),
        bulkDescription: String(o.bulkDescription ?? ""),
        bulkBatch: String(o.bulkBatch ?? ""),
        bulkBBD: String(o.bulkBBD ?? ""),
        used: num(o.used),
        wasteCapsules: num(o.wasteCapsules),
      };
    })
    .filter(b =>
      b.bulkCode.trim() !== "" || b.bulkDescription.trim() !== "" ||
      b.bulkBatch.trim() !== "" || b.used > 0 || b.wasteCapsules > 0
    );
  if (bulks.length === 0) {
    return NextResponse.json({ error: "At least one bulk is required" }, { status: 400 });
  }

  const anc = (body.ancWaste ?? {}) as Record<string, unknown>;
  const input: ProductionReportInput = {
    workOrder: String(body.workOrder ?? ""),
    sku: String(body.sku ?? ""),
    description: String(body.description ?? ""),
    productType: String(body.productType ?? ""),
    batches,
    bulks,
    made: num(body.made),
    people: num(body.people),
    woStatus: String(body.woStatus ?? ""),
    ancWaste: {
      jars: num(anc.jars),
      lids: num(anc.lids),
      labels: num(anc.labels),
      box: num(anc.box),
      pouches: num(anc.pouches),
      desiccants: num(anc.desiccants),
    },
    disposalNumber: String(body.disposalNumber ?? ""),
    comments: String(body.comments ?? ""),
  };

  try {
    const wastage = computeWastage(input);
    const rows = reportToRows(input, wastage);
    await appendProductionReport(REPORT_HEADERS, rows);
    return NextResponse.json({ ok: true, wastage, rowsWritten: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save report";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
