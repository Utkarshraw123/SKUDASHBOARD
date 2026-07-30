import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { createRun, getRun, listRuns, updateRun, voidRun } from "../runsRepo";
import type { RunInput } from "../types";

async function seedRefs() {
  const { getClient } = await import("@/lib/db/client");
  const now = new Date().toISOString();
  await getClient().execute({ sql: "INSERT INTO users (username,password_hash,name,role,active,created_at) VALUES ('sup','x','Sup','supervisor',1,?)", args: [now] });
  await getClient().execute({ sql: "INSERT INTO machines (name,active,created_at) VALUES ('M1',1,?)", args: [now] });
  await getClient().execute({ sql: "INSERT INTO operators (name,active,created_at) VALUES ('Op1',1,?)", args: [now] });
}

function input(p: Partial<RunInput> = {}): RunInput {
  return {
    date: "2026-07-30", shift: "1", machineId: 1, operatorId: 1,
    productSku: "30000001", productDesc: "Iron", plannedQty: 100, actualQty: 90,
    startTime: "2026-07-30T06:00:00Z", endTime: "2026-07-30T10:00:00Z",
    downtimeMin: 0, comments: null, ...p,
  };
}

describe("runsRepo", () => {
  it("creates a run, stamps logged_by, and writes a create audit row", async () => {
    await freshTestDb();
    await seedRefs();
    const id = await createRun(input(), 1);
    const run = await getRun(id);
    expect(run!.actualQty).toBe(90);
    expect(run!.loggedBy).toBe(1);
    expect(run!.void).toBe(false);
    const { getClient } = await import("@/lib/db/client");
    const audit = await getClient().execute("SELECT * FROM audit_log WHERE entity='run' AND action='create'");
    expect(audit.rows.length).toBe(1);
  });

  it("lists runs for a date", async () => {
    await freshTestDb();
    await seedRefs();
    await createRun(input({ date: "2026-07-30" }), 1);
    await createRun(input({ date: "2026-07-31" }), 1);
    expect((await listRuns({ date: "2026-07-30" })).length).toBe(1);
    expect((await listRuns({})).length).toBe(2);
  });

  it("updates a run and writes one audit row per changed field", async () => {
    await freshTestDb();
    await seedRefs();
    const id = await createRun(input({ actualQty: 90 }), 1);
    await updateRun(id, input({ actualQty: 95, comments: "reweighed" }), 1);
    const run = await getRun(id);
    expect(run!.actualQty).toBe(95);
    const { getClient } = await import("@/lib/db/client");
    const audit = await getClient().execute("SELECT field FROM audit_log WHERE entity='run' AND action='update'");
    const fields = audit.rows.map((r) => r.field);
    expect(fields).toContain("actualQty");
    expect(fields).toContain("comments");
  });

  it("voids a run softly (excluded from totals, still present) and audits it", async () => {
    await freshTestDb();
    await seedRefs();
    const id = await createRun(input(), 1);
    await voidRun(id, "duplicate", 1);
    const run = await getRun(id);
    expect(run!.void).toBe(true);
    expect(run!.voidReason).toBe("duplicate");
    const { getClient } = await import("@/lib/db/client");
    const audit = await getClient().execute("SELECT * FROM audit_log WHERE entity='run' AND action='void'");
    expect(audit.rows.length).toBe(1);
  });
});
