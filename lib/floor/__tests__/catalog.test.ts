import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { listMachines, listOperators, skuOptionsFrom } from "../catalog";

describe("catalog DB lists", () => {
  it("lists active machines and operators by name", async () => {
    await freshTestDb();
    const { getClient } = await import("@/lib/db/client");
    const now = new Date().toISOString();
    await getClient().execute({ sql: "INSERT INTO machines (name,active,created_at) VALUES ('Zeta',1,?)", args: [now] });
    await getClient().execute({ sql: "INSERT INTO machines (name,active,created_at) VALUES ('Alpha',1,?)", args: [now] });
    await getClient().execute({ sql: "INSERT INTO machines (name,active,created_at) VALUES ('Old',0,?)", args: [now] });
    await getClient().execute({ sql: "INSERT INTO operators (name,active,created_at) VALUES ('Bob',1,?)", args: [now] });
    const machines = await listMachines();
    expect(machines.map((m) => m.name)).toEqual(["Alpha", "Zeta"]);
    expect((await listOperators()).length).toBe(1);
  });
});

describe("skuOptionsFrom", () => {
  it("maps rows to {sku,desc} dropping blanks", () => {
    const opts = skuOptionsFrom([
      { skuCode: "30000001", description: "Iron" } as any,
      { skuCode: "", description: "junk" } as any,
      { skuCode: "30000002", description: "Zinc" } as any,
    ]);
    expect(opts).toEqual([
      { sku: "30000001", desc: "Iron" },
      { sku: "30000002", desc: "Zinc" },
    ]);
  });
});
