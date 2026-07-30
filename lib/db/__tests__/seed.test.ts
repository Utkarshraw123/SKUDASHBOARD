import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { seed } from "../seed";

describe("seed", () => {
  it("loads SU04 V1 with 15 items and an admin user", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "test-pass" });

    const tpl = await db.execute("SELECT * FROM checklist_templates WHERE code='SU04' AND version='V1'");
    expect(tpl.rows.length).toBe(1);

    const items = await db.execute("SELECT category, label FROM checklist_items");
    expect(items.rows.length).toBe(15);
    expect(items.rows.some((r) => r.label === "The waste bins are empty")).toBe(true);

    const admin = await db.execute("SELECT username, role FROM users WHERE username='admin'");
    expect(admin.rows[0].role).toBe("admin");
  });

  it("is idempotent (no duplicate template/items on re-run)", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "x" });
    await seed(db, { adminPassword: "x" });
    const items = await db.execute("SELECT COUNT(*) AS c FROM checklist_items");
    expect(items.rows[0].c).toBe(15);
  });
});
