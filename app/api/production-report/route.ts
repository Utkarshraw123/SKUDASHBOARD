import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  computeWastage, reportToRows, REPORT_HEADERS, isRequiredDMY,
  type ProductionReportInput, type ProductBatchEntry, type BulkEntry,
} from "@/lib/production-report";
import { appendProductionReport, updateProductionReport } from "@/lib/sheets";

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

  // BBD validation (server-side, matching the form): every active batch and bulk
  // must carry a real DD/MM/YYYY best-before date — required, no blanks.
  if (batches.some(b => !isRequiredDMY(b.bbd))) {
    return NextResponse.json({ error: "Every product batch needs a valid BBD (DD/MM/YYYY)." }, { status: 400 });
  }
  if (bulks.some(b => !isRequiredDMY(b.bulkBBD))) {
    return NextResponse.json({ error: "Every bulk needs a valid BBD (DD/MM/YYYY)." }, { status: 400 });
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

  const editReportId = String(body.editReportId ?? "").trim();
  const editTimestamp = String(body.editTimestamp ?? "").trim();

  try {
    const wastage = computeWastage(input);
    if (editReportId) {
      // Edit: reuse the report's original id + timestamp, update rows in place.
      const rows = reportToRows(input, wastage, { reportId: editReportId, timestamp: editTimestamp || undefined });
      await updateProductionReport(editReportId, REPORT_HEADERS, rows);
      revalidateTag("sheets");
      return NextResponse.json({ ok: true, wastage, rowsWritten: rows.length, updated: true });
    }
    const rows = reportToRows(input, wastage);
    await appendProductionReport(REPORT_HEADERS, rows);
    revalidateTag("sheets");
    // Report ID lives in col AG (index 32) and is shared by every row of the report.
    const reportId = String(rows[0]?.[32] ?? "");
    return NextResponse.json({ ok: true, wastage, rowsWritten: rows.length, reportId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save report";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
