import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/require";
import { completePhase } from "@/lib/floor/readinessRepo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { date, phase, crossCheckId } = body ?? {};
  if (!date || (phase !== "start" && phase !== "end") || !crossCheckId) {
    return NextResponse.json({ error: "date, phase(start|end) and crossCheckId are required." }, { status: 400 });
  }
  try {
    await completePhase(date, phase, user.id, Number(crossCheckId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
