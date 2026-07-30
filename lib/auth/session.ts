import { randomUUID } from "node:crypto";
import { getClient } from "@/lib/db/client";

export const SESSION_COOKIE = "wd_floor_sid";
const TTL_DAYS = 30;

export type Role = "supervisor" | "manager" | "admin";
export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: Role;
}

export async function createSession(userId: number): Promise<string> {
  const token = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + TTL_DAYS * 864e5);
  await getClient().execute({
    sql: "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    args: [token, userId, now.toISOString(), expires.toISOString()],
  });
  return token;
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const res = await getClient().execute({
    sql: `SELECT u.id, u.username, u.name, u.role, s.expires_at
          FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.id = ? AND u.active = 1`,
    args: [token],
  });
  const row = res.rows[0];
  if (!row) return null;
  if (new Date(row.expires_at as string) < new Date()) {
    await destroySession(token);
    return null;
  }
  return {
    id: row.id as number,
    username: row.username as string,
    name: row.name as string,
    role: row.role as Role,
  };
}

export async function destroySession(token: string): Promise<void> {
  await getClient().execute({ sql: "DELETE FROM sessions WHERE id = ?", args: [token] });
}
