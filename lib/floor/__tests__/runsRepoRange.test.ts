import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { createRun, listRuns } from "../runsRepo";
import type { RunInput } from "../types";

async function seedRefs() {
  const { getClient } = await import("@/lib/db/client");
  const now = new Date().toISOString();
  await getClient().execute({ sql: "INSERT INTO users (username,password_hash,name,role,active,created_at) VALUES ('s','x','S','supervisor',1,?)", args: [now] });
  await getClient().execute({ sql: "INSERT INTO machines (name,active,created_at) VALUES ('M',1,?)", args: [now] });
  await getClient().execute({ sql: "INSERT INTO operators (name,active,created_at) VALUES ('O',1,?)", args: [now] });
}
function input(date: string): RunInput {
  return { date, shift: "1", machineId: 1, operatorId: 1, productSku: "X", productDesc: "X",
    plannedQty: 100, actualQty: 90, startTime: null, endTime: null, downtimeMin: 0, comments: null };
}

describe("listRuns range", () => {
  it("filters inclusively by from/to", async () => {
    await freshTestDb();
    await seedRefs();
    await createRun(input("2026-07-29"), 1);
    await createRun(input("2026-07-30"), 1);
    await createRun(input("2026-08-01"), 1);
    expect((await listRuns({ from: "2026-07-30", to: "2026-07-31" })).length).toBe(1);
    expect((await listRuns({ from: "2026-07-29", to: "2026-08-01" })).length).toBe(3);
    expect((await listRuns({ from: "2026-07-01", to: "2026-07-31" })).length).toBe(2);
  });
});
