import { NextResponse } from "next/server";
import { adminOnly } from "@/lib/auth/adminOnly";
import { listAllOperators, createOperator } from "@/lib/floor/adminRepo";
import { validateName } from "@/lib/floor/adminValidate";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await adminOnly())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ operators: await listAllOperators() });
}

export async function POST(req: Request) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const name = String((await req.json().catch(() => ({}))).name ?? "").trim();
  const errors = validateName(name);
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });
  const id = await createOperator(name, admin.id);
  return NextResponse.json({ id }, { status: 201 });
}
