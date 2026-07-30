import { NextResponse } from "next/server";
import { adminOnly } from "@/lib/auth/adminOnly";
import { setUserActive, setUserRole, resetUserPassword } from "@/lib/floor/adminRepo";
import type { Role } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const ROLES: Role[] = ["supervisor", "manager", "admin"];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));

  if (typeof body.active === "boolean") {
    if (id === admin.id && body.active === false) {
      return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
    }
    await setUserActive(id, body.active, admin.id);
  }
  if (typeof body.role === "string") {
    if (!ROLES.includes(body.role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    if (id === admin.id && body.role !== "admin") {
      return NextResponse.json({ error: "You cannot remove your own admin role." }, { status: 400 });
    }
    await setUserRole(id, body.role, admin.id);
  }
  if (typeof body.password === "string") {
    if (body.password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    await resetUserPassword(id, body.password, admin.id);
  }
  return NextResponse.json({ ok: true });
}
