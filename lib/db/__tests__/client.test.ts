import { describe, it, expect, beforeAll } from "vitest";
import { getClient, resetClientForTest } from "../client";

describe("getClient", () => {
  beforeAll(() => {
    process.env.TURSO_DATABASE_URL = "file::memory:?cache=shared";
    delete process.env.TURSO_AUTH_TOKEN;
    resetClientForTest();
  });

  it("returns a working libSQL client", async () => {
    const res = await getClient().execute("SELECT 1 AS one");
    expect(res.rows[0].one).toBe(1);
  });

  it("returns the same instance on repeated calls", () => {
    expect(getClient()).toBe(getClient());
  });
});
