import { getClient } from "@/lib/db/client";
import type { SkuRow } from "@/lib/types";

export interface NamedRef { id: number; name: string; }
export interface SkuOption { sku: string; desc: string; }

export async function listMachines(): Promise<NamedRef[]> {
  const res = await getClient().execute("SELECT id, name FROM machines WHERE active=1 ORDER BY name");
  return res.rows.map((r) => ({ id: r.id as number, name: r.name as string }));
}

export async function listOperators(): Promise<NamedRef[]> {
  const res = await getClient().execute("SELECT id, name FROM operators WHERE active=1 ORDER BY name");
  return res.rows.map((r) => ({ id: r.id as number, name: r.name as string }));
}

// Pure mapper (unit-tested) — turns sheet rows into product-picker options.
export function skuOptionsFrom(rows: SkuRow[]): SkuOption[] {
  return rows
    .filter((r) => r.skuCode && r.skuCode.trim() !== "")
    .map((r) => ({ sku: r.skuCode, desc: r.description }));
}

export async function listSkuOptions(): Promise<SkuOption[]> {
  // Dynamic import keeps lib/sheets.ts (which runs React/Next `cache` at module
  // load) out of the vitest import graph — it only loads in the Next runtime.
  const { fetchSkus } = await import("@/lib/sheets");
  return skuOptionsFrom(await fetchSkus());
}
