import { describe, it, expect, beforeEach } from "vitest";
import { freshTestDb } from "@/test/setup-db";

describe("applySchema", () => {
  it("creates all expected tables", async () => {
    const db = await freshTestDb();
    const res = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    const tables = res.rows.map((r) => r.name);
    for (const t of [
      "users", "operators", "machines", "checklist_templates",
      "checklist_items", "readiness_days", "readiness_checks",
      "runs", "audit_log", "sessions",
    ]) {
      expect(tables).toContain(t);
    }
  });

  it("is idempotent (safe to run twice)", async () => {
    const db = await freshTestDb();
    const { applySchema } = await import("../migrate");
    await applySchema(db); // second application must not throw
    expect(true).toBe(true);
  });
});
