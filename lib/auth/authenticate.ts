import { getClient } from "@/lib/db/client";
import { verifyPassword } from "./password";
import type { SessionUser, Role } from "./session";

export async function authenticate(username: string, password: string): Promise<SessionUser | null> {
  const res = await getClient().execute({
    sql: "SELECT id, username, name, role, password_hash FROM users WHERE username = ? AND active = 1",
    args: [username],
  });
  const row = res.rows[0];
  if (!row) return null;
  const ok = await verifyPassword(password, row.password_hash as string);
  if (!ok) return null;
  return {
    id: row.id as number,
    username: row.username as string,
    name: row.name as string,
    role: row.role as Role,
  };
}
