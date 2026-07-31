import { getClient } from "@/lib/db/client";
import type { ChecklistItem, ReadinessCheck, ReadinessDay, Phase, CheckResult } from "./types";
import { validateCheckResult, phaseComplete } from "./checklist";

export interface ReadinessDayView {
  day: ReadinessDay;
  items: ChecklistItem[];
  checks: ReadinessCheck[];
}

function rowToDay(r: Record<string, unknown>): ReadinessDay {
  return {
    id: r.id as number,
    date: r.date as string,
    templateId: r.template_id as number,
    startCompletedBy: (r.start_completed_by as number) ?? null,
    startCompletedAt: (r.start_completed_at as string) ?? null,
    startCrossCheckBy: (r.start_cross_check_by as number) ?? null,
    endCompletedBy: (r.end_completed_by as number) ?? null,
    endCompletedAt: (r.end_completed_at as string) ?? null,
    endCrossCheckBy: (r.end_cross_check_by as number) ?? null,
    status: r.status as ReadinessDay["status"],
  };
}

async function activeTemplateId(): Promise<number> {
  const res = await getClient().execute(
    "SELECT id FROM checklist_templates WHERE active=1 ORDER BY id DESC LIMIT 1",
  );
  if (!res.rows[0]) throw new Error("No active checklist template — seed the DB first.");
  return res.rows[0].id as number;
}

export async function getOrCreateDay(date: string): Promise<ReadinessDay> {
  const existing = await getClient().execute({ sql: "SELECT * FROM readiness_days WHERE date = ?", args: [date] });
  if (existing.rows[0]) return rowToDay(existing.rows[0] as Record<string, unknown>);
  const templateId = await activeTemplateId();
  await getClient().execute({
    sql: "INSERT INTO readiness_days (date, template_id, status) VALUES (?, ?, 'open')",
    args: [date, templateId],
  });
  const created = await getClient().execute({ sql: "SELECT * FROM readiness_days WHERE date = ?", args: [date] });
  return rowToDay(created.rows[0] as Record<string, unknown>);
}

async function itemsForTemplate(templateId: number): Promise<ChecklistItem[]> {
  const res = await getClient().execute({
    sql: "SELECT id, sort_order, category, label, critical FROM checklist_items WHERE template_id=? AND active=1 ORDER BY sort_order",
    args: [templateId],
  });
  return res.rows.map((r) => ({
    id: r.id as number,
    sortOrder: r.sort_order as number,
    category: r.category as string,
    label: r.label as string,
    critical: !!(r.critical as number),
  }));
}

export async function getDayChecks(date: string): Promise<ReadinessDayView> {
  const day = await getOrCreateDay(date);
  const items = await itemsForTemplate(day.templateId);
  const res = await getClient().execute({
    sql: "SELECT item_id, phase, result, comment, checked_by, checked_at FROM readiness_checks WHERE readiness_day_id=?",
    args: [day.id],
  });
  const checks: ReadinessCheck[] = res.rows.map((r) => ({
    itemId: r.item_id as number,
    phase: r.phase as Phase,
    result: r.result as CheckResult,
    comment: (r.comment as string) ?? null,
    checkedBy: r.checked_by as number,
    checkedAt: r.checked_at as string,
  }));
  return { day, items, checks };
}

export async function listReadinessDaysInRange(from: string, to: string): Promise<ReadinessDayView[]> {
  const daysRes = await getClient().execute({
    sql: "SELECT * FROM readiness_days WHERE date >= ? AND date <= ? ORDER BY date DESC",
    args: [from, to],
  });
  const out: ReadinessDayView[] = [];
  for (const row of daysRes.rows) {
    const day = rowToDay(row as Record<string, unknown>);
    const items = await itemsForTemplate(day.templateId);
    const checksRes = await getClient().execute({
      sql: "SELECT item_id, phase, result, comment, checked_by, checked_at FROM readiness_checks WHERE readiness_day_id=?",
      args: [day.id],
    });
    const checks: ReadinessCheck[] = checksRes.rows.map((r) => ({
      itemId: r.item_id as number,
      phase: r.phase as Phase,
      result: r.result as CheckResult,
      comment: (r.comment as string) ?? null,
      checkedBy: r.checked_by as number,
      checkedAt: r.checked_at as string,
    }));
    out.push({ day, items, checks });
  }
  return out;
}

export async function saveCheck(
  date: string,
  input: { itemId: number; phase: Phase; result: CheckResult; comment: string | null },
  userId: number,
): Promise<void> {
  const err = validateCheckResult(input.result, input.comment ?? "");
  if (err) throw new Error(err);
  const day = await getOrCreateDay(date);
  const now = new Date().toISOString();
  // Upsert on (day,item,phase) — the schema's UNIQUE constraint backs this.
  await getClient().execute({
    sql: `INSERT INTO readiness_checks (readiness_day_id, item_id, phase, result, comment, checked_by, checked_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (readiness_day_id, item_id, phase)
          DO UPDATE SET result=excluded.result, comment=excluded.comment,
                        checked_by=excluded.checked_by, checked_at=excluded.checked_at`,
    args: [day.id, input.itemId, input.phase, input.result, input.comment, userId, now],
  });
}

export async function completePhase(
  date: string,
  phase: Phase,
  completerId: number,
): Promise<void> {
  const view = await getDayChecks(date);
  if (!phaseComplete(view.items, view.checks, phase)) {
    throw new Error("All items must be answered before completing this phase.");
  }
  const now = new Date().toISOString();
  // No cross-check / second approval — one supervisor completing the phase is
  // sufficient (changed 2026-07-31 per user request). Cross-check columns left NULL.
  if (phase === "start") {
    await getClient().execute({
      sql: "UPDATE readiness_days SET start_completed_by=?, start_completed_at=?, start_cross_check_by=NULL, status='started' WHERE date=?",
      args: [completerId, now, date],
    });
  } else {
    await getClient().execute({
      sql: "UPDATE readiness_days SET end_completed_by=?, end_completed_at=?, end_cross_check_by=NULL, status='closed' WHERE date=?",
      args: [completerId, now, date],
    });
  }
}
