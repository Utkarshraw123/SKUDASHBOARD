import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { resolveUser } from "../require";
import { createSession } from "../session";

async function makeUser(role = "supervisor") {
  const { getClient } = await import("@/lib/db/client");
  const res = await getClient().execute({
    sql: "INSERT INTO users (username, password_hash, name, role, active, created_at) VALUES ('u','x','U',?,1,?) RETURNING id",
    args: [role, new Date().toISOString()],
  });
  return res.rows[0].id as number;
}

describe("resolveUser", () => {
  it("resolves a valid token to a user", async () => {
    await freshTestDb();
    const id = await makeUser();
    const token = await createSession(id);
    expect(await resolveUser(token)).toMatchObject({ id, role: "supervisor" });
  });

  it("resolves undefined for no token", async () => {
    await freshTestDb();
    expect(await resolveUser(undefined)).toBeNull();
  });
});
