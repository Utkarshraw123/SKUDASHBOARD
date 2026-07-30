import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "@libsql/client";
import { getClient } from "./client";

// Apply schema.sql statement-by-statement (libSQL executes one statement/call).
export async function applySchema(client: Client): Promise<void> {
  const raw = readFileSync(join(process.cwd(), "lib/db/schema.sql"), "utf8");
  // Strip full-line comments first so a comment preceding a statement does not
  // cause the whole statement to be discarded when we filter by leading "--".
  const sql = raw
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await client.execute(stmt);
  }
}

// CLI entrypoint: `npm run db:migrate`
if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  applySchema(getClient())
    .then(() => { console.log("Schema applied."); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
