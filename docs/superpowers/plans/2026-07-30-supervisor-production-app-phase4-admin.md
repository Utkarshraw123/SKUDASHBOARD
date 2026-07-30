# Supervisor Production App — Phase 4: Admin UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a secure, mobile-friendly screen at `/floor/admin` to manage the DB-backed lists the app depends on — **users** (create, deactivate/reactivate, reset password, change role), **operators** and **machines** (create, rename, deactivate), and the active **SU04 checklist items** (add, edit label/critical, deactivate) — every change written to `audit_log`.

**Architecture:** A server-only admin repository (`lib/floor/adminRepo.ts`) wraps the Phase-1 libSQL client, hashing passwords with the Phase-1 helper and writing an `audit_log` row on every mutation (never logging plaintext or hashes). Pure input validation (`lib/floor/adminValidate.ts`) is unit-tested. Thin API routes under `/api/floor/admin/*` are gated to `role='admin'` via a small guard; a guarded page `/floor/admin` renders a tabbed client UI (`AdminApp`) that reuses the Phase-2 `/floor` chrome and calls those routes.

**Tech Stack:** Next.js 14.2.5 App Router (TypeScript). No new dependencies. Reuses Phase-1 auth/DB and Phase-2 `/floor` layout.

## Global Constraints

- **Builds on Phase 1–3** — reuse: `getClient()`; `hashPassword` (`lib/auth/password.ts`); `getCurrentUser`/`requireRole` + `SessionUser`/`Role` (`lib/auth/require.ts` / `session.ts`); the `/floor` layout. Do not redefine these.
- **Admin-only** — every admin API route and the `/floor/admin` page require `role='admin'`. Pages use `requireRole("admin")` (redirects to `/floor/login`); API routes use `adminOnly()` returning 403 when not an admin. Never trust a client-sent role or identity.
- **Never log secrets** — password resets/creates hash via `hashPassword`; `audit_log` records the field as `password_hash` with old/new values `"***"` (never the hash or plaintext). Plaintext is never stored or logged.
- **Soft state only** — users/operators/machines/checklist items are **deactivated** (`active=0`), never `DELETE`d, preserving history and audit. Reactivation flips `active=1`.
- **Every mutation is audited** — `audit_log` row with `entity` in (`user`|`operator`|`machine`|`checklist_item`), `action` in (`create`|`update`), field-level old→new where meaningful, `changed_by = admin.id`.
- **Username uniqueness** — enforced by the schema's `UNIQUE`; the repo pre-checks and throws a friendly error so the API can return 400 instead of a 500.
- **DB access is server-only** — `adminRepo`/`getClient` never imported into a client component; `AdminApp` talks to the API via `fetch`.
- **libSQL access pattern:** `client.execute({ sql, args })`; rows in `res.rows`. `?` placeholders only.
- **House style:** admin UI reuses the `/floor` mobile-first look (cream bg, copper accents, rounded cards); no dashboard sidebar (it lives under `/floor`).
- **Tests** run with `npm test` (vitest); DB tests use `freshTestDb()` from `test/setup-db.ts`.

---

## File Structure

**Created — validation (pure, unit-tested):**
- `lib/floor/adminValidate.ts` — `validateNewUser`, `validateName`.

**Created — repository (DB, integration-tested):**
- `lib/floor/adminRepo.ts` — users/operators/machines/checklist-item management + audit writes.

**Created — API guard + routes:**
- `lib/auth/adminOnly.ts` — `adminOnly(): Promise<SessionUser | null>`.
- `app/api/floor/admin/users/route.ts` — GET list, POST create.
- `app/api/floor/admin/users/[id]/route.ts` — PATCH (active | role | password).
- `app/api/floor/admin/operators/route.ts` — GET, POST.
- `app/api/floor/admin/operators/[id]/route.ts` — PATCH (name | active).
- `app/api/floor/admin/machines/route.ts` — GET, POST.
- `app/api/floor/admin/machines/[id]/route.ts` — PATCH (name | active).
- `app/api/floor/admin/checklist/route.ts` — GET active template + items, POST add item.
- `app/api/floor/admin/checklist/[id]/route.ts` — PATCH (label | critical | active).

**Created — UI:**
- `app/floor/admin/page.tsx` — `requireRole("admin")` guard + `<AdminApp />`.
- `components/floor/AdminApp.tsx` — tabbed client UI (Users · Operators · Machines · Checklist).

**Modified:**
- `app/floor/page.tsx` — show an "Admin" link on the day home when `user.role === "admin"`.
- `docs/supervisor-app-setup.md` — Phase-4 section.

**Interfaces produced:**
- `adminOnly(): Promise<SessionUser | null>`.
- Repo functions listed per task below.

---

### Task 1: Admin input validation (pure)

**Files:**
- Create: `lib/floor/adminValidate.ts`
- Test: `lib/floor/__tests__/adminValidate.test.ts`

**Interfaces:**
- Consumes: `Role` (Phase 1).
- Produces: `validateNewUser({username,name,role,password})` → `string[]`; `validateName(name)` → `string[]`.

- [ ] **Step 1: Write the failing test**

Create `lib/floor/__tests__/adminValidate.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { validateNewUser, validateName } from "../adminValidate";

describe("validateNewUser", () => {
  it("accepts a well-formed user", () => {
    expect(validateNewUser({ username: "jane", name: "Jane", role: "supervisor", password: "secret1" })).toEqual([]);
  });
  it("requires username, name, valid role, and a 6+ char password", () => {
    const errs = validateNewUser({ username: "", name: "", role: "boss" as any, password: "x" });
    expect(errs).toContain("Username is required.");
    expect(errs).toContain("Name is required.");
    expect(errs).toContain("Role must be supervisor, manager, or admin.");
    expect(errs).toContain("Password must be at least 6 characters.");
  });
  it("rejects usernames with spaces", () => {
    expect(validateNewUser({ username: "a b", name: "A", role: "admin", password: "secret1" }))
      .toContain("Username cannot contain spaces.");
  });
});

describe("validateName", () => {
  it("requires a non-empty name", () => {
    expect(validateName("")).toContain("Name is required.");
    expect(validateName("Machine 3")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/floor/__tests__/adminValidate.test.ts`
