import type { RunInput } from "./types";
import { validateRunInput } from "./validate";

function num(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export function parseRunInput(body: unknown): { input?: RunInput; errors: string[] } {
  const b = (body ?? {}) as Record<string, unknown>;
  const input: RunInput = {
    date: str(b.date),
    shift: str(b.shift),
    machineId: num(b.machineId) ?? 0,
    operatorId: num(b.operatorId) ?? 0,
    productSku: str(b.productSku),
    productDesc: str(b.productDesc),
    plannedQty: num(b.plannedQty),
    actualQty: num(b.actualQty),
    startTime: b.startTime ? str(b.startTime) : null,
    endTime: b.endTime ? str(b.endTime) : null,
    downtimeMin: num(b.downtimeMin),
    comments: b.comments ? str(b.comments) : null,
  };
  const errors = validateRunInput(input);
  return errors.length ? { errors } : { input, errors };
}
