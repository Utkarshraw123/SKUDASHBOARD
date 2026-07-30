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