Expected: FAIL — cannot find module `../adminValidate`.

- [ ] **Step 3: Implement `lib/floor/adminValidate.ts`**

```typescript
import type { Role } from "@/lib/auth/session";

const ROLES: Role[] = ["supervisor", "manager", "admin"];

export function validateNewUser(input: { username: string; name: string; role: Role; password: string }): string[] {
  const errs: string[] = [];
  if (!input.username.trim()) errs.push("Username is required.");
  else if (/\s/.test(input.username)) errs.push("Username cannot contain spaces.");
  if (!input.name.trim()) errs.push("Name is required.");
  if (!ROLES.includes(input.role)) errs.push("Role must be supervisor, manager, or admin.");
  if (!input.password || input.password.length < 6) errs.push("Password must be at least 6 characters.");
  return errs;
}

export function validateName(name: string): string[] {
  return name.trim() ? [] : ["Name is required."];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/floor/__tests__/adminValidate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/floor/adminValidate.ts lib/floor/__tests__/adminValidate.test.ts
git commit -m "feat(admin): input validation for users + named lists"
```

---

### Task 2: Admin repository — users

**Files:**
- Create: `lib/floor/adminRepo.ts`
- Test: `lib/floor/__tests__/adminRepoUsers.test.ts`

**Interfaces:**
- Consumes: `getClient` (Phase 1); `hashPassword` (Phase 1); `verifyPassword` (Phase 1, for the test); `Role` (Phase 1).
- Produces: `AdminUser`; `listUsers()`, `createUser({username,name,role,password}, adminId)`, `setUserActive(id, active, adminId)`, `setUserRole(id, role, adminId)`, `resetUserPassword(id, password, adminId)`.

- [ ] **Step 1: Write the failing test**

Create `lib/floor/__tests__/adminRepoUsers.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { listUsers, createUser, setUserActive, setUserRole, resetUserPassword } from "../adminRepo";
import { verifyPassword } from "@/lib/auth/password";

async function adminId() {
  const { getClient } = await import("@/lib/db/client");
  const res = await getClient().execute({
    sql: "INSERT INTO users (username,password_hash,name,role,active,created_at) VALUES ('admin','x','Admin','admin',1,?) RETURNING id",
    args: [new Date().toISOString()],
  });
  return res.rows[0].id as number;
}

describe("adminRepo users", () => {
  it("creates a user with a hashed password and audits it", async () => {
    await freshTestDb();
    const aid = await adminId();
    const id = await createUser({ username: "jane", name: "Jane", role: "supervisor", password: "secret1" }, aid);
    const users = await listUsers();
    const jane = users.find((u) => u.username === "jane")!;
    expect(jane.role).toBe("supervisor");
    expect(jane.active).toBe(true);
    const { getClient } = await import("@/lib/db/client");
    const row = await getClient().execute({ sql: "SELECT password_hash FROM users WHERE id=?", args: [id] });
    expect(await verifyPassword("secret1", row.rows[0].password_hash as string)).toBe(true);
    const audit = await getClient().execute("SELECT * FROM audit_log WHERE entity='user' AND action='create'");
    expect(audit.rows.length).toBe(1);
  });

  it("rejects a duplicate username with a friendly error", async () => {
    await freshTestDb();
    const aid = await adminId();
    await createUser({ username: "jane", name: "Jane", role: "supervisor", password: "secret1" }, aid);
    await expect(createUser({ username: "jane", name: "Jane 2", role: "manager", password: "secret1" }, aid))
      .rejects.toThrow(/already exists/i);
  });

  it("deactivates, changes role, and resets password (each audited, no secret logged)", async () => {
    await freshTestDb();
    const aid = await adminId();
    const id = await createUser({ username: "bob", name: "Bob", role: "supervisor", password: "secret1" }, aid);

    await setUserActive(id, false, aid);
    expect((await listUsers()).find((u) => u.id === id)!.active).toBe(false);

    await setUserRole(id, "manager", aid);
    expect((await listUsers()).find((u) => u.id === id)!.role).toBe("manager");

    await resetUserPassword(id, "newpass1", aid);
    const { getClient } = await import("@/lib/db/client");
    const row = await getClient().execute({ sql: "SELECT password_hash FROM users WHERE id=?", args: [id] });
    expect(await verifyPassword("newpass1", row.rows[0].password_hash as string)).toBe(true);

    const pw = await getClient().execute("SELECT old_value,new_value FROM audit_log WHERE entity='user' AND field='password_hash'");
    expect(pw.rows[0].new_value).toBe("***");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/floor/__tests__/adminRepoUsers.test.ts`
Expected: FAIL — cannot find module `../adminRepo`.

- [ ] **Step 3: Implement `lib/floor/adminRepo.ts`** (users section + shared audit helper)

```typescript
import { getClient } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import type { Role } from "@/lib/auth/session";

async function audit(
  entity: "user" | "operator" | "machine" | "checklist_item",
  entityId: number,
  action: "create" | "update",
  field: string | null,
  oldVal: string | null,
  newVal: string | null,
  adminId: number,
): Promise<void> {
  await getClient().execute({
    sql: `INSERT INTO audit_log (entity, entity_id, action, field, old_value, new_value, changed_by, changed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [entity, entityId, action, field, oldVal, newVal, adminId, new Date().toISOString()],
  });
}

