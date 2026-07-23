import { put } from "@vercel/blob";

// Upload CofA + documents to Vercel Blob when configured; degrade gracefully otherwise.
// Shared by the single-line and multi-line (PO) Goods In save routes.
export async function uploadGoodsInAttachments(
  form: FormData, po: string,
): Promise<{ coaUrl: string; docUrls: string[]; warnings: string[] }> {
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
  return { coaUrl, docUrls, warnings };
}
