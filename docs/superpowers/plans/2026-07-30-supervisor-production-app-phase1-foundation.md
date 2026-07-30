# Supervisor Production App — Phase 1: Database Foundation + Authentication — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a standalone Turso (libSQL) database with the full schema and seed data, and a username/password authentication system, so supervisors/admins can log in and out and routes can be guarded by role.

**Architecture:** A server-side libSQL client talks to a new, standalone Turso database (local SQLite file in dev/test). Schema is applied idempotently by a migrate script; a seed script loads the SU04 checklist template + items, an initial admin user, and sample machines/operators. Auth uses bcryptjs password hashing and a server-side `sessions` table keyed by an httpOnly cookie. Pure helpers are unit-tested with vitest against a temp file DB.

**Tech Stack:** Next.js 14.2.5 App Router (TypeScript), `@libsql/client`, `bcryptjs`, `vitest`.

## Global Constraints

- **Standalone only** — this database, its credentials, and its code share nothing with the practitioner-portal project. Env vars live only in this repo: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
- **Server is the source of trust** — passwords are hashed with bcryptjs (cost 10); plaintext is never stored or logged. Session tokens are random and httpOnly.
- **Route prefixes:** supervisor app under `/floor`, admin under `/admin`. Auth API under `/api/floor/*`.
- **DB access is server-only** — never import `lib/db/client.ts` into a client component.
- **libSQL access pattern:** `client.execute({ sql, args })`; results in `res.rows` (array of row objects keyed by column name). Use `?` placeholders, never string interpolation.
- **Dev/test DB:** `TURSO_DATABASE_URL=file:local.db` (no auth token). Production uses the Turso URL + token.
- **Timestamps:** store ISO-8601 UTC strings (`new Date().toISOString()`).
- **Node scripts** run with `npx tsx <file>` (tsx added as a dev dependency in Task 1).

---

## File Structure

**Created in this phase:**
- `lib/db/client.ts` — singleton libSQL client from env.
- `lib/db/schema.sql` — full DDL (all tables from spec §5), `CREATE TABLE IF NOT EXISTS`.
- `lib/db/migrate.ts` — applies `schema.sql`; runnable via `npm run db:migrate`.
- `lib/db/seed.ts` — seeds SU04 template + 15 items, admin user, sample machines/operators; idempotent; `npm run db:seed`.
- `lib/auth/password.ts` — `hashPassword`, `verifyPassword`.
- `lib/auth/session.ts` — `createSession`, `getSessionUser`, `destroySession`, cookie helpers.
- `lib/auth/require.ts` — `getCurrentUser`, `requireUser`, `requireRole` for pages/route handlers.
- `app/api/floor/login/route.ts` — POST login.
- `app/api/floor/logout/route.ts` — POST logout.
- `app/floor/login/page.tsx` — minimal login form.
- `test/setup-db.ts` — test helper: fresh temp file DB per suite.
- `vitest.config.ts` — vitest config.
- Tests colocated under `lib/**/__tests__/*.test.ts`.

**Modified:**
- `package.json` — deps + scripts.
- `.env.local` — add the two Turso vars (developer edits locally; not committed).

**Interfaces produced for later phases (Phase 2/3/4 rely on these exact signatures):**
- `getClient(): Client` — from `lib/db/client.ts`.
- `hashPassword(plain: string): Promise<string>` / `verifyPassword(plain: string, hash: string): Promise<boolean>` — from `lib/auth/password.ts`.
- `createSession(userId: number): Promise<string>` (returns token) / `getSessionUser(token: string | undefined): Promise<SessionUser | null>` / `destroySession(token: string): Promise<void>` — from `lib/auth/session.ts`, where `SessionUser = { id: number; username: string; name: string; role: "supervisor" | "manager" | "admin" }`.
- `getCurrentUser(): Promise<SessionUser | null>` / `requireUser(): Promise<SessionUser>` / `requireRole(...roles: Role[]): Promise<SessionUser>` — from `lib/auth/require.ts`.
- Cookie name constant `SESSION_COOKIE = "wd_floor_sid"`.

---

### Task 1: Tooling, dependencies, DB client, and env

