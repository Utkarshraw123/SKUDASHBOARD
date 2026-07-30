import { getClient } from "@/lib/db/client";
import type { Run, RunInput } from "./types";
import { diffFields } from "./audit";

const AUDITED_FIELDS: (keyof RunInput)[] = [
  "date", "shift", "machineId", "operatorId", "productSku", "productDesc",
  "plannedQty", "actualQty", "startTime", "endTime", "downtimeMin", "comments",
];

function rowToRun(r: Record<string, unknown>): Run {
  return {
    id: r.id as number,
    date: r.date as string,
    shift: r.shift as string,
    machineId: r.machine_id as number,
    operatorId: r.operator_id as number,
    productSku: r.product_sku as string,
    productDesc: r.product_desc as string,
    plannedQty: (r.planned_qty as number) ?? null,
    actualQty: (r.actual_qty as number) ?? null,
    startTime: (r.start_time as string) ?? null,
    endTime: (r.end_time as string) ?? null,
    downtimeMin: (r.downtime_min as number) ?? null,
    comments: (r.comments as string) ?? null,
    loggedBy: r.logged_by as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    void: !!(r.void as number),
    voidReason: (r.void_reason as string) ?? null,
    voidedBy: (r.voided_by as number) ?? null,
    voidedAt: (r.voided_at as string) ?? null,
  };
}

async function writeAudit(
  entityId: number,
  action: "create" | "update" | "void",
  field: string | null,
  oldVal: string | null,
  newVal: string | null,
  userId: number,
): Promise<void> {
  await getClient().execute({
    sql: `INSERT INTO audit_log (entity, entity_id, action, field, old_value, new_value, changed_by, changed_at)
          VALUES ('run', ?, ?, ?, ?, ?, ?, ?)`,
    args: [entityId, action, field, oldVal, newVal, userId, new Date().toISOString()],
  });
}

export async function createRun(input: RunInput, userId: number): Promise<number> {
  const now = new Date().toISOString();
  const res = await getClient().execute({
    sql: `INSERT INTO runs
      (date, shift, machine_id, operator_id, product_sku, product_desc,
       planned_qty, actual_qty, start_time, end_time, downtime_min, comments,
       logged_by, created_at, updated_at, void)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0) RETURNING id`,
    args: [
      input.date, input.shift, input.machineId, input.operatorId, input.productSku, input.productDesc,
      input.plannedQty, input.actualQty, input.startTime, input.endTime, input.downtimeMin, input.comments,
      userId, now, now,
    ],
  });
  const id = res.rows[0].id as number;
  await writeAudit(id, "create", null, null, null, userId);
  return id;
}

export async function getRun(id: number): Promise<Run | null> {
  const res = await getClient().execute({ sql: "SELECT * FROM runs WHERE id = ?", args: [id] });
  return res.rows[0] ? rowToRun(res.rows[0] as Record<string, unknown>) : null;
}

export async function listRuns(opts: { date?: string } = {}): Promise<Run[]> {
  const res = opts.date
    ? await getClient().execute({ sql: "SELECT * FROM runs WHERE date = ? ORDER BY id DESC", args: [opts.date] })
    : await getClient().execute("SELECT * FROM runs ORDER BY id DESC");
  return res.rows.map((r) => rowToRun(r as Record<string, unknown>));
}

export async function updateRun(id: number, input: RunInput, userId: number): Promise<void> {
  const before = await getRun(id);
  if (!before) throw new Error(`Run ${id} not found`);
  const now = new Date().toISOString();
  await getClient().execute({
    sql: `UPDATE runs SET date=?, shift=?, machine_id=?, operator_id=?, product_sku=?, product_desc=?,
      planned_qty=?, actual_qty=?, start_time=?, end_time=?, downtime_min=?, comments=?, updated_at=?
      WHERE id=?`,
    args: [
      input.date, input.shift, input.machineId, input.operatorId, input.productSku, input.productDesc,
      input.plannedQty, input.actualQty, input.startTime, input.endTime, input.downtimeMin, input.comments,
      now, id,
    ],
  });
  const beforeInput: RunInput = {
    date: before.date, shift: before.shift, machineId: before.machineId, operatorId: before.operatorId,
    productSku: before.productSku, productDesc: before.productDesc, plannedQty: before.plannedQty,
    actualQty: before.actualQty, startTime: before.startTime, endTime: before.endTime,
    downtimeMin: before.downtimeMin, comments: before.comments,
  };
  const diffs = diffFields(
    beforeInput as unknown as Record<string, unknown>,
    input as unknown as Record<string, unknown>,
    AUDITED_FIELDS as unknown as string[],
  );
  for (const d of diffs) await writeAudit(id, "update", d.field, d.old, d.new, userId);
}

export async function voidRun(id: number, reason: string, userId: number): Promise<void> {
  const now = new Date().toISOString();
  await getClient().execute({
    sql: "UPDATE runs SET void=1, void_reason=?, voided_by=?, voided_at=? WHERE id=?",
    args: [reason, userId, now, id],
  });
  await writeAudit(id, "void", "void", "0", "1", userId);
}
