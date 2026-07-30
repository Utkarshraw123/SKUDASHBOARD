export type Phase = "start" | "end";
export type CheckResult = "confirm" | "deny";

export interface Run {
  id: number;
  date: string;          // YYYY-MM-DD
  shift: string;
  machineId: number;
  operatorId: number;
  productSku: string;
  productDesc: string;
  plannedQty: number | null;
  actualQty: number | null;
  startTime: string | null;   // ISO or HH:MM
  endTime: string | null;
  downtimeMin: number | null;
  comments: string | null;
  loggedBy: number;
  createdAt: string;
  updatedAt: string;
  void: boolean;
  voidReason: string | null;
  voidedBy: number | null;
  voidedAt: string | null;
}

// Client-submitted fields for create/edit (server stamps identity + timestamps).
export interface RunInput {
  date: string;
  shift: string;
  machineId: number;
  operatorId: number;
  productSku: string;
  productDesc: string;
  plannedQty: number | null;
  actualQty: number | null;
  startTime: string | null;
  endTime: string | null;
  downtimeMin: number | null;
  comments: string | null;
}

export interface RunTotals {
  runCount: number;       // non-void runs
  totalActual: number;
  totalPlanned: number;
  avgEfficiency: number | null;   // totalActual / totalPlanned
  totalDowntimeMin: number;
  perOperator: { operatorId: number; actual: number; planned: number; efficiency: number | null }[];
}

export interface ChecklistItem {
  id: number;
  sortOrder: number;
  category: string;
  label: string;
  critical: boolean;
}

export interface ReadinessCheck {
  itemId: number;
  phase: Phase;
  result: CheckResult;
  comment: string | null;
  checkedBy: number;
  checkedAt: string;
}

export interface ReadinessDay {
  id: number;
  date: string;
  templateId: number;
  startCompletedBy: number | null;
  startCompletedAt: string | null;
  startCrossCheckBy: number | null;
  endCompletedBy: number | null;
  endCompletedAt: string | null;
  endCrossCheckBy: number | null;
  status: "open" | "started" | "closed";
}
