import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/require";
import { updateRun, getRun } from "@/lib/floor/runsRepo";
import { parseRunInput } from "@/lib/floor/parseRunInput";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(params.id);
  if (!(await getRun(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { input, errors } = parseRunInput(await req.json().catch(() => ({})));
  if (!input) return NextResponse.json({ errors }, { status: 400 });
  await updateRun(id, input, user.id);
  return NextResponse.json({ ok: true });
}