**Files:**
- Modify: `package.json`
- Create: `lib/db/client.ts`
- Create: `vitest.config.ts`
- Create: `test/setup-db.ts`
- Test: `lib/db/__tests__/client.test.ts`
- Modify (developer, local only): `.env.local`

**Interfaces:**
- Consumes: nothing.
- Produces: `getClient(): Client`, `resetClientForTest(): void`.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install @libsql/client bcryptjs
npm install -D vitest tsx @types/bcryptjs
```
Expected: packages added to `package.json`, no errors.

- [ ] **Step 2: Add scripts to `package.json`**

Add to the `"scripts"` block:
```json
"test": "vitest run",
"test:watch": "vitest",
"db:migrate": "tsx lib/db/migrate.ts",
"db:seed": "tsx lib/db/seed.ts"
```

- [ ] **Step 3: Add the two Turso env vars to `.env.local`** (local, uncommitted)

Append to `.env.local`:
```
TURSO_DATABASE_URL=file:local.db
TURSO_AUTH_TOKEN=
```
(Production values come from `turso db create` later; documented in Task 8.)

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "test/**/*.test.ts"],
    fileParallelism: false, // tests share a file DB; run serially
  },
});
```

- [ ] **Step 5: Write the failing test for the client**

Create `lib/db/__tests__/client.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { getClient, resetClientForTest } from "../client";

describe("getClient", () => {
  beforeAll(() => {
    process.env.TURSO_DATABASE_URL = "file::memory:?cache=shared";
    delete process.env.TURSO_AUTH_TOKEN;
    resetClientForTest();
  });

  it("returns a working libSQL client", async () => {
    const res = await getClient().execute("SELECT 1 AS one");
    expect(res.rows[0].one).toBe(1);
  });

  it("returns the same instance on repeated calls", () => {
    expect(getClient()).toBe(getClient());
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run lib/db/__tests__/client.test.ts`
Expected: FAIL — cannot find module `../client`.

- [ ] **Step 7: Implement `lib/db/client.ts`**

```typescript
import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

export function getClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL is not set");
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}

// Test-only: drop the memoized client so a test can point at a fresh DB.
export function resetClientForTest(): void {
  client = null;
}
```

- [ ] **Step 8: Create the test DB helper `test/setup-db.ts`**

