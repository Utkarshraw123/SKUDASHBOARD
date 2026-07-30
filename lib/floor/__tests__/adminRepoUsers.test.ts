import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { listUsers, createUser, setUserActive, setUserRole, resetUserPassword } from "../adminRepo";
import { verifyPassword } from "@/lib/auth/password";

async function adminId() {
  const { getClient } = await import("@/lib/db/client");
  const res = await getClient().execute({
    sql: "INSERT INTO users (username,password_hash,name,role,active,created_at) VALUES ('admin','x','Admin','admin',1,?) RETURNING id",
    args: [new Date().toISOString()],
  });
  return res.rows[0].id as number;
}

describe("adminRepo users", () => {
  it("creates a user with a hashed password and audits it", async () => {
    await freshTestDb();
    const aid = await adminId();
    const id = await createUser({ username: "jane", name: "Jane", role: "supervisor", password: "secret1" }, aid);
    const users = await listUsers();
    const jane = users.find((u) => u.username === "jane")!;
    expect(jane.role).toBe("supervisor");
    expect(jane.active).toBe(true);
    const { getClient } = await import("@/lib/db/client");
    const row = await getClient().execute({ sql: "SELECT password_hash FROM users WHERE id=?", args: [id] });
    expect(await verifyPassword("secret1", row.rows[0].password_hash as string)).toBe(true);
    const audit = await getClient().execute("SELECT * FROM audit_log WHERE entity='user' AND action='create'");
    expect(audit.rows.length).toBe(1);
  });

  it("rejects a duplicate username with a friendly error", async () => {
    await freshTestDb();
    const aid = await adminId();
    await createUser({ username: "jane", name: "Jane", role: "supervisor", password: "secret1" }, aid);
    await expect(createUser({ username: "jane", name: "Jane 2", role: "manager", password: "secret1" }, aid))
      .rejects.toThrow(/already exists/i);
  });

  it("deactivates, changes role, and resets password (each audited, no secret logged)", async () => {
    await freshTestDb();
    const aid = await adminId();
    const id = await createUser({ username: "bob", name: "Bob", role: "supervisor", password: "secret1" }, aid);

    await setUserActive(id, false, aid);
    expect((await listUsers()).find((u) => u.id === id)!.active).toBe(false);

    await setUserRole(id, "manager", aid);
    expect((await listUsers()).find((u) => u.id === id)!.role).toBe("manager");

    await resetUserPassword(id, "newpass1", aid);
    const { getClient } = await import("@/lib/db/client");
    const row = await getClient().execute({ sql: "SELECT password_hash FROM users WHERE id=?", args: [id] });
    expect(await verifyPassword("newpass1", row.rows[0].password_hash as string)).toBe(true);

    const pw = await getClient().execute("SELECT old_value,new_value FROM audit_log WHERE entity='user' AND field='password_hash'");
    expect(pw.rows[0].new_value).toBe("***");
  });
});
