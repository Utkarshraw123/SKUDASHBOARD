import { getClient } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import type { Role } from "@/lib/auth/session";

async function audit(
  entity: "user" | "operator" | "machine" | "checklist_item",
  entityId: number,
  action: "create" | "update",
  field: string | null,
  oldVal: string | null,
  newVal: string | null,
  adminId: number,
): Promise<void> {
  await getClient().execute({
    sql: `INSERT INTO audit_log (entity, entity_id, action, field, old_value, new_value, changed_by, changed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [entity, entityId, action, field, oldVal, newVal, adminId, new Date().toISOString()],
  });
}

export interface AdminUser {
  id: number;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export async function listUsers(): Promise<AdminUser[]> {
  const res = await getClient().execute("SELECT id, username, name, role, active, created_at FROM users ORDER BY username");
  return res.rows.map((r) => ({
    id: r.id as number,
    username: r.username as string,
    name: r.name as string,
    role: r.role as Role,
    active: !!(r.active as number),
    createdAt: r.created_at as string,
  }));
}

export async function createUser(
  input: { username: string; name: string; role: Role; password: string },
  adminId: number,
): Promise<number> {
  const exists = await getClient().execute({ sql: "SELECT id FROM users WHERE username = ?", args: [input.username] });
  if (exists.rows.length > 0) throw new Error(`A user named "${input.username}" already exists.`);
  const hash = await hashPassword(input.password);
  const res = await getClient().execute({
    sql: "INSERT INTO users (username, password_hash, name, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?) RETURNING id",
    args: [input.username, hash, input.name, input.role, new Date().toISOString()],
  });
  const id = res.rows[0].id as number;
  await audit("user", id, "create", null, null, null, adminId);
  return id;
}

export async function setUserActive(id: number, active: boolean, adminId: number): Promise<void> {
  const before = await getClient().execute({ sql: "SELECT active FROM users WHERE id=?", args: [id] });
  await getClient().execute({ sql: "UPDATE users SET active=? WHERE id=?", args: [active ? 1 : 0, id] });
  await audit("user", id, "update", "active", String(before.rows[0]?.active ?? ""), active ? "1" : "0", adminId);
}

export async function setUserRole(id: number, role: Role, adminId: number): Promise<void> {
  const before = await getClient().execute({ sql: "SELECT role FROM users WHERE id=?", args: [id] });
  await getClient().execute({ sql: "UPDATE users SET role=? WHERE id=?", args: [role, id] });
  await audit("user", id, "update", "role", (before.rows[0]?.role as string) ?? "", role, adminId);
}

export async function resetUserPassword(id: number, password: string, adminId: number): Promise<void> {
  const hash = await hashPassword(password);
  await getClient().execute({ sql: "UPDATE users SET password_hash=? WHERE id=?", args: [hash, id] });
  await audit("user", id, "update", "password_hash", "***", "***", adminId);
}

export interface NamedRow { id: number; name: string; active: boolean; }

function mapNamed(rows: { id: unknown; name: unknown; active: unknown }[]): NamedRow[] {
  return rows.map((r) => ({ id: r.id as number, name: r.name as string, active: !!(r.active as number) }));
}

// --- Operators ---
export async function listAllOperators(): Promise<NamedRow[]> {
  const res = await getClient().execute("SELECT id, name, active FROM operators ORDER BY name");
  return mapNamed(res.rows as never);
}
export async function createOperator(name: string, adminId: number): Promise<number> {
  const res = await getClient().execute({
    sql: "INSERT INTO operators (name, active, created_at) VALUES (?, 1, ?) RETURNING id",
    args: [name, new Date().toISOString()],
  });
  const id = res.rows[0].id as number;
  await audit("operator", id, "create", null, null, name, adminId);
  return id;
}
export async function renameOperator(id: number, name: string, adminId: number): Promise<void> {
  const before = await getClient().execute({ sql: "SELECT name FROM operators WHERE id=?", args: [id] });
  await getClient().execute({ sql: "UPDATE operators SET name=? WHERE id=?", args: [name, id] });
  await audit("operator", id, "update", "name", (before.rows[0]?.name as string) ?? "", name, adminId);
}
export async function setOperatorActive(id: number, active: boolean, adminId: number): Promise<void> {
  await getClient().execute({ sql: "UPDATE operators SET active=? WHERE id=?", args: [active ? 1 : 0, id] });
  await audit("operator", id, "update", "active", active ? "0" : "1", active ? "1" : "0", adminId);
}

// --- Machines ---
export async function listAllMachines(): Promise<NamedRow[]> {
  const res = await getClient().execute("SELECT id, name, active FROM machines ORDER BY name");
  return mapNamed(res.rows as never);
}
export async function createMachine(name: string, adminId: number): Promise<number> {
  const res = await getClient().execute({
    sql: "INSERT INTO machines (name, active, created_at) VALUES (?, 1, ?) RETURNING id",
    args: [name, new Date().toISOString()],
  });
  const id = res.rows[0].id as number;
  await audit("machine", id, "create", null, null, name, adminId);
  return id;
}
export async function renameMachine(id: number, name: string, adminId: number): Promise<void> {
  const before = await getClient().execute({ sql: "SELECT name FROM machines WHERE id=?", args: [id] });
  await getClient().execute({ sql: "UPDATE machines SET name=? WHERE id=?", args: [name, id] });
  await audit("machine", id, "update", "name", (before.rows[0]?.name as string) ?? "", name, adminId);
}
export async function setMachineActive(id: number, active: boolean, adminId: number): Promise<void> {
  await getClient().execute({ sql: "UPDATE machines SET active=? WHERE id=?", args: [active ? 1 : 0, id] });
  await audit("machine", id, "update", "active", active ? "0" : "1", active ? "1" : "0", adminId);
}

export interface ChecklistItemRow { id: number; sortOrder: number; category: string; label: string; critical: boolean; }
export interface ActiveTemplate {
  template: { id: number; code: string; version: string; title: string };
  items: ChecklistItemRow[];
}

async function activeTemplateId(): Promise<number | null> {
  const res = await getClient().execute("SELECT id FROM checklist_templates WHERE active=1 ORDER BY id DESC LIMIT 1");
  return res.rows[0] ? (res.rows[0].id as number) : null;
}

export async function getActiveTemplateWithItems(): Promise<ActiveTemplate | null> {
  const tRes = await getClient().execute("SELECT id, code, version, title FROM checklist_templates WHERE active=1 ORDER BY id DESC LIMIT 1");
  if (!tRes.rows[0]) return null;
  const tid = tRes.rows[0].id as number;
  const iRes = await getClient().execute({
    sql: "SELECT id, sort_order, category, label, critical FROM checklist_items WHERE template_id=? AND active=1 ORDER BY sort_order",
    args: [tid],
  });
  return {
    template: {
      id: tid,
      code: tRes.rows[0].code as string,
      version: tRes.rows[0].version as string,
      title: tRes.rows[0].title as string,
    },
    items: iRes.rows.map((r) => ({
      id: r.id as number,
      sortOrder: r.sort_order as number,
      category: r.category as string,
      label: r.label as string,
      critical: !!(r.critical as number),
    })),
  };
}

export async function addChecklistItem(input: { category: string; label: string; critical: boolean }, adminId: number): Promise<number> {
  const tid = await activeTemplateId();
  if (tid == null) throw new Error("No active checklist template.");
  const maxRes = await getClient().execute({ sql: "SELECT COALESCE(MAX(sort_order),0) AS m FROM checklist_items WHERE template_id=?", args: [tid] });
  const nextOrder = (maxRes.rows[0].m as number) + 1;
  const res = await getClient().execute({
    sql: "INSERT INTO checklist_items (template_id, sort_order, category, label, critical, active) VALUES (?, ?, ?, ?, ?, 1) RETURNING id",
    args: [tid, nextOrder, input.category, input.label, input.critical ? 1 : 0],
  });
  const id = res.rows[0].id as number;
  await audit("checklist_item", id, "create", null, null, input.label, adminId);
  return id;
}

export async function updateChecklistItem(id: number, patch: { label?: string; critical?: boolean }, adminId: number): Promise<void> {
  const before = await getClient().execute({ sql: "SELECT label, critical FROM checklist_items WHERE id=?", args: [id] });
  if (patch.label !== undefined) {
    await getClient().execute({ sql: "UPDATE checklist_items SET label=? WHERE id=?", args: [patch.label, id] });
    await audit("checklist_item", id, "update", "label", (before.rows[0]?.label as string) ?? "", patch.label, adminId);
  }
  if (patch.critical !== undefined) {
    await getClient().execute({ sql: "UPDATE checklist_items SET critical=? WHERE id=?", args: [patch.critical ? 1 : 0, id] });
    await audit("checklist_item", id, "update", "critical", String(before.rows[0]?.critical ?? ""), patch.critical ? "1" : "0", adminId);
  }
}

export async function setChecklistItemActive(id: number, active: boolean, adminId: number): Promise<void> {
  await getClient().execute({ sql: "UPDATE checklist_items SET active=? WHERE id=?", args: [active ? 1 : 0, id] });
  await audit("checklist_item", id, "update", "active", active ? "0" : "1", active ? "1" : "0", adminId);
}
