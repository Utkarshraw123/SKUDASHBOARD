import { NextRequest, NextResponse } from "next/server";
import { voidGoodsInRecord } from "@/lib/sheets";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { recordId?: string; fallbackKey?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const expected = process.env.GOODS_IN_PASSWORD ?? process.env.PRODUCTION_REPORT_PASSWORD ?? "12345";
  if ((body.password ?? "") !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const recordId = (body.recordId ?? "").trim();
  const fallbackKey = (body.fallbackKey ?? "").trim() || undefined;
  if (!recordId && !fallbackKey) {
    return NextResponse.json({ error: "recordId required" }, { status: 400 });
  }

  try {
    await voidGoodsInRecord(recordId, fallbackKey);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete record";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
