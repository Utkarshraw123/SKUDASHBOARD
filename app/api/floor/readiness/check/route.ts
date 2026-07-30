import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/require";
import { saveCheck } from "@/lib/floor/readinessRepo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { date, itemId, phase, result, comment } = body ?? {};
  if (!date || !itemId || (phase !== "start" && phase !== "end") || (result !== "confirm" && result !== "deny")) {
    return NextResponse.json({ error: "date, itemId, phase(start|end) and result(confirm|deny) are required." }, { status: 400 });
  }
  try {
    await saveCheck(date, { itemId: Number(itemId), phase, result, comment: comment ?? null }, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
