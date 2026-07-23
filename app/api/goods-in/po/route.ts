import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { appendGoodsInRecord, updateGoodsInRecord } from "@/lib/sheets";
import { GOODS_IN_HEADERS, recordToRow, poLinesToRecords, type PoLineInput } from "@/lib/goods-in";
import { uploadGoodsInAttachments } from "@/lib/goods-in-upload";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }

  const g = (k: string) => String(form.get(k) ?? "").trim();
  const expected = process.env.GOODS_IN_PASSWORD ?? process.env.PRODUCTION_REPORT_PASSWORD ?? "12345";
  if (g("password") !== expected) return NextResponse.json({ error: "Incorrect password" }, { status: 401 });

  const po = g("po");
  if (!po) return NextResponse.json({ error: "PO Number is required" }, { status: 400 });

  let lines: PoLineInput[];
  try {
    const parsed = JSON.parse(g("lines") || "[]");
    lines = Array.isArray(parsed) ? parsed : [];
  } catch { return NextResponse.json({ error: "Invalid lines payload" }, { status: 400 }); }
  if (lines.length === 0) return NextResponse.json({ error: "No received lines to file" }, { status: 400 });

  const { coaUrl, docUrls, warnings } = await uploadGoodsInAttachments(form, po);

  try {
    const mapped = poLinesToRecords({ po, lines, coaUrl, docUrls });
    for (const { record, isEdit, fallbackKey } of mapped) {
      if (isEdit) await updateGoodsInRecord(record.recordId, recordToRow(record), fallbackKey);
      else await appendGoodsInRecord(GOODS_IN_HEADERS, recordToRow(record));
    }
    return NextResponse.json({ ok: true, records: mapped.map(m => m.record), warnings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save records";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    revalidateTag("sheets");
  }
}
