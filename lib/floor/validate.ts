import type { RunInput } from "./types";

export function validateRunInput(input: RunInput): string[] {
  const errs: string[] = [];
  if (!input.date) errs.push("Date is required.");
  if (!input.shift) errs.push("Shift is required.");
  if (!input.machineId) errs.push("Machine is required.");
  if (!input.operatorId) errs.push("Operator is required.");
  if (!input.productSku) errs.push("Product is required.");
  if (input.actualQty != null && input.actualQty < 0) errs.push("Actual quantity must be 0 or more.");
  if (input.plannedQty != null && input.plannedQty < 0) errs.push("Planned quantity must be 0 or more.");
  if (input.downtimeMin != null && input.downtimeMin < 0) errs.push("Downtime must be 0 or more.");
  if (input.startTime && input.endTime && new Date(input.endTime) <= new Date(input.startTime)) {
    errs.push("End time must be after start time.");
  }
  return errs;
}
