import { NextRequest, NextResponse } from "next/server";
import { computeWastage, reportToRow, REPORT_HEADERS, type ProductionReportInput } from "@/lib/production-report";
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

  const waste = (body.waste ?? {}) as Record<string, unknown>;
  const input: ProductionReportInput = {
    workOrder: String(body.workOrder ?? ""),
    sku: String(body.sku ?? ""),
    description: String(body.description ?? ""),
    productBatch: String(body.productBatch ?? ""),
    productBBD: String(body.productBBD ?? ""),
    bulkCode: String(body.bulkCode ?? ""),
    bulkDescription: String(body.bulkDescription ?? ""),
    bulkBatch: String(body.bulkBatch ?? ""),
    bulkBBD: String(body.bulkBBD ?? ""),
    used: num(body.used),
    made: num(body.made),
    people: num(body.people),
    woStatus: String(body.woStatus ?? ""),
    waste: {
      capsules: num(waste.capsules),
      jars: num(waste.jars),
      lids: num(waste.lids),
      labels: num(waste.labels),
      box: num(waste.box),
      pouches: num(waste.pouches),
      desiccants: num(waste.desiccants),
    },
  };

  try {
    const wastage = computeWastage(input);
    const row = reportToRow(input, wastage);
    await appendProductionReport(REPORT_HEADERS, row);
    return NextResponse.json({ ok: true, wastage });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save report";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
