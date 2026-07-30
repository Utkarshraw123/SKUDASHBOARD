import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { authenticate } from "../authenticate";
import { hashPassword } from "../password";

async function seedUser(active = 1) {
  const { getClient } = await import("@/lib/db/client");
  const hash = await hashPassword("pw123");
  await getClient().execute({
    sql: "INSERT INTO users (username, password_hash, name, role, active, created_at) VALUES ('bob',?,?,?,?,?)",
    args: [hash, "Bob", "supervisor", active, new Date().toISOString()],
  });
}

describe("authenticate", () => {
  it("returns the user on correct credentials", async () => {
    await freshTestDb();
    await seedUser();
    const user = await authenticate("bob", "pw123");
    expect(user).toMatchObject({ username: "bob", role: "supervisor" });
  });

  it("returns null on wrong password", async () => {
    await freshTestDb();
    await seedUser();
    expect(await authenticate("bob", "nope")).toBeNull();
  });

  it("returns null for inactive or unknown user", async () => {
    await freshTestDb();
    await seedUser(0);
    expect(await authenticate("bob", "pw123")).toBeNull();
    expect(await authenticate("ghost", "pw123")).toBeNull();
  });
});
