export interface SkuRow {
  rowNum: string;
  bulk: string;
  skuCode: string;
  description: string;
  type: string;
  cover: number | null;
  potentialBulkToUnits: number | null;
  inventory: number | null;
  wnpStock: number | null;
  coverAtWNP: number | null;
  externalStock: number | null;
  fill: number | null;
  monthlyDemandAvg: number | null;
  monthlyDemandLastQtr: number | null;
  salesVariance: number | null;
  potentialFGWNC: number | null;
  bulkAtWNC: string;
  totalPotentialUnits: number | null;
  totalWeeksCover: number | null;
  weeksOver: number | null;
  potentialUnitsOther: number | null;
  weeksOverOther: number | null;
  bulkAtOther: string;
  nextBulkDelivery: string;
  bulkDeliveryQty: number | null;
  bulkPotentialUnits: number | null;
  bulkETA: string;
  bulkPlannedQty: string;
  packerVendor: string;
  totalPlannedTs: number | null;
  nextPackingDelivery: string;
  packingDeliveryQty: number | null;
  packingETA: string;
  packingSplitSKUs: string;
  packingVendor: string;
  totalPackingPlanned: number | null;
  unitsToBePlanned: number | null;
  unitsNotPlanned: number | null;
  projectedCover: number | null;
  demand12Week: number | null;
  demand3Month: number | null;
  demand16WeekCover: number | null;
}

export type CoverStatus = "critical" | "low" | "ok" | "good" | "unknown";

export function getCoverStatus(cover: number | null): CoverStatus {
  if (cover === null) return "unknown";
  if (cover < 4) return "critical";
  if (cover < 8) return "low";
  if (cover <= 16) return "ok";
  return "good";
}
