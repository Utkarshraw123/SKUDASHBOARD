import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/require";
import { completePhase } from "@/lib/floor/readinessRepo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { date, phase } = body ?? {};
  if (!date || (phase !== "start" && phase !== "end")) {
    return NextResponse.json({ error: "date and phase(start|end) are required." }, { status: 400 });
  }
  try {
    await completePhase(date, phase, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
