import { cookies } from "next/headers";
import type { SkuRow } from "./types";

export type MarketMode = "all" | "dtc" | "eu" | "us" | "accessories";

export function getMarketMode(): MarketMode {
  const raw = cookies().get("marketMode")?.value ?? "dtc";
  const valid: MarketMode[] = ["all", "dtc", "eu", "us", "accessories"];
  return valid.includes(raw as MarketMode) ? (raw as MarketMode) : "dtc";
}

export function getSkuMarket(s: SkuRow): "eu" | "us" | "accessories" | "dtc" {
  if (s.description.startsWith("EU ")) return "eu";
  if (s.description.startsWith("US ")) return "us";
  if (s.type === "Asse" || s.type === "Book") return "accessories";
  return "dtc";
}

export function filterSkusByMode(skus: SkuRow[], mode: MarketMode): SkuRow[] {
  if (mode === "all") return skus;
  return skus.filter((s) => getSkuMarket(s) === mode);
}

/** Parse a DD/MM delivery date → return the string only if today or in the future, else null */
export function futureDateOnly(ddmm: string): string | null {
  if (!ddmm || ddmm === "Not Planned" || ddmm === "#N/A" || ddmm.trim() === "") return null;
  const parts = ddmm.trim().split("/");
  if (parts.length < 2) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  if (isNaN(day) || isNaN(month)) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let d = new Date(now.getFullYear(), month, day);
  if (d < now) d = new Date(now.getFullYear() + 1, month, day);
  return d >= now ? ddmm : null;
}
