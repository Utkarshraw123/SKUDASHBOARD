import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import {
  listAllOperators, createOperator, renameOperator, setOperatorActive,
  listAllMachines, createMachine, renameMachine, setMachineActive,
} from "../adminRepo";

async function adminId() {
  const { getClient } = await import("@/lib/db/client");
  const res = await getClient().execute({
    sql: "INSERT INTO users (username,password_hash,name,role,active,created_at) VALUES ('admin','x','Admin','admin',1,?) RETURNING id",
    args: [new Date().toISOString()],
  });
  return res.rows[0].id as number;
}

describe("adminRepo operators/machines", () => {
  it("creates, renames, and deactivates an operator (audited)", async () => {
    await freshTestDb();
    const AID = await adminId();
    const id = await createOperator("Priya", AID);
    await renameOperator(id, "Priyanka", AID);
    await setOperatorActive(id, false, AID);
    const all = await listAllOperators();
    const row = all.find((o) => o.id === id)!;
    expect(row.name).toBe("Priyanka");
    expect(row.active).toBe(false);
    const { getClient } = await import("@/lib/db/client");
    const audit = await getClient().execute("SELECT action,field FROM audit_log WHERE entity='operator'");
    expect(audit.rows.length).toBe(3); // create + rename + deactivate
  });

  it("creates, renames, and deactivates a machine (audited)", async () => {
    await freshTestDb();
    const AID = await adminId();
    const id = await createMachine("AutoPack", AID);
    await renameMachine(id, "AutoPack 2", AID);
    await setMachineActive(id, false, AID);
    const row = (await listAllMachines()).find((m) => m.id === id)!;
    expect(row.name).toBe("AutoPack 2");
    expect(row.active).toBe(false);
    const { getClient } = await import("@/lib/db/client");
    const audit = await getClient().execute("SELECT * FROM audit_log WHERE entity='machine'");
    expect(audit.rows.length).toBe(3);
  });
});