export interface AdminUser {
  id: number;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export async function listUsers(): Promise<AdminUser[]> {
  const res = await getClient().execute("SELECT id, username, name, role, active, created_at FROM users ORDER BY username");
  return res.rows.map((r) => ({
    id: r.id as number,
    username: r.username as string,
    name: r.name as string,
    role: r.role as Role,
    active: !!(r.active as number),
    createdAt: r.created_at as string,
  }));
}

export async function createUser(
  input: { username: string; name: string; role: Role; password: string },
  adminId: number,
): Promise<number> {
  const exists = await getClient().execute({ sql: "SELECT id FROM users WHERE username = ?", args: [input.username] });
  if (exists.rows.length > 0) throw new Error(`A user named "${input.username}" already exists.`);
  const hash = await hashPassword(input.password);
  const res = await getClient().execute({
    sql: "INSERT INTO users (username, password_hash, name, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?) RETURNING id",
    args: [input.username, hash, input.name, input.role, new Date().toISOString()],
  });
  const id = res.rows[0].id as number;
  await audit("user", id, "create", null, null, null, adminId);
  return id;
}

export async function setUserActive(id: number, active: boolean, adminId: number): Promise<void> {
  const before = await getClient().execute({ sql: "SELECT active FROM users WHERE id=?", args: [id] });
  await getClient().execute({ sql: "UPDATE users SET active=? WHERE id=?", args: [active ? 1 : 0, id] });
  await audit("user", id, "update", "active", String(before.rows[0]?.active ?? ""), active ? "1" : "0", adminId);
}

export async function setUserRole(id: number, role: Role, adminId: number): Promise<void> {
  const before = await getClient().execute({ sql: "SELECT role FROM users WHERE id=?", args: [id] });
  await getClient().execute({ sql: "UPDATE users SET role=? WHERE id=?", args: [role, id] });
  await audit("user", id, "update", "role", (before.rows[0]?.role as string) ?? "", role, adminId);
}

export async function resetUserPassword(id: number, password: string, adminId: number): Promise<void> {
  const hash = await hashPassword(password);
  await getClient().execute({ sql: "UPDATE users SET password_hash=? WHERE id=?", args: [hash, id] });
  await audit("user", id, "update", "password_hash", "***", "***", adminId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/floor/__tests__/adminRepoUsers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/floor/adminRepo.ts lib/floor/__tests__/adminRepoUsers.test.ts
git commit -m "feat(admin): user management repo (create/deactivate/role/password) + audit"
```

---

### Task 3: Admin repository — operators + machines

**Files:**
- Modify: `lib/floor/adminRepo.ts`
- Test: `lib/floor/__tests__/adminRepoLists.test.ts`

**Interfaces:**
- Consumes: `getClient`; the `audit` helper (Task 2).
- Produces: `NamedRow`; `listAllOperators()`/`createOperator(name, adminId)`/`renameOperator(id, name, adminId)`/`setOperatorActive(id, active, adminId)`; same four for machines (`listAllMachines`/`createMachine`/`renameMachine`/`setMachineActive`).

- [ ] **Step 1: Write the failing test**

Create `lib/floor/__tests__/adminRepoLists.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import {
  listAllOperators, createOperator, renameOperator, setOperatorActive,
  listAllMachines, createMachine, renameMachine, setMachineActive,
} from "../adminRepo";

const AID = 1;

describe("adminRepo operators/machines", () => {
  it("creates, renames, and deactivates an operator (audited)", async () => {
    await freshTestDb();
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/floor/__tests__/adminRepoLists.test.ts`
Expected: FAIL — the list functions are not exported.

- [ ] **Step 3: Append to `lib/floor/adminRepo.ts`**

```typescript
export interface NamedRow { id: number; name: string; active: boolean; }

function mapNamed(rows: { id: unknown; name: unknown; active: unknown }[]): NamedRow[] {
  return rows.map((r) => ({ id: r.id as number, name: r.name as string, active: !!(r.active as number) }));
}

// --- Operators ---
export async function listAllOperators(): Promise<NamedRow[]> {
  const res = await getClient().execute("SELECT id, name, active FROM operators ORDER BY name");
  return mapNamed(res.rows as never);
}
export async function createOperator(name: string, adminId: number): Promise<number> {
  const res = await getClient().execute({
    sql: "INSERT INTO operators (name, active, created_at) VALUES (?, 1, ?) RETURNING id",
    args: [name, new Date().toISOString()],
  });
  const id = res.rows[0].id as number;
  await audit("operator", id, "create", null, null, name, adminId);
  return id;
}
export async function renameOperator(id: number, name: string, adminId: number): Promise<void> {
  const before = await getClient().execute({ sql: "SELECT name FROM operators WHERE id=?", args: [id] });
  await getClient().execute({ sql: "UPDATE operators SET name=? WHERE id=?", args: [name, id] });
  await audit("operator", id, "update", "name", (before.rows[0]?.name as string) ?? "", name, adminId);
}
export async function setOperatorActive(id: number, active: boolean, adminId: number): Promise<void> {
  await getClient().execute({ sql: "UPDATE operators SET active=? WHERE id=?", args: [active ? 1 : 0, id] });
  await audit("operator", id, "update", "active", active ? "0" : "1", active ? "1" : "0", adminId);
}

// --- Machines ---
export async function listAllMachines(): Promise<NamedRow[]> {
  const res = await getClient().execute("SELECT id, name, active FROM machines ORDER BY name");
  return mapNamed(res.rows as never);
}
export async function createMachine(name: string, adminId: number): Promise<number> {
  const res = await getClient().execute({
    sql: "INSERT INTO machines (name, active, created_at) VALUES (?, 1, ?) RETURNING id",
    args: [name, new Date().toISOString()],
  });
  const id = res.rows[0].id as number;
  await audit("machine", id, "create", null, null, name, adminId);
  return id;
}
export async function renameMachine(id: number, name: string, adminId: number): Promise<void> {
  const before = await getClient().execute({ sql: "SELECT name FROM machines WHERE id=?", args: [id] });
  await getClient().execute({ sql: "UPDATE machines SET name=? WHERE id=?", args: [name, id] });
  await audit("machine", id, "update", "name", (before.rows[0]?.name as string) ?? "", name, adminId);
}
export async function setMachineActive(id: number, active: boolean, adminId: number): Promise<void> {
  await getClient().execute({ sql: "UPDATE machines SET active=? WHERE id=?", args: [active ? 1 : 0, id] });
  await audit("machine", id, "update", "active", active ? "0" : "1", active ? "1" : "0", adminId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/floor/__tests__/adminRepoLists.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/floor/adminRepo.ts lib/floor/__tests__/adminRepoLists.test.ts
git commit -m "feat(admin): operator + machine management repo + audit"
```

---

### Task 4: Admin repository — SU04 checklist items

**Files:**
- Modify: `lib/floor/adminRepo.ts`
- Test: `lib/floor/__tests__/adminRepoChecklist.test.ts`

**Interfaces:**
- Consumes: `getClient`; the `audit` helper.
- Produces: `ChecklistItemRow`; `getActiveTemplateWithItems()`, `addChecklistItem({category,label,critical}, adminId)`, `updateChecklistItem(id, {label?,critical?}, adminId)`, `setChecklistItemActive(id, active, adminId)`. New items append to the end (max `sort_order + 1`) of the active template.

- [ ] **Step 1: Write the failing test**

Create `lib/floor/__tests__/adminRepoChecklist.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { freshTestDb } from "@/test/setup-db";
import { seed } from "@/lib/db/seed";
import { getActiveTemplateWithItems, addChecklistItem, updateChecklistItem, setChecklistItemActive } from "../adminRepo";

const AID = 1;

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
    const id = await addChecklistItem({ category: "Equipment", label: "Forklift charged", critical: false }, AID);
    let t = await getActiveTemplateWithItems();
    expect(t!.items.length).toBe(16);
    expect(t!.items[t!.items.length - 1].id).toBe(id);

    await updateChecklistItem(id, { label: "Forklift fully charged", critical: true }, AID);
    await setChecklistItemActive(id, false, AID);
    t = await getActiveTemplateWithItems();
    // deactivated items are excluded from the active list
    expect(t!.items.find((i) => i.id === id)).toBeUndefined();

    const { getClient } = await import("@/lib/db/client");
    const audit = await getClient().execute("SELECT action,field FROM audit_log WHERE entity='checklist_item'");
    // create + (label,critical updates) + deactivate ≥ 3
    expect(audit.rows.length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/floor/__tests__/adminRepoChecklist.test.ts`
Expected: FAIL — the checklist functions are not exported.

- [ ] **Step 3: Append to `lib/floor/adminRepo.ts`**

```typescript
export interface ChecklistItemRow { id: number; sortOrder: number; category: string; label: string; critical: boolean; }
export interface ActiveTemplate {
  template: { id: number; code: string; version: string; title: string };
  items: ChecklistItemRow[];
}

async function activeTemplateId(): Promise<number | null> {
  const res = await getClient().execute("SELECT id FROM checklist_templates WHERE active=1 ORDER BY id DESC LIMIT 1");
  return res.rows[0] ? (res.rows[0].id as number) : null;
}

export async function getActiveTemplateWithItems(): Promise<ActiveTemplate | null> {
  const tRes = await getClient().execute("SELECT id, code, version, title FROM checklist_templates WHERE active=1 ORDER BY id DESC LIMIT 1");
  if (!tRes.rows[0]) return null;
  const tid = tRes.rows[0].id as number;
  const iRes = await getClient().execute({
    sql: "SELECT id, sort_order, category, label, critical FROM checklist_items WHERE template_id=? AND active=1 ORDER BY sort_order",
    args: [tid],
  });
  return {
    template: {
      id: tid,
      code: tRes.rows[0].code as string,
      version: tRes.rows[0].version as string,
      title: tRes.rows[0].title as string,
    },
    items: iRes.rows.map((r) => ({
      id: r.id as number,
      sortOrder: r.sort_order as number,
      category: r.category as string,
      label: r.label as string,
      critical: !!(r.critical as number),
    })),
  };
}

export async function addChecklistItem(input: { category: string; label: string; critical: boolean }, adminId: number): Promise<number> {
  const tid = await activeTemplateId();
  if (tid == null) throw new Error("No active checklist template.");
  const maxRes = await getClient().execute({ sql: "SELECT COALESCE(MAX(sort_order),0) AS m FROM checklist_items WHERE template_id=?", args: [tid] });
  const nextOrder = (maxRes.rows[0].m as number) + 1;
  const res = await getClient().execute({
    sql: "INSERT INTO checklist_items (template_id, sort_order, category, label, critical, active) VALUES (?, ?, ?, ?, ?, 1) RETURNING id",
    args: [tid, nextOrder, input.category, input.label, input.critical ? 1 : 0],
  });
  const id = res.rows[0].id as number;
  await audit("checklist_item", id, "create", null, null, input.label, adminId);
  return id;
}

export async function updateChecklistItem(id: number, patch: { label?: string; critical?: boolean }, adminId: number): Promise<void> {
  const before = await getClient().execute({ sql: "SELECT label, critical FROM checklist_items WHERE id=?", args: [id] });
  if (patch.label !== undefined) {
    await getClient().execute({ sql: "UPDATE checklist_items SET label=? WHERE id=?", args: [patch.label, id] });
    await audit("checklist_item", id, "update", "label", (before.rows[0]?.label as string) ?? "", patch.label, adminId);
  }
  if (patch.critical !== undefined) {
    await getClient().execute({ sql: "UPDATE checklist_items SET critical=? WHERE id=?", args: [patch.critical ? 1 : 0, id] });
    await audit("checklist_item", id, "update", "critical", String(before.rows[0]?.critical ?? ""), patch.critical ? "1" : "0", adminId);
  }
}

export async function setChecklistItemActive(id: number, active: boolean, adminId: number): Promise<void> {
  await getClient().execute({ sql: "UPDATE checklist_items SET active=? WHERE id=?", args: [active ? 1 : 0, id] });
  await audit("checklist_item", id, "update", "active", active ? "0" : "1", active ? "1" : "0", adminId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/floor/__tests__/adminRepoChecklist.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/floor/adminRepo.ts lib/floor/__tests__/adminRepoChecklist.test.ts
git commit -m "feat(admin): SU04 checklist item management repo + audit"
```

---

### Task 5: Admin API guard + user routes

**Files:**
- Create: `lib/auth/adminOnly.ts`
- Create: `app/api/floor/admin/users/route.ts`
- Create: `app/api/floor/admin/users/[id]/route.ts`
- Test: `lib/auth/__tests__/adminOnly.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser` (Phase 1); `listUsers`/`createUser`/`setUserActive`/`setUserRole`/`resetUserPassword` (Task 2); `validateNewUser` (Task 1).
- Produces: `adminOnly(): Promise<SessionUser | null>`; the two user route handlers.

- [ ] **Step 1: Write the failing test for `adminOnly`** (unit-tests the role check via a resolver that takes a user, so no request context is needed)

Create `lib/auth/__tests__/adminOnly.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { isAdmin } from "../adminOnly";
import type { SessionUser } from "../session";

const mk = (role: SessionUser["role"]): SessionUser => ({ id: 1, username: "u", name: "U", role });

describe("isAdmin", () => {
  it("is true only for admins", () => {
    expect(isAdmin(mk("admin"))).toBe(true);
    expect(isAdmin(mk("manager"))).toBe(false);
    expect(isAdmin(mk("supervisor"))).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/auth/__tests__/adminOnly.test.ts`
Expected: FAIL — cannot find module `../adminOnly`.

- [ ] **Step 3: Implement `lib/auth/adminOnly.ts`**

```typescript
import { getCurrentUser } from "./require";
import type { SessionUser } from "./session";

export function isAdmin(user: SessionUser | null): boolean {
  return !!user && user.role === "admin";
}

// Returns the admin SessionUser, or null if the caller is not an authenticated admin.
export async function adminOnly(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return isAdmin(user) ? user : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/auth/__tests__/adminOnly.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `app/api/floor/admin/users/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { adminOnly } from "@/lib/auth/adminOnly";
import { listUsers, createUser } from "@/lib/floor/adminRepo";
import { validateNewUser } from "@/lib/floor/adminValidate";
import type { Role } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await adminOnly())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ users: await listUsers() });
}

export async function POST(req: Request) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const input = {
    username: String(body.username ?? "").trim(),
    name: String(body.name ?? "").trim(),
    role: body.role as Role,
    password: String(body.password ?? ""),
  };
  const errors = validateNewUser(input);
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });
  try {
    const id = await createUser(input, admin.id);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 6: Implement `app/api/floor/admin/users/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { adminOnly } from "@/lib/auth/adminOnly";
import { setUserActive, setUserRole, resetUserPassword } from "@/lib/floor/adminRepo";
import type { Role } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const ROLES: Role[] = ["supervisor", "manager", "admin"];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));

  if (typeof body.active === "boolean") {
    if (id === admin.id && body.active === false) {
      return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
    }
    await setUserActive(id, body.active, admin.id);
  }
  if (typeof body.role === "string") {
    if (!ROLES.includes(body.role)) return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    if (id === admin.id && body.role !== "admin") {
      return NextResponse.json({ error: "You cannot remove your own admin role." }, { status: 400 });
    }
    await setUserRole(id, body.role, admin.id);
  }
  if (typeof body.password === "string") {
    if (body.password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    await resetUserPassword(id, body.password, admin.id);
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Run the full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS; `tsc` clean.

- [ ] **Step 8: Commit**

```bash
git add lib/auth/adminOnly.ts lib/auth/__tests__/adminOnly.test.ts app/api/floor/admin/users
git commit -m "feat(admin): admin API guard + user management routes (self-lockout guards)"
```

---

### Task 6: Admin API — operators + machines routes

**Files:**
- Create: `app/api/floor/admin/operators/route.ts`
- Create: `app/api/floor/admin/operators/[id]/route.ts`
- Create: `app/api/floor/admin/machines/route.ts`
- Create: `app/api/floor/admin/machines/[id]/route.ts`

**Interfaces:**
- Consumes: `adminOnly` (Task 5); operator/machine repo functions (Task 3); `validateName` (Task 1).
- Produces: four route handlers (GET/POST + PATCH each for operators and machines).

- [ ] **Step 1: Implement `app/api/floor/admin/operators/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { adminOnly } from "@/lib/auth/adminOnly";
import { listAllOperators, createOperator } from "@/lib/floor/adminRepo";
import { validateName } from "@/lib/floor/adminValidate";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await adminOnly())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ operators: await listAllOperators() });
}

export async function POST(req: Request) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const name = String((await req.json().catch(() => ({}))).name ?? "").trim();
  const errors = validateName(name);
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });
  const id = await createOperator(name, admin.id);
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 2: Implement `app/api/floor/admin/operators/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { adminOnly } from "@/lib/auth/adminOnly";
import { renameOperator, setOperatorActive } from "@/lib/floor/adminRepo";
import { validateName } from "@/lib/floor/adminValidate";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));
  if (typeof body.name === "string") {
    const name = body.name.trim();
    const errors = validateName(name);
    if (errors.length) return NextResponse.json({ errors }, { status: 400 });
    await renameOperator(id, name, admin.id);
  }
  if (typeof body.active === "boolean") await setOperatorActive(id, body.active, admin.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Implement `app/api/floor/admin/machines/route.ts`** (identical shape to operators)

```typescript
import { NextResponse } from "next/server";
import { adminOnly } from "@/lib/auth/adminOnly";
import { listAllMachines, createMachine } from "@/lib/floor/adminRepo";
import { validateName } from "@/lib/floor/adminValidate";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await adminOnly())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ machines: await listAllMachines() });
}

export async function POST(req: Request) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const name = String((await req.json().catch(() => ({}))).name ?? "").trim();
  const errors = validateName(name);
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });
  const id = await createMachine(name, admin.id);
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 4: Implement `app/api/floor/admin/machines/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { adminOnly } from "@/lib/auth/adminOnly";
import { renameMachine, setMachineActive } from "@/lib/floor/adminRepo";
import { validateName } from "@/lib/floor/adminValidate";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));
  if (typeof body.name === "string") {
    const name = body.name.trim();
    const errors = validateName(name);
    if (errors.length) return NextResponse.json({ errors }, { status: 400 });
    await renameMachine(id, name, admin.id);
  }
  if (typeof body.active === "boolean") await setMachineActive(id, body.active, admin.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/api/floor/admin/operators app/api/floor/admin/machines
git commit -m "feat(admin): operator + machine API routes"
```

---

### Task 7: Admin API — checklist routes

**Files:**
- Create: `app/api/floor/admin/checklist/route.ts`
- Create: `app/api/floor/admin/checklist/[id]/route.ts`

**Interfaces:**
- Consumes: `adminOnly` (Task 5); `getActiveTemplateWithItems`/`addChecklistItem`/`updateChecklistItem`/`setChecklistItemActive` (Task 4).
- Produces: two route handlers.

- [ ] **Step 1: Implement `app/api/floor/admin/checklist/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { adminOnly } from "@/lib/auth/adminOnly";
import { getActiveTemplateWithItems, addChecklistItem } from "@/lib/floor/adminRepo";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await adminOnly())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await getActiveTemplateWithItems());
}

export async function POST(req: Request) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const category = String(body.category ?? "").trim();
  const label = String(body.label ?? "").trim();
  if (!category || !label) return NextResponse.json({ error: "Category and label are required." }, { status: 400 });
  const id = await addChecklistItem({ category, label, critical: !!body.critical }, admin.id);
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 2: Implement `app/api/floor/admin/checklist/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { adminOnly } from "@/lib/auth/adminOnly";
import { updateChecklistItem, setChecklistItemActive } from "@/lib/floor/adminRepo";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await adminOnly();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));
  const patch: { label?: string; critical?: boolean } = {};
  if (typeof body.label === "string") {
    if (!body.label.trim()) return NextResponse.json({ error: "Label cannot be empty." }, { status: 400 });
    patch.label = body.label.trim();
  }
  if (typeof body.critical === "boolean") patch.critical = body.critical;
  if (patch.label !== undefined || patch.critical !== undefined) await updateChecklistItem(id, patch, admin.id);
  if (typeof body.active === "boolean") await setChecklistItemActive(id, body.active, admin.id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/api/floor/admin/checklist
git commit -m "feat(admin): SU04 checklist API routes"
```

---

### Task 8: Admin UI (tabbed) + guard + day-home link

**Files:**
- Create: `app/floor/admin/page.tsx`
- Create: `components/floor/AdminApp.tsx`
- Modify: `app/floor/page.tsx`

**Interfaces:**
- Consumes: the admin API routes (Tasks 5–7); `requireRole` (Phase 1).
- Produces: the admin experience.

- [ ] **Step 1: Create the guarded page `app/floor/admin/page.tsx`**

```tsx
import { requireRole } from "@/lib/auth/require";
import AdminApp from "@/components/floor/AdminApp";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireRole("admin");
  return <AdminApp />;
}
```

- [ ] **Step 2: Create `components/floor/AdminApp.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Tab = "users" | "operators" | "machines" | "checklist";
type Role = "supervisor" | "manager" | "admin";
interface User { id: number; username: string; name: string; role: Role; active: boolean; }
interface Named { id: number; name: string; active: boolean; }
interface Item { id: number; category: string; label: string; critical: boolean; }

async function jget(url: string) { const r = await fetch(url); return r.ok ? r.json() : null; }
async function jsend(url: string, method: string, body: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

export default function AdminApp() {
  const [tab, setTab] = useState<Tab>("users");
  return (
    <div className="min-h-full p-5 max-w-2xl mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-charcoal">Admin</h1>
        <Link href="/floor" className="text-sm text-copper">← Back</Link>
      </header>
      <nav className="flex gap-1 border-b border-[#e4ddd4] text-sm">
        {(["users", "operators", "machines", "checklist"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 -mb-px border-b-2 capitalize ${tab === t ? "border-copper text-copper" : "border-transparent text-text-muted"}`}>
            {t}
          </button>
        ))}
      </nav>
      {tab === "users" && <UsersPanel />}
      {tab === "operators" && <NamedPanel kind="operators" />}
      {tab === "machines" && <NamedPanel kind="machines" />}
      {tab === "checklist" && <ChecklistPanel />}
    </div>
  );
}

function Err({ msg }: { msg: string }) { return msg ? <p className="text-sm text-red-600">{msg}</p> : null; }

function UsersPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ username: "", name: "", role: "supervisor" as Role, password: "" });
  const [err, setErr] = useState("");
  async function load() { const d = await jget("/api/floor/admin/users"); if (d) setUsers(d.users); }
  useEffect(() => { load(); }, []);

  async function create() {
    setErr("");
    const { ok, data } = await jsend("/api/floor/admin/users", "POST", form);
    if (ok) { setForm({ username: "", name: "", role: "supervisor", password: "" }); load(); }
    else setErr((data.errors ?? [data.error]).join(" "));
  }
  async function patch(id: number, body: unknown) {
    const { ok, data } = await jsend(`/api/floor/admin/users/${id}`, "PATCH", body);
    if (ok) load(); else setErr(data.error ?? "Update failed.");
  }
  async function resetPw(id: number) {
    const pw = prompt("New password (min 6 chars):");
    if (pw) patch(id, { password: pw });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white border border-[#e4ddd4] p-4 space-y-2">
        <h2 className="font-medium text-charcoal">New user</h2>
        <Err msg={err} />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Username" autoCapitalize="none" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="rounded-lg border border-[#e4ddd4] px-3 py-2" />
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-[#e4ddd4] px-3 py-2" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="rounded-lg border border-[#e4ddd4] px-3 py-2">
            <option value="supervisor">supervisor</option><option value="manager">manager</option><option value="admin">admin</option>
          </select>
          <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-lg border border-[#e4ddd4] px-3 py-2" />
        </div>
        <button onClick={create} className="w-full rounded-xl bg-copper text-white py-2.5 font-medium">Add user</button>
      </div>
      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id} className={`rounded-xl border border-[#e4ddd4] p-3 ${u.active ? "bg-white" : "bg-[#f3efe8] opacity-70"}`}>
            <div className="flex justify-between">
              <span className="text-charcoal">{u.name} <span className="text-text-muted">@{u.username}</span></span>
              <select value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })} className="text-sm border border-[#e4ddd4] rounded px-1">
                <option value="supervisor">supervisor</option><option value="manager">manager</option><option value="admin">admin</option>
              </select>
            </div>
            <div className="flex gap-3 mt-1 text-sm">
              <button onClick={() => patch(u.id, { active: !u.active })} className="text-copper">{u.active ? "Deactivate" : "Reactivate"}</button>
              <button onClick={() => resetPw(u.id)} className="text-copper">Reset password</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NamedPanel({ kind }: { kind: "operators" | "machines" }) {
  const [rows, setRows] = useState<Named[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const base = `/api/floor/admin/${kind}`;
  const key = kind;
  async function load() { const d = await jget(base); if (d) setRows(d[key]); }
  useEffect(() => { load(); }, [kind]);
  async function create() {
    setErr("");
    const { ok, data } = await jsend(base, "POST", { name });
    if (ok) { setName(""); load(); } else setErr((data.errors ?? [data.error]).join(" "));
  }
  async function patch(id: number, body: unknown) { const { ok } = await jsend(`${base}/${id}`, "PATCH", body); if (ok) load(); }
  async function rename(id: number, current: string) { const n = prompt("New name:", current); if (n) patch(id, { name: n }); }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white border border-[#e4ddd4] p-4 space-y-2">
        <Err msg={err} />
        <div className="flex gap-2">
          <input placeholder={`New ${kind.slice(0, -1)}`} value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-lg border border-[#e4ddd4] px-3 py-2" />
          <button onClick={create} className="rounded-xl bg-copper text-white px-4 font-medium">Add</button>
        </div>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className={`rounded-xl border border-[#e4ddd4] p-3 flex justify-between items-center ${r.active ? "bg-white" : "bg-[#f3efe8] opacity-70"}`}>
            <span className="text-charcoal">{r.name}</span>
            <div className="flex gap-3 text-sm">
              <button onClick={() => rename(r.id, r.name)} className="text-copper">Rename</button>
              <button onClick={() => patch(r.id, { active: !r.active })} className="text-copper">{r.active ? "Deactivate" : "Reactivate"}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChecklistPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [tpl, setTpl] = useState<{ code: string; version: string } | null>(null);
  const [form, setForm] = useState({ category: "", label: "", critical: false });
  const [err, setErr] = useState("");
  async function load() {
    const d = await jget("/api/floor/admin/checklist");
    if (d) { setItems(d.items); setTpl(d.template); }
  }
  useEffect(() => { load(); }, []);
  async function add() {
    setErr("");
    const { ok, data } = await jsend("/api/floor/admin/checklist", "POST", form);
    if (ok) { setForm({ category: "", label: "", critical: false }); load(); } else setErr(data.error ?? "Failed.");
  }
  async function patch(id: number, body: unknown) { const { ok } = await jsend(`/api/floor/admin/checklist/${id}`, "PATCH", body); if (ok) load(); }
  async function rename(id: number, current: string) { const n = prompt("New label:", current); if (n) patch(id, { label: n }); }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">{tpl ? `${tpl.code} ${tpl.version}` : "…"} · {items.length} active items</p>
      <div className="rounded-xl bg-white border border-[#e4ddd4] p-4 space-y-2">
        <h2 className="font-medium text-charcoal">Add item</h2>
        <Err msg={err} />
        <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-[#e4ddd4] px-3 py-2" />
        <input placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="w-full rounded-lg border border-[#e4ddd4] px-3 py-2" />
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input type="checkbox" checked={form.critical} onChange={(e) => setForm({ ...form, critical: e.target.checked })} /> Critical
        </label>
        <button onClick={add} className="w-full rounded-xl bg-copper text-white py-2.5 font-medium">Add item</button>
      </div>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="rounded-xl border border-[#e4ddd4] bg-white p-3">
            <div className="flex justify-between">
              <span className="text-charcoal">{it.label}{it.critical && <span className="text-red-500"> *</span>}</span>
              <span className="text-xs text-text-muted">{it.category}</span>
            </div>
            <div className="flex gap-3 mt-1 text-sm">
              <button onClick={() => rename(it.id, it.label)} className="text-copper">Edit</button>
              <button onClick={() => patch(it.id, { critical: !it.critical })} className="text-copper">{it.critical ? "Unmark critical" : "Mark critical"}</button>
              <button onClick={() => patch(it.id, { active: false })} className="text-red-600">Remove</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Add an Admin link to the day home `app/floor/page.tsx`** (admins only)

Add the import at the top:
```tsx
import Link from "next/link";
```
(Link is already imported in the Phase-2 day home — skip if present.)

Immediately after the `<header>…</header>` block, add:
```tsx
      {user.role === "admin" && (
        <Link href="/floor/admin" className="block rounded-2xl bg-white border border-[#e4ddd4] p-4 text-copper font-medium">
          Admin — manage users, machines &amp; checklist →
        </Link>
      )}
```

- [ ] **Step 4: Full suite + typecheck + build**

Run:
```bash
npm test && npx tsc --noEmit && npx next build
```
Expected: all tests PASS; `tsc` clean; build succeeds with `/floor/admin` and the admin API routes.

- [ ] **Step 5: Commit**

```bash
git add app/floor/admin components/floor/AdminApp.tsx app/floor/page.tsx
git commit -m "feat(admin): tabbed admin UI + day-home link (admins only)"
```

---

### Task 9: End-to-end verification + docs

**Files:**
- Modify: `docs/supervisor-app-setup.md`

- [ ] **Step 1: Reseed a local DB**

Run:
```bash
rm -f local.db && TURSO_DATABASE_URL=file:local.db SEED_ADMIN_PASSWORD=admin123 npm run db:seed
```

- [ ] **Step 2: Verify the admin API end-to-end with an authenticated cookie jar**

With the dev server running (`preview_start`), log in as `admin`/`admin123` into a cookie jar and exercise the routes; also confirm a non-admin is forbidden:
```bash
JAR=$(mktemp)
curl -s -c "$JAR" -X POST http://localhost:3000/api/floor/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' >/dev/null
# create a supervisor
curl -s -b "$JAR" -X POST http://localhost:3000/api/floor/admin/users -H "Content-Type: application/json" -d '{"username":"omar","name":"Omar","role":"supervisor","password":"omar123"}'
# list users
curl -s -b "$JAR" http://localhost:3000/api/floor/admin/users
# add a machine + operator
curl -s -b "$JAR" -X POST http://localhost:3000/api/floor/admin/machines -H "Content-Type: application/json" -d '{"name":"Line 5"}'
curl -s -b "$JAR" -X POST http://localhost:3000/api/floor/admin/operators -H "Content-Type: application/json" -d '{"name":"Sasha"}'
# non-admin (omar) must be Forbidden on admin routes
JAR2=$(mktemp)
curl -s -c "$JAR2" -X POST http://localhost:3000/api/floor/login -H "Content-Type: application/json" -d '{"username":"omar","password":"omar123"}' >/dev/null
curl -s -o /dev/null -w "omar->users: %{http_code}\n" -b "$JAR2" http://localhost:3000/api/floor/admin/users
rm -f "$JAR" "$JAR2"
```
Expected: user/machine/operator create return ids; the list includes them; `omar->users: 403`.

- [ ] **Step 3: Browser-verify the admin UI (desktop or mobile viewport)**

1. Log in as `admin`/`admin123`; the day home shows the **Admin** link.
2. Open **Admin** → Users tab: create a user, toggle active, change role, reset password.
3. Operators/Machines tabs: add + rename + deactivate.
4. Checklist tab: add an item, mark critical, remove one; confirm the `/floor` Start checklist reflects the change.
Capture a screenshot of the Admin Users tab as proof.

- [ ] **Step 4: Confirm the audit trail**

```bash
TURSO_DATABASE_URL=file:local.db npx tsx -e "import {getClient} from './lib/db/client'; (async()=>{const a=await getClient().execute('SELECT entity,action,field,COUNT(*) c FROM audit_log GROUP BY entity,action,field ORDER BY entity'); console.log(a.rows);})()"
```
Expected: rows for `user`/`operator`/`machine`/`checklist_item` creates and updates; any `password_hash` field row shows `***` (no secret).

- [ ] **Step 5: Append the Phase-4 section to `docs/supervisor-app-setup.md`**

```markdown

## Phase 4 — Admin UI
`/floor/admin` (admins only — `requireRole("admin")`; API routes return 403 for non-admins):
- **Users** — create (username/name/role/password), deactivate/reactivate, change role, reset
  password. Self-lockout guarded (can't deactivate or de-admin yourself). Passwords hashed; the
  audit records `password_hash` changes as `***` (never the secret).
- **Operators / Machines** — create, rename, deactivate/reactivate.
- **Checklist** — add / edit label / toggle critical / remove (deactivate) items on the active
  SU04 template. Removed items are soft-deactivated so historical checks still resolve.
Every change writes `audit_log` (entity user|operator|machine|checklist_item, changed_by=admin).
Deferred (future): full checklist template **versioning** (clone-to-new-version); Phase-4 edits
the active template in place (additive + soft-remove), which is safe for this internal tool.
```

- [ ] **Step 6: Commit**

```bash
git add docs/supervisor-app-setup.md
git commit -m "docs: Phase 4 admin UI"
```

---

## Phase 4 Self-Review

- **Spec coverage (§3 admin):** manage users ✓ Tasks 2/5/8; manage operators + machines ✓ Tasks 3/6/8; manage SU04 checklist items ✓ Tasks 4/7/8; admin-only access ✓ Task 5 guard + Task 8 `requireRole`; every change audited ✓ Tasks 2–4. Deferred (documented): full template versioning (edit-in-place chosen for this phase).
- **Placeholder scan:** none — every step has runnable code/commands.
- **Type consistency:** `AdminUser`/`NamedRow`/`ChecklistItemRow`/`ActiveTemplate` (Tasks 2–4) reused by the routes; `adminOnly`/`isAdmin` (Task 5) used by every admin route; repo function names (`createUser`/`setUserActive`/`setUserRole`/`resetUserPassword`, `createOperator`/`renameOperator`/`setOperatorActive`, `createMachine`/`renameMachine`/`setMachineActive`, `getActiveTemplateWithItems`/`addChecklistItem`/`updateChecklistItem`/`setChecklistItemActive`) match across tasks. `Role` reused from Phase-1 `session.ts`.

## Follow-on plans (not this document)
- **Phase 5 (optional):** full SU04 template **versioning** — clone the active template to a new version, edit there, and activate, so historical `readiness_days` keep referencing the version they were signed against; per-area templates.
