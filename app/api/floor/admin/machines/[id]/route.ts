import { NextResponse } from "next/server";
import { adminOnly } from "@/lib/auth/adminOnly";
import { renameMachine, setMachineActive } from "@/lib/floor/adminRepo";
import { validateName } from "@/lib/floor/adminValidate";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));
  if (typeof body.name === "string") {
    const name = body.name.trim();
    const errors = validateName(name);
    if (errors.length) return NextResponse.json({ errors }, { status: 400 });
    await renameMachine(id, name, admin.id);
  }
  if (typeof body.active === "boolean") await setMachineActive(id, body.active, admin.id);
  return NextResponse.json({ ok: true });
}
