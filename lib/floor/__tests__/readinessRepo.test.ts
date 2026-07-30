import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { seed } from "@/lib/db/seed";
import { getOrCreateDay, getDayChecks, saveCheck, completePhase } from "../readinessRepo";

async function twoUsers() {
  const { getClient } = await import("@/lib/db/client");
  const now = new Date().toISOString();
  await getClient().execute({ sql: "INSERT INTO users (username,password_hash,name,role,active,created_at) VALUES ('a','x','A','supervisor',1,?)", args: [now] });
  await getClient().execute({ sql: "INSERT INTO users (username,password_hash,name,role,active,created_at) VALUES ('b','x','B','supervisor',1,?)", args: [now] });
}

describe("readinessRepo", () => {
  it("creates a day bound to the active SU04 template", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "x" });
    const day = await getOrCreateDay("2026-07-30");
    expect(day.date).toBe("2026-07-30");
    expect(day.status).toBe("open");
    // second call returns the same row
    expect((await getOrCreateDay("2026-07-30")).id).toBe(day.id);
  });

  it("saves a check and rejects a deny without comment", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "x" });
    await twoUsers();
    const view = await getDayChecks("2026-07-30");
    const first = view.items[0];
    await expect(saveCheck("2026-07-30", { itemId: first.id, phase: "start", result: "deny", comment: "" }, 2))
      .rejects.toThrow(/comment is required/i);
    await saveCheck("2026-07-30", { itemId: first.id, phase: "start", result: "confirm", comment: null }, 2);
    const after = await getDayChecks("2026-07-30");
    expect(after.checks.find((c) => c.itemId === first.id && c.phase === "start")!.result).toBe("confirm");
  });

  it("completes a phase only when all items answered and cross-check differs", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "x" });
    await twoUsers();
    const view = await getDayChecks("2026-07-30");
    for (const it of view.items) {
      await saveCheck("2026-07-30", { itemId: it.id, phase: "start", result: "confirm", comment: null }, 2);
    }
    await expect(completePhase("2026-07-30", "start", 2, 2)).rejects.toThrow(/different user/i);
    await completePhase("2026-07-30", "start", 2, 3);
    const day = await getOrCreateDay("2026-07-30");
    expect(day.startCompletedBy).toBe(2);
    expect(day.startCrossCheckBy).toBe(3);
    expect(day.status).toBe("started");
  });

  it("refuses to complete a phase with unanswered items", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "x" });
    await twoUsers();
    await expect(completePhase("2026-07-30", "start", 2, 3)).rejects.toThrow(/all items/i);
  });
});