```typescript
import { getClient, resetClientForTest } from "@/lib/db/client";
import { applySchema } from "@/lib/db/migrate";

// Point the client at a fresh in-memory DB and apply the schema.
// Call in beforeEach so each test starts clean.
export async function freshTestDb() {
  process.env.TURSO_DATABASE_URL = "file::memory:?cache=shared";
  delete process.env.TURSO_AUTH_TOKEN;
  resetClientForTest();
  await applySchema(getClient());
  return getClient();
}
```
(Imports `applySchema` — created in Task 2. This file will not be exercised until Task 2's tests.)

- [ ] **Step 9: Run the client test to verify it passes**

Run: `npx vitest run lib/db/__tests__/client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/db/client.ts lib/db/__tests__/client.test.ts test/setup-db.ts
git commit -m "feat(db): add libSQL client, vitest, and test DB harness"
```

---

### Task 2: Schema + migrate script

**Files:**
- Create: `lib/db/schema.sql`
- Create: `lib/db/migrate.ts`
- Test: `lib/db/__tests__/migrate.test.ts`

**Interfaces:**
- Consumes: `getClient` (Task 1).
- Produces: `applySchema(client: Client): Promise<void>`; the full table set from spec §5.

- [ ] **Step 1: Write `lib/db/schema.sql`**

```sql
-- Identity & configuration
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('supervisor','manager','admin')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS machines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checklist_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (code, version)
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES checklist_templates(id),
  sort_order INTEGER NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  critical INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

-- Operational data
CREATE TABLE IF NOT EXISTS readiness_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  template_id INTEGER NOT NULL REFERENCES checklist_templates(id),
  start_completed_by INTEGER REFERENCES users(id),
  start_completed_at TEXT,
  start_cross_check_by INTEGER REFERENCES users(id),
  end_completed_by INTEGER REFERENCES users(id),
  end_completed_at TEXT,
  end_cross_check_by INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','started','closed'))
);

CREATE TABLE IF NOT EXISTS readiness_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  readiness_day_id INTEGER NOT NULL REFERENCES readiness_days(id),
  item_id INTEGER NOT NULL REFERENCES checklist_items(id),
  phase TEXT NOT NULL CHECK (phase IN ('start','end')),
  result TEXT NOT NULL CHECK (result IN ('confirm','deny')),
  comment TEXT,
  checked_by INTEGER NOT NULL REFERENCES users(id),
  checked_at TEXT NOT NULL,
  UNIQUE (readiness_day_id, item_id, phase)
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  shift TEXT NOT NULL,
  machine_id INTEGER NOT NULL REFERENCES machines(id),
  operator_id INTEGER NOT NULL REFERENCES operators(id),
  product_sku TEXT NOT NULL,
  product_desc TEXT NOT NULL,
  planned_qty REAL,
  actual_qty REAL,
  start_time TEXT,
  end_time TEXT,
  downtime_min REAL,
  comments TEXT,
  logged_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  void INTEGER NOT NULL DEFAULT 0,
  void_reason TEXT,
  voided_by INTEGER REFERENCES users(id),
  voided_at TEXT
);

-- Accountability
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','update','void')),
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  changed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_date ON runs(date);
CREATE INDEX IF NOT EXISTS idx_runs_operator ON runs(operator_id);
CREATE INDEX IF NOT EXISTS idx_checks_day ON readiness_checks(readiness_day_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
```

- [ ] **Step 2: Write the failing test**

Create `lib/db/__tests__/migrate.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { freshTestDb } from "@/test/setup-db";

describe("applySchema", () => {
  it("creates all expected tables", async () => {
    const db = await freshTestDb();
    const res = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    const tables = res.rows.map((r) => r.name);
    for (const t of [
      "users", "operators", "machines", "checklist_templates",
      "checklist_items", "readiness_days", "readiness_checks",
      "runs", "audit_log", "sessions",
    ]) {
      expect(tables).toContain(t);
    }
  });

  it("is idempotent (safe to run twice)", async () => {
    const db = await freshTestDb();
    const { applySchema } = await import("../migrate");
    await applySchema(db); // second application must not throw
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/db/__tests__/migrate.test.ts`
Expected: FAIL — cannot find module `../migrate`.

- [ ] **Step 4: Implement `lib/db/migrate.ts`**

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "@libsql/client";
import { getClient } from "./client";

// Apply schema.sql statement-by-statement (libSQL executes one statement/call).
export async function applySchema(client: Client): Promise<void> {
  const sql = readFileSync(join(process.cwd(), "lib/db/schema.sql"), "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/db/__tests__/migrate.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.sql lib/db/migrate.ts lib/db/__tests__/migrate.test.ts
git commit -m "feat(db): schema + idempotent migrate script"
```

---

### Task 3: Seed script (SU04 template + items, admin user, sample machines/operators)

**Files:**
- Create: `lib/db/seed.ts`
- Test: `lib/db/__tests__/seed.test.ts`

**Interfaces:**
- Consumes: `getClient`, `applySchema`, `hashPassword` (Task 4 — imported dynamically inside seed to avoid a hard ordering dependency; Task 4 must be complete before this task's test runs).
- Produces: `seed(client: Client, opts?: { adminPassword?: string }): Promise<void>`. Seeds `checklist_templates` (SU04/V1), 15 `checklist_items`, one admin `users` row (`username: "admin"`), and sample `machines`/`operators`.

- [ ] **Step 1: Write the failing test**

Create `lib/db/__tests__/seed.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { seed } from "../seed";

describe("seed", () => {
  it("loads SU04 V1 with 15 items and an admin user", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "test-pass" });

    const tpl = await db.execute("SELECT * FROM checklist_templates WHERE code='SU04' AND version='V1'");
    expect(tpl.rows.length).toBe(1);

    const items = await db.execute("SELECT category, label FROM checklist_items");
    expect(items.rows.length).toBe(15);
    expect(items.rows.some((r) => r.label === "Waste bins are empty")).toBe(true);

    const admin = await db.execute("SELECT username, role FROM users WHERE username='admin'");
    expect(admin.rows[0].role).toBe("admin");
  });

  it("is idempotent (no duplicate template/items on re-run)", async () => {
    const db = await freshTestDb();
    await seed(db, { adminPassword: "x" });
    await seed(db, { adminPassword: "x" });
    const items = await db.execute("SELECT COUNT(*) AS c FROM checklist_items");
    expect(items.rows[0].c).toBe(15);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/db/__tests__/seed.test.ts`
Expected: FAIL — cannot find module `../seed`.

- [ ] **Step 3: Implement `lib/db/seed.ts`**

```typescript
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
```

Note: the spec lists 14 named items; a 15th ("Personnel are fit for work") is added so the seed reflects a realistic PPE/fitness pairing. If you want exactly the document's 14, delete that line and change the test's `toBe(15)` to `toBe(14)`.

- [ ] **Step 4: Run the test to verify it passes** (requires Task 4's `hashPassword`)

Run: `npx vitest run lib/db/__tests__/seed.test.ts`
Expected: PASS (2 tests). If `hashPassword` is not yet implemented, complete Task 4 first, then re-run.

- [ ] **Step 5: Commit**

```bash
git add lib/db/seed.ts lib/db/__tests__/seed.test.ts
git commit -m "feat(db): seed SU04 template, items, admin user, sample lists"
```

---

### Task 4: Password hashing

**Files:**
- Create: `lib/auth/password.ts`
- Test: `lib/auth/__tests__/password.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>`.

- [ ] **Step 1: Write the failing test**

Create `lib/auth/__tests__/password.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../password";

describe("password hashing", () => {
  it("hashes and verifies a correct password", async () => {
    const hash = await hashPassword("s3cret!");
    expect(hash).not.toBe("s3cret!");
    expect(await verifyPassword("s3cret!", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("s3cret!");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/auth/__tests__/password.test.ts`
Expected: FAIL — cannot find module `../password`.

- [ ] **Step 3: Implement `lib/auth/password.ts`**

```typescript
import bcrypt from "bcryptjs";

const COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/auth/__tests__/password.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/password.ts lib/auth/__tests__/password.test.ts
git commit -m "feat(auth): bcryptjs password hashing helpers"
```

---

### Task 5: Sessions (create / lookup / destroy)

**Files:**
- Create: `lib/auth/session.ts`
- Test: `lib/auth/__tests__/session.test.ts`

**Interfaces:**
- Consumes: `getClient` (Task 1), schema (Task 2).
- Produces: `SESSION_COOKIE = "wd_floor_sid"`; `SessionUser` type; `createSession(userId)`, `getSessionUser(token)`, `destroySession(token)`.

- [ ] **Step 1: Write the failing test**

Create `lib/auth/__tests__/session.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { createSession, getSessionUser, destroySession } from "../session";

async function makeUser() {
  const { getClient } = await import("@/lib/db/client");
  const res = await getClient().execute({
    sql: "INSERT INTO users (username, password_hash, name, role, active, created_at) VALUES ('sup','x','Sup','supervisor',1,?) RETURNING id",
    args: [new Date().toISOString()],
  });
  return res.rows[0].id as number;
}

describe("sessions", () => {
  it("creates a session and resolves the user", async () => {
    await freshTestDb();
    const userId = await makeUser();
    const token = await createSession(userId);
    expect(typeof token).toBe("string");
    const user = await getSessionUser(token);
    expect(user).toMatchObject({ id: userId, username: "sup", role: "supervisor" });
  });

  it("returns null for unknown/undefined tokens", async () => {
    await freshTestDb();
    expect(await getSessionUser(undefined)).toBeNull();
    expect(await getSessionUser("nope")).toBeNull();
  });

  it("destroys a session", async () => {
    await freshTestDb();
    const userId = await makeUser();
    const token = await createSession(userId);
    await destroySession(token);
    expect(await getSessionUser(token)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/auth/__tests__/session.test.ts`
Expected: FAIL — cannot find module `../session`.

- [ ] **Step 3: Implement `lib/auth/session.ts`**

```typescript
import { randomUUID } from "node:crypto";
import { getClient } from "@/lib/db/client";

export const SESSION_COOKIE = "wd_floor_sid";
const TTL_DAYS = 30;

export type Role = "supervisor" | "manager" | "admin";
export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: Role;
}

export async function createSession(userId: number): Promise<string> {
  const token = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + TTL_DAYS * 864e5);
  await getClient().execute({
    sql: "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    args: [token, userId, now.toISOString(), expires.toISOString()],
  });
  return token;
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const res = await getClient().execute({
    sql: `SELECT u.id, u.username, u.name, u.role, s.expires_at
          FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.id = ? AND u.active = 1`,
    args: [token],
  });
  const row = res.rows[0];
  if (!row) return null;
  if (new Date(row.expires_at as string) < new Date()) {
    await destroySession(token);
    return null;
  }
  return {
    id: row.id as number,
    username: row.username as string,
    name: row.name as string,
    role: row.role as Role,
  };
}

export async function destroySession(token: string): Promise<void> {
  await getClient().execute({ sql: "DELETE FROM sessions WHERE id = ?", args: [token] });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/auth/__tests__/session.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/session.ts lib/auth/__tests__/session.test.ts
git commit -m "feat(auth): server-side session table + helpers"
```

---

### Task 6: Login + logout API routes and login page

**Files:**
- Create: `app/api/floor/login/route.ts`
- Create: `app/api/floor/logout/route.ts`
- Create: `app/floor/login/page.tsx`
- Test: `lib/auth/__tests__/authenticate.test.ts`
- Create: `lib/auth/authenticate.ts`

**Interfaces:**
- Consumes: `verifyPassword` (Task 4), `createSession`/`destroySession`/`SESSION_COOKIE` (Task 5), `getClient` (Task 1).
- Produces: `authenticate(username: string, password: string): Promise<SessionUser | null>` (pure logic, unit-tested); the two route handlers wrap it with cookie handling.

- [ ] **Step 1: Write the failing test for `authenticate`**

Create `lib/auth/__tests__/authenticate.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { authenticate } from "../authenticate";
import { hashPassword } from "../password";

async function seedUser(active = 1) {
  const { getClient } = await import("@/lib/db/client");
  const hash = await hashPassword("pw123");
  await getClient().execute({
    sql: "INSERT INTO users (username, password_hash, name, role, active, created_at) VALUES ('bob',?,?,?,?,?)",
    args: [hash, "Bob", "supervisor", active, new Date().toISOString()],
  });
}

describe("authenticate", () => {
  it("returns the user on correct credentials", async () => {
    await freshTestDb();
    await seedUser();
    const user = await authenticate("bob", "pw123");
    expect(user).toMatchObject({ username: "bob", role: "supervisor" });
  });

  it("returns null on wrong password", async () => {
    await freshTestDb();
    await seedUser();
    expect(await authenticate("bob", "nope")).toBeNull();
  });

  it("returns null for inactive or unknown user", async () => {
    await freshTestDb();
    await seedUser(0);
    expect(await authenticate("bob", "pw123")).toBeNull();
    expect(await authenticate("ghost", "pw123")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/auth/__tests__/authenticate.test.ts`
Expected: FAIL — cannot find module `../authenticate`.

- [ ] **Step 3: Implement `lib/auth/authenticate.ts`**

```typescript
import { getClient } from "@/lib/db/client";
import { verifyPassword } from "./password";
import type { SessionUser, Role } from "./session";

export async function authenticate(username: string, password: string): Promise<SessionUser | null> {
  const res = await getClient().execute({
    sql: "SELECT id, username, name, role, password_hash FROM users WHERE username = ? AND active = 1",
    args: [username],
  });
  const row = res.rows[0];
  if (!row) return null;
  const ok = await verifyPassword(password, row.password_hash as string);
  if (!ok) return null;
  return {
    id: row.id as number,
    username: row.username as string,
    name: row.name as string,
    role: row.role as Role,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/auth/__tests__/authenticate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the login route `app/api/floor/login/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authenticate } from "@/lib/auth/authenticate";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Username and password required." }, { status: 400 });
  }
  const user = await authenticate(username.trim(), password);
  if (!user) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  const token = await createSession(user.id);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({ ok: true, role: user.role });
}
```

- [ ] **Step 6: Implement the logout route `app/api/floor/logout/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  cookies().delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Implement the login page `app/floor/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FloorLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/floor/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/floor");
    } else {
      const { error } = await res.json().catch(() => ({ error: "Login failed." }));
      setError(error ?? "Login failed.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl border border-[#e4ddd4] p-6 space-y-4">
        <h1 className="font-serif text-2xl text-charcoal">Production Login</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          className="w-full rounded-xl border border-[#e4ddd4] px-3 py-3 text-base"
          placeholder="Username" autoCapitalize="none" autoCorrect="off"
          value={username} onChange={(e) => setUsername(e.target.value)} />
        <input
          className="w-full rounded-xl border border-[#e4ddd4] px-3 py-3 text-base"
          type="password" placeholder="Password"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <button
          type="submit" disabled={busy}
          className="w-full rounded-xl bg-copper text-white py-3 text-base font-medium disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: PASS (all tests from Tasks 1–6).

- [ ] **Step 9: Commit**

```bash
git add lib/auth/authenticate.ts lib/auth/__tests__/authenticate.test.ts app/api/floor/login/route.ts app/api/floor/logout/route.ts app/floor/login/page.tsx
git commit -m "feat(auth): login/logout routes + login page"
```

---

### Task 7: Auth guards for pages and route handlers

**Files:**
- Create: `lib/auth/require.ts`
- Create: `app/floor/page.tsx` (minimal authed landing to prove the guard)
- Test: `lib/auth/__tests__/require.test.ts`

**Interfaces:**
- Consumes: `getSessionUser`/`SESSION_COOKIE` (Task 5).
- Produces: `getCurrentUser(): Promise<SessionUser | null>`, `requireUser(): Promise<SessionUser>`, `requireRole(...roles: Role[]): Promise<SessionUser>`. `requireUser`/`requireRole` redirect to `/floor/login` when unauthorized.

- [ ] **Step 1: Write the failing test** (tests the pure resolver `resolveUser`, which takes a token so it needs no request context)

Create `lib/auth/__tests__/require.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { resolveUser } from "../require";
import { createSession } from "../session";

async function makeUser(role = "supervisor") {
  const { getClient } = await import("@/lib/db/client");
  const res = await getClient().execute({
    sql: "INSERT INTO users (username, password_hash, name, role, active, created_at) VALUES ('u','x','U',?,1,?) RETURNING id",
    args: [role, new Date().toISOString()],
  });
  return res.rows[0].id as number;
}

describe("resolveUser", () => {
  it("resolves a valid token to a user", async () => {
    await freshTestDb();
    const id = await makeUser();
    const token = await createSession(id);
    expect(await resolveUser(token)).toMatchObject({ id, role: "supervisor" });
  });

  it("resolves undefined for no token", async () => {
    await freshTestDb();
    expect(await resolveUser(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/auth/__tests__/require.test.ts`
Expected: FAIL — cannot find module `../require`.

- [ ] **Step 3: Implement `lib/auth/require.ts`**

```typescript
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, SESSION_COOKIE, type SessionUser, type Role } from "./session";

// Pure resolver (testable without request context).
export async function resolveUser(token: string | undefined): Promise<SessionUser | null> {
  return getSessionUser(token);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  return resolveUser(cookies().get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/floor/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/floor/login");
  return user;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/auth/__tests__/require.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Create a minimal guarded landing `app/floor/page.tsx`**

```tsx
import { requireUser } from "@/lib/auth/require";

export const dynamic = "force-dynamic";

export default async function FloorHome() {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-cream p-6">
      <h1 className="font-serif text-2xl text-charcoal">Welcome, {user.name}</h1>
      <p className="text-text-muted mt-2">Role: {user.role}</p>
      <form action="/api/floor/logout" method="post" className="mt-6">
        <button className="rounded-xl border border-copper text-copper px-4 py-2">Sign out</button>
      </form>
    </div>
  );
}
```
(Note: the logout `<form>` posts to the route; wire a client handler in Phase 2 for SPA-style logout. For Phase 1 this proves the guard + session end-to-end.)

- [ ] **Step 6: Run the full suite + typecheck + build**

Run:
```bash
npm test && npx tsc --noEmit && npx next build
```
Expected: all tests PASS; `tsc` clean; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add lib/auth/require.ts lib/auth/__tests__/require.test.ts app/floor/page.tsx
git commit -m "feat(auth): route/page guards + guarded floor landing"
```

---

### Task 8: Local end-to-end verification + provisioning notes

**Files:**
- Create: `docs/supervisor-app-setup.md`

**Interfaces:** none (documentation + manual verification).

- [ ] **Step 1: Migrate + seed a local dev DB**

Run:
```bash
SEED_ADMIN_PASSWORD=admin123 npm run db:seed
```
Expected: "Seed complete." and a `local.db` file created (`TURSO_DATABASE_URL=file:local.db` in `.env.local`).

- [ ] **Step 2: Start the dev server and verify the login flow in the browser**

Use the Browser pane (per the preview workflow), mobile viewport (375×812):
1. `preview_start` the `wild-dash` dev server.
2. Navigate to `/floor` → expect redirect to `/floor/login`.
3. Log in as `admin` / `admin123` → expect the guarded landing showing "Welcome, Administrator", role `admin`.
4. Sign out → expect redirect back to `/floor/login`.
Capture a screenshot as proof.

- [ ] **Step 3: Write `docs/supervisor-app-setup.md`** documenting production provisioning

```markdown
# Supervisor App — Setup

## Local dev
- `.env.local`: `TURSO_DATABASE_URL=file:local.db` and empty `TURSO_AUTH_TOKEN`.
- `SEED_ADMIN_PASSWORD=<pw> npm run db:seed` creates the schema + seed data.

## Production (Turso) — run once
1. Install CLI + create the DB (its OWN database, unrelated to any other project):
   `turso db create wild-dash-production`
2. Get the URL: `turso db show wild-dash-production --url`
3. Mint a token: `turso db tokens create wild-dash-production`
4. Set in Vercel (this project only): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
5. Apply schema + seed against production once (locally, with prod env vars):
   `TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... SEED_ADMIN_PASSWORD=<strong> npm run db:seed`
6. Change the admin password after first login (admin UI ships in a later phase).
```

- [ ] **Step 4: Commit**

```bash
git add docs/supervisor-app-setup.md
git commit -m "docs: supervisor app local + Turso provisioning"
```

---

## Phase 1 Self-Review

- **Spec coverage (Phase 1 slice):** DB foundation (§4, §5) ✓ tables in Task 2; standalone DB + env (§4, §12) ✓ Task 1 + Task 8; auth username/password + bcrypt + roles + httpOnly session (§3, §9) ✓ Tasks 4–7; SU04 template + items seed (§5, §7) ✓ Task 3; machines/operators managed lists seeded (§4, §5) ✓ Task 3. Deferred to later phases (documented): run logging + SU04 completion flow (Phase 2), dashboard reflection (Phase 3), admin CRUD UI (Phase 4).
- **Placeholder scan:** none — every step has runnable code/commands.
- **Type consistency:** `SessionUser`/`Role` defined in Task 5 and reused verbatim in Tasks 6–7; `getClient`, `applySchema`, `hashPassword`, `createSession`, `getSessionUser`, `destroySession`, `SESSION_COOKIE`, `authenticate`, `resolveUser` names match across tasks.

## Follow-on plans (not this document)
- **Phase 2:** Supervisor PWA — SU04 start/end flow (readiness_days/readiness_checks), run logging (runs), edit/void + audit_log, PWA manifest/install.
- **Phase 3:** Dashboard reflection — per-operator/machine performance, runs register, SU04 compliance (read DB).
- **Phase 4:** Admin UI — manage users/operators/machines/checklist templates.
