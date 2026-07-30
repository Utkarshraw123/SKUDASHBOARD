import { NextResponse } from "next/server";
import { adminOnly } from "@/lib/auth/adminOnly";
import { updateChecklistItem, setChecklistItemActive } from "@/lib/floor/adminRepo";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));
  const patch: { label?: string; critical?: boolean } = {};
  if (typeof body.label === "string") {
    if (!body.label.trim()) return NextResponse.json({ error: "Label cannot be empty." }, { status: 400 });
    patch.label = body.label.trim();
  }
  if (typeof body.critical === "boolean") patch.critical = body.critical;
  if (patch.label !== undefined || patch.critical !== undefined) await updateChecklistItem(id, patch, admin.id);
  if (typeof body.active === "boolean") await setChecklistItemActive(id, body.active, admin.id);
  return NextResponse.json({ ok: true });
}
