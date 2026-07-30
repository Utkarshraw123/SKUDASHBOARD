import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { createSession, getSessionUser, destroySession } from "../session";

async function makeUser() {
  const { getClient } = await import("@/lib/db/client");
  const res = await getClient().execute({
    sql: "INSERT INTO users (username, password_hash, name, role, active, created_at) VALUES ('sup','x','Sup','supervisor',1,?) RETURNING id",
    args: [new Date().toISOString()],
  });
  return res.rows[0].id as number;
}

describe("sessions", () => {
  it("creates a session and resolves the user", async () => {
    await freshTestDb();
    const userId = await makeUser();
    const token = await createSession(userId);
    expect(typeof token).toBe("string");
    const user = await getSessionUser(token);
    expect(user).toMatchObject({ id: userId, username: "sup", role: "supervisor" });
  });

  it("returns null for unknown/undefined tokens", async () => {
    await freshTestDb();
    expect(await getSessionUser(undefined)).toBeNull();
    expect(await getSessionUser("nope")).toBeNull();
  });

  it("destroys a session", async () => {
    await freshTestDb();
    const userId = await makeUser();
    const token = await createSession(userId);
    await destroySession(token);
    expect(await getSessionUser(token)).toBeNull();
  });
});
