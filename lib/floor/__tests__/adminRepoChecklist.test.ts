import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { seed } from "@/lib/db/seed";
import { getActiveTemplateWithItems, addChecklistItem, updateChecklistItem, setChecklistItemActive } from "../adminRepo";

async function adminId() {
  const { getClient } = await import("@/lib/db/client");
  const res = await getClient().execute({
    sql: "INSERT INTO users (username,password_hash,name,role,active,created_at) VALUES ('admin2','x','Admin2','admin',1,?) RETURNING id",
    args: [new Date().toISOString()],
  });
  return res.rows[0].id as number;
}

describe("adminRepo checklist", () => {
  it("reads the active template with its items", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "x" });
    const t = await getActiveTemplateWithItems();
    expect(t!.template.code).toBe("SU04");
    expect(t!.items.length).toBe(15);
  });

  it("adds an item at the end, edits it, and deactivates it (audited)", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "x" });
    const aid = await adminId();
    const id = await addChecklistItem({ category: "Equipment", label: "Forklift charged", critical: false }, aid);
    let t = await getActiveTemplateWithItems();
    expect(t!.items.length).toBe(16);
    expect(t!.items[t!.items.length - 1].id).toBe(id);

    await updateChecklistItem(id, { label: "Forklift fully charged", critical: true }, aid);
    await setChecklistItemActive(id, false, aid);
    t = await getActiveTemplateWithItems();
    // deactivated items are excluded from the active list
    expect(t!.items.find((i) => i.id === id)).toBeUndefined();

    const { getClient } = await import("@/lib/db/client");
    const audit = await getClient().execute("SELECT action,field FROM audit_log WHERE entity='checklist_item'");
    // create + (label,critical updates) + deactivate ≥ 3
    expect(audit.rows.length).toBeGreaterThanOrEqual(3);
  });
});
