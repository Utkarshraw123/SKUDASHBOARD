import { NextResponse } from "next/server";
import { adminOnly } from "@/lib/auth/adminOnly";
import { listUsers, createUser } from "@/lib/floor/adminRepo";
import { validateNewUser } from "@/lib/floor/adminValidate";
import type { Role } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await adminOnly())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ users: await listUsers() });
}

export async function POST(req: Request) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const input = {
    username: String(body.username ?? "").trim(),
    name: String(body.name ?? "").trim(),
    role: body.role as Role,
    password: String(body.password ?? ""),
  };
  const errors = validateNewUser(input);
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });
  try {
    const id = await createUser(input, admin.id);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
