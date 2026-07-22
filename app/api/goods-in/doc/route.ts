import { NextRequest, NextResponse } from "next/server";
import { buildGoodsInDoc, docFilename } from "@/lib/goods-in-doc";
import type { GoodsInRecord } from "@/lib/goods-in";

export const runtime = "nodejs";

// Generate the editable QA13-CF01 Word form from a record's fields (POSTed JSON).
export async function POST(req: NextRequest) {
  let body: Partial<GoodsInRecord>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const s = (v: unknown) => String(v ?? "");
  const rec: GoodsInRecord = {
    timestamp: s(body.timestamp),
    po: s(body.po),
    partNumber: s(body.partNumber),
    description: s(body.description),
    quantity: s(body.quantity),
    supplier: s(body.supplier),
    supplierProductCode: s(body.supplierProductCode),
    batchLot: s(body.batchLot),
    bbd: s(body.bbd),
    haulier: s(body.haulier),
    date: s(body.date),
    time: s(body.time),
    cofaReceived: s(body.cofaReceived),
    comments: s(body.comments),
    coaUrl: s(body.coaUrl),
    docUrls: Array.isArray(body.docUrls) ? body.docUrls.map(s) : [],
    status: s(body.status),
  };

  const buf = await buildGoodsInDoc(rec);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${docFilename(rec)}"`,
    },
  });
}
