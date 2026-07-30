import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/require";
import { listMachines, listOperators, listSkuOptions } from "@/lib/floor/catalog";
import { getClient } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supervisors = await getClient().execute(
    "SELECT id, name FROM users WHERE active=1 AND role IN ('supervisor','admin') ORDER BY name",
  );
  return NextResponse.json({
    machines: await listMachines(),
    operators: await listOperators(),
    skus: await listSkuOptions(),
    supervisors: supervisors.rows.map((r) => ({ id: r.id as number, name: r.name as string })),
  });
}
