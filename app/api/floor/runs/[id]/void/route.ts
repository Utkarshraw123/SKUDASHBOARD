import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/require";
import { voidRun, getRun } from "@/lib/floor/runsRepo";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(params.id);
  if (!(await getRun(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { reason } = await req.json().catch(() => ({}));
  if (typeof reason !== "string" || reason.trim() === "") {
    return NextResponse.json({ error: "A reason is required to void a run." }, { status: 400 });
  }
  await voidRun(id, reason.trim(), user.id);
  return NextResponse.json({ ok: true });
}
