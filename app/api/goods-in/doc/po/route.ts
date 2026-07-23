import { NextRequest, NextResponse } from "next/server";
import { buildGoodsInPoDoc, poDocFilename } from "@/lib/goods-in-doc";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { po?: string; supplier?: string; lines?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const s = (v: unknown) => String(v ?? "");
  const po = s(body.po);
  const supplier = s(body.supplier);
  const lines = Array.isArray(body.lines) ? body.lines.map((l: Record<string, unknown>) => ({
    partNumber: s(l.partNumber), description: s(l.description), quantity: s(l.quantity),
    supplierProductCode: s(l.supplierProductCode), batchLot: s(l.batchLot), bbd: s(l.bbd),
  })) : [];

  const buf = await buildGoodsInPoDoc({ po, supplier, lines });
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${poDocFilename(po)}"`,
    },
  });
}
