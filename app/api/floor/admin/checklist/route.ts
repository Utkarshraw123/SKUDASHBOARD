import { NextResponse } from "next/server";
import { adminOnly } from "@/lib/auth/adminOnly";
import { getActiveTemplateWithItems, addChecklistItem } from "@/lib/floor/adminRepo";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await adminOnly())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await getActiveTemplateWithItems());
}

export async function POST(req: Request) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const category = String(body.category ?? "").trim();
  const label = String(body.label ?? "").trim();
  if (!category || !label) return NextResponse.json({ error: "Category and label are required." }, { status: 400 });
  const id = await addChecklistItem({ category, label, critical: !!body.critical }, admin.id);
  return NextResponse.json({ id }, { status: 201 });
}
