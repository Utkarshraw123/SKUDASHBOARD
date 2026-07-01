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

export interface ProductionRow {
  vendor: string;
  vendorName: string;
  orderType: string;
  order: string;
  raisedDate: string;
  productionDate: string;
  dueDate: string;
  partNumber: string;
  description: string;
  quantity: number | null;
  received: number | null;
  unit: string;
  cost: string;
  costPerUnit: number | null;
  workOrder: string;
  poStatus: string;
  kitStatus: string;
  completionDate: string;
  status: "complete" | "partial" | "open";
}

export interface PlanningRow {
  plannedWeek: string;
  plannedDays: string;
  bulkCode: string;
  productCode: string;
  description: string;
  fill: number | null;
  quantity: number | null;
  workOrderNo: string;
  quantityProduced: number | null;
  bulkAtWNP: string;
  notes: string;
  currentStock: number | null;
  batch: string;
  bbd: string;
  dateCompleted: string;
  statusText: string;
  status: "complete" | "in_progress" | "planned";
}

export interface BulkPoRow {
  vendorNumber: string;
  vendorName: string;
  order: string;
  date: string;
  partNumber: string;
  description: string;
  partType: string;
  dueDate: string;
  orderQuantity: number | null;
}

export interface PackingRow {
  partNumber: string;
  description: string;
  dueDate: string;
  purchaseOrder: string;
  balance: number | null;
  vendorNumber: string;
  vendorName: string;
  urgency: "overdue" | "this_week" | "upcoming";
}

export interface BomComponent {
  code: string;
  name: string;
  qty: number; // per 1,000 capsules for RM BOM; per finished unit for Ancillary BOM
}

export interface BomProduct {
  code: string;
  name: string;
  components: BomComponent[];
}

export interface BomSheet {
  type: "rm" | "ancillary";
  products: BomProduct[];
  byComponent: Map<string, { componentName: string; usedIn: { code: string; name: string; qty: number }[] }>;
}

export type CoverStatus = "critical" | "low" | "ok" | "good" | "unknown";

export function getCoverStatus(cover: number | null): CoverStatus {
  if (cover === null) return "unknown";
  if (cover < 4) return "critical";
  if (cover < 8) return "low";
  if (cover <= 16) return "ok";
  return "good";
}
