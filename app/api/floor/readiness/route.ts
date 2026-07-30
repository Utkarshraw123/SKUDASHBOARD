import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/require";
import { getDayChecks } from "@/lib/floor/readinessRepo";

export const dynamic = "force-dynamic";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const date = new URL(req.url).searchParams.get("date") ?? today();
  return NextResponse.json(await getDayChecks(date));
}
