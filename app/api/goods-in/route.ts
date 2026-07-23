import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { appendGoodsInRecord, updateGoodsInRecord } from "@/lib/sheets";
import { GOODS_IN_HEADERS, recordToRow, type GoodsInRecord } from "@/lib/goods-in";
import { uploadGoodsInAttachments } from "@/lib/goods-in-upload";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const password = String(form.get("password") ?? "");
  const expected = process.env.GOODS_IN_PASSWORD ?? process.env.PRODUCTION_REPORT_PASSWORD ?? "12345";
  if (password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const g = (k: string) => String(form.get(k) ?? "").trim();
  const po = g("po");
  if (!po) return NextResponse.json({ error: "PO Number is required" }, { status: 400 });

  const { coaUrl, docUrls, warnings } = await uploadGoodsInAttachments(form, po);

  const isEdit = g("editMode") === "1";
  const editId = g("recordId");
  const existingCoa = g("coaUrlExisting");
  const existingDocs = g("docUrlsExisting").split("|").map(s => s.trim()).filter(Boolean);

  const record: GoodsInRecord = {
    timestamp: isEdit ? (g("timestamp") || new Date().toISOString()) : new Date().toISOString(),
    po,
    partNumber: g("partNumber"),
    description: g("description"),
    quantity: g("quantity"),
    supplier: g("supplier"),
    supplierProductCode: g("supplierProductCode"),
    batchLot: g("batchLot"),
    bbd: g("bbd"),
    haulier: g("haulier"),
    date: g("date"),
    time: g("time"),
    cofaReceived: g("cofaReceived"),
    comments: g("comments"),
    // keep existing attachments on edit unless new ones were uploaded
    coaUrl: coaUrl || existingCoa,
    docUrls: docUrls.length ? docUrls : existingDocs,
    status: "Booked in",
    recordId: editId || `${po}-${g("partNumber")}-${Date.now()}`,
  };

  try {
    if (isEdit) {
      const fallbackKey = `${record.po} ${record.partNumber} ${record.timestamp}`;
      await updateGoodsInRecord(editId, recordToRow(record), fallbackKey);
    } else {
      await appendGoodsInRecord(GOODS_IN_HEADERS, recordToRow(record));
    }
    revalidateTag("sheets"); // bust the 120s read cache so the tasks/records lists reflect this write immediately
    return NextResponse.json({ ok: true, record, warnings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save record";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
