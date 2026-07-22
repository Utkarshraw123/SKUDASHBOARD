import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { appendGoodsInRecord, updateGoodsInRecord } from "@/lib/sheets";
import { GOODS_IN_HEADERS, recordToRow, type GoodsInRecord } from "@/lib/goods-in";

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

  // Upload attachments to Vercel Blob when configured; degrade gracefully otherwise.
  const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  const warnings: string[] = [];
  const upload = async (file: File): Promise<string> => {
    const safe = `goods-in/${po.replace(/[^A-Za-z0-9._-]+/g, "-")}/${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]+/g, "-")}`;
    const blob = await put(safe, file, { access: "public" });
    return blob.url;
  };

  let coaUrl = "";
  const coaFile = form.get("coa");
  if (coaFile instanceof File && coaFile.size > 0) {
    if (hasBlob) {
      try { coaUrl = await upload(coaFile); } catch { warnings.push("CofA upload failed."); }
    } else warnings.push("File storage not configured — CofA was not uploaded. Enable Vercel Blob to store attachments.");
  }

  const docUrls: string[] = [];
  const docFiles = form.getAll("docs").filter((f): f is File => f instanceof File && f.size > 0);
  for (const f of docFiles) {
    if (hasBlob) {
      try { docUrls.push(await upload(f)); } catch { warnings.push(`Upload failed: ${f.name}`); }
    } else if (!warnings.some(w => w.includes("File storage"))) {
      warnings.push("File storage not configured — documents were not uploaded.");
    }
  }

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
    return NextResponse.json({ ok: true, record, warnings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save record";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
