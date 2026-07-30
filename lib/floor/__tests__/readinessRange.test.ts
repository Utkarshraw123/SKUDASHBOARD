import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { seed } from "@/lib/db/seed";
import { getOrCreateDay, saveCheck, listReadinessDaysInRange } from "../readinessRepo";

describe("listReadinessDaysInRange", () => {
  it("returns only days in range, each with its items + checks, newest first", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "x" });
    const { getClient } = await import("@/lib/db/client");
    await getClient().execute({ sql: "INSERT INTO users (username,password_hash,name,role,active,created_at) VALUES ('u','x','U','supervisor',1,?)", args: [new Date().toISOString()] });

    await getOrCreateDay("2026-07-29");
    await getOrCreateDay("2026-07-30");
    await getOrCreateDay("2026-08-02");

    // Add one check to the 30th using a real item id
    const item = await getClient().execute("SELECT id FROM checklist_items ORDER BY sort_order LIMIT 1");
    await saveCheck("2026-07-30", { itemId: item.rows[0].id as number, phase: "start", result: "confirm", comment: null }, 1);

    const rows = await listReadinessDaysInRange("2026-07-29", "2026-07-31");
    expect(rows.map((r) => r.day.date)).toEqual(["2026-07-30", "2026-07-29"]);
    const checked = rows.find((r) => r.day.date === "2026-07-30")!;
    expect(checked.items.length).toBe(15);
    expect(checked.checks.length).toBe(1);
  });
});
