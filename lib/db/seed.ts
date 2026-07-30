import type { Client } from "@libsql/client";
import { getClient } from "./client";
import { applySchema } from "./migrate";
import { hashPassword } from "@/lib/auth/password";

const SU04_ITEMS: { category: string; label: string; critical: boolean }[] = [
  { category: "Environment", label: "Area is clear from debris", critical: false },
  { category: "Environment", label: "Ventilation units are working", critical: false },
  { category: "Environment", label: "There are no signs of pest activity", critical: true },
  { category: "Environment", label: "The yard is clear from debris", critical: false },
  { category: "Environment", label: "The waste bins are empty", critical: false },
  { category: "Product", label: "There are no finished goods left out of boxes on pallets", critical: false },
  { category: "Product", label: "There is no concern of over-hanging pallets on racking", critical: true },
  { category: "Product", label: "The pallets are clean to an acceptable level", critical: false },
  { category: "Site Security", label: "Shutter doors are locked upon arrival and when leaving", critical: true },
  { category: "Site Security", label: "The fire exit door is functional and shut", critical: true },
  { category: "Site Security", label: "Product or pallets are not left outside", critical: false },
  { category: "Equipment", label: "Scales are working and in good condition", critical: false },
  { category: "Equipment", label: "Safety knives are sharp and free from damage", critical: true },
  { category: "Personnel", label: "Correct PPE is being worn", critical: true },
  { category: "Personnel", label: "Personnel are fit for work", critical: false },
];

const SAMPLE_MACHINES = ["Packing DE", "Batching Boxes", "Boxing", "AutoPack"];
const SAMPLE_OPERATORS = ["Priyanka", "Omar", "Anna", "Zehni", "Rishi"];

export async function seed(client: Client, opts: { adminPassword?: string } = {}): Promise<void> {
  const now = new Date().toISOString();

  // Template (idempotent via UNIQUE(code, version))
  await client.execute({
    sql: "INSERT OR IGNORE INTO checklist_templates (code, version, title, active, created_at) VALUES (?, ?, ?, 1, ?)",
    args: ["SU04", "V1", "Warehouse Start Up Checks", now],
  });
  const tplRes = await client.execute({
    sql: "SELECT id FROM checklist_templates WHERE code='SU04' AND version='V1'",
    args: [],
  });
  const templateId = tplRes.rows[0].id as number;

  // Items — only insert if none exist for this template (idempotent)
  const existing = await client.execute({
    sql: "SELECT COUNT(*) AS c FROM checklist_items WHERE template_id = ?",
    args: [templateId],
  });
  if ((existing.rows[0].c as number) === 0) {
    let order = 1;
    for (const it of SU04_ITEMS) {
      await client.execute({
        sql: "INSERT INTO checklist_items (template_id, sort_order, category, label, critical, active) VALUES (?, ?, ?, ?, ?, 1)",
        args: [templateId, order++, it.category, it.label, it.critical ? 1 : 0],
      });
    }
  }

  // Admin user
  const adminExists = await client.execute({ sql: "SELECT id FROM users WHERE username='admin'", args: [] });
  if (adminExists.rows.length === 0) {
    const hash = await hashPassword(opts.adminPassword ?? "change-me");
    await client.execute({
      sql: "INSERT INTO users (username, password_hash, name, role, active, created_at) VALUES (?, ?, ?, 'admin', 1, ?)",
      args: ["admin", hash, "Administrator", now],
    });
  }

  // Sample machines/operators (idempotent by name)
  for (const m of SAMPLE_MACHINES) {
    const r = await client.execute({ sql: "SELECT id FROM machines WHERE name = ?", args: [m] });
    if (r.rows.length === 0)
      await client.execute({ sql: "INSERT INTO machines (name, active, created_at) VALUES (?, 1, ?)", args: [m, now] });
  }
  for (const o of SAMPLE_OPERATORS) {
    const r = await client.execute({ sql: "SELECT id FROM operators WHERE name = ?", args: [o] });
    if (r.rows.length === 0)
      await client.execute({ sql: "INSERT INTO operators (name, active, created_at) VALUES (?, 1, ?)", args: [o, now] });
  }
}

// CLI entrypoint: `npm run db:seed` (applies schema first for a fresh DB)
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  const client = getClient();
  applySchema(client)
    .then(() => seed(client, { adminPassword: process.env.SEED_ADMIN_PASSWORD }))
    .then(() => { console.log("Seed complete."); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
