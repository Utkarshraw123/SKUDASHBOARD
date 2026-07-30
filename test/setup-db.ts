import { getClient, resetClientForTest } from "@/lib/db/client";
import { applySchema } from "@/lib/db/migrate";

// Point the client at a fresh in-memory DB and apply the schema.
// Call in beforeEach so each test starts clean.
export async function freshTestDb() {
  // Plain ":memory:" gives each fresh client its OWN private in-memory DB.
  // (A shared-cache URL would persist rows across resets, breaking isolation.)
  process.env.TURSO_DATABASE_URL = ":memory:";
  delete process.env.TURSO_AUTH_TOKEN;
  resetClientForTest();
  await applySchema(getClient());
  return getClient();
}
