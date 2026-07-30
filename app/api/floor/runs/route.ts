import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/require";
import { listRuns, createRun } from "@/lib/floor/runsRepo";
import { parseRunInput } from "@/lib/floor/parseRunInput";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = new URL(req.url).searchParams.get("date") ?? undefined;
  return NextResponse.json({ runs: await listRuns({ date }) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { input, errors } = parseRunInput(await req.json().catch(() => ({})));
  if (!input) return NextResponse.json({ errors }, { status: 400 });
  const id = await createRun(input, user.id);
  return NextResponse.json({ id }, { status: 201 });
}
