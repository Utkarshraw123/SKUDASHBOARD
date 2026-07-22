# Goods In — Edit, Void & Part-Code Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let compliance re-edit and delete (void) filed Goods In records, and filter both the tasks and filed-records lists by Wild Nutrition part code (1=Bulk, 2=RMs, 3=Finished Goods, 4=Ancillaries, Other).

**Architecture:** The `Goods In` sheet tab stays append-only for new records but gains a **Record ID** column (col R) so a filed record can be targeted for an in-place `values.update` (edit) or a Status→"Void" cell write (delete). Void rows are filtered out on read, so a deleted record's PO line automatically returns to the awaiting "G-In form" task list. Part-code filtering is a pure function of the part number's leading digit, applied independently to each list in the client view.

**Tech Stack:** Next.js 14 App Router (TypeScript), React 18, `googleapis` (service account, scope `spreadsheets`), Tailwind. No test runner — pure logic is verified with the repo's offline transpile-against-Node pattern; sheet writes are verified against a throwaway row on the live sheet; UI is verified in the browser preview.

## Global Constraints

- **Data source is Google Sheets, not a DB.** Write target = `PRODUCTION_REPORTS_SHEET_ID`, tab `Goods In`.
- **Part category is derived from the leading digit of the part number**, NOT the free-text `partType` column.
- **Never mutate the user's one real record** `PO2600151` / part `20000022` during testing. Sheet writes are tested only against a throwaway row (`ZZ-EDIT-TEST`) that is cleaned up.
- **Void = soft delete.** Status cell becomes `"Void"`; nothing is erased (compliance audit trail).
- **Header extension is non-destructive** — reuse the existing upsert-header path; cols A–Q keep their meaning, Record ID is appended as col R (index 17).
- Brand styling: copper `#c9612e`, cream chips, `border-[#e4ddd4]`, rounded-full pills — match existing `GoodsInView` chips exactly.
- tsconfig predates ES2015 iteration downlevel quirks: use `Array.from(...)` over `for..of` on Maps/Sets (not expected to arise here, but hold the rule).
- Deploy = `git push origin main` (Vercel auto-build) only after browser verification.

---

### Task 1: Part-code helper (pure)

**Files:**
- Modify: `lib/goods-in.ts` (add after `toISO`, before `recordToRow`)
- Test: `/private/tmp/claude-501/-Users-utkarshrawat-Wild-Dash/69df8faa-f32e-4610-893a-c3847b013371/scratchpad/goods-in-part.test.mjs`

**Interfaces:**
- Produces:
  - `type PartCategory = "bulk" | "rm" | "fg" | "ancillary" | "other"`
  - `function partCategory(partNumber: string): PartCategory`
  - `const PART_CATEGORY_CHIPS: { key: PartCategory | "all"; label: string }[]` — the chip row model, in order: All, Bulk, RMs, Finished Goods, Ancillaries, Other.

- [ ] **Step 1: Write the failing test**

Create the scratchpad test. It transpiles `lib/goods-in.ts` with the installed `typescript` package (type-only imports are erased) and asserts on `partCategory`.

```js
// goods-in-part.test.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "/Users/utkarshrawat/Wild Dash/wild-dash/node_modules/typescript/lib/typescript.js";

const SRC = "/Users/utkarshrawat/Wild Dash/wild-dash/lib/goods-in.ts";
const OUT = new URL("./goods-in.compiled.mjs", import.meta.url);
const js = ts.transpileModule(readFileSync(SRC, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2019 },
}).outputText;
writeFileSync(OUT, js);
const m = await import(pathToFileURL(OUT.pathname).href);

let pass = 0, fail = 0;
const eq = (got, want, msg) => { if (got === want) { pass++; } else { fail++; console.error(`FAIL ${msg}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); } };

eq(m.partCategory("10000267"), "bulk", "1-code → bulk");
eq(m.partCategory("20000022"), "rm", "2-code → rm");
eq(m.partCategory("30000619"), "fg", "3-code → fg");
eq(m.partCategory("40001234"), "ancillary", "4-code → ancillary");
eq(m.partCategory("50000000"), "other", "5-code → other");
eq(m.partCategory(""), "other", "blank → other");
eq(m.partCategory("  30000619 "), "fg", "whitespace trimmed");
eq(m.partCategory("ABC"), "other", "non-numeric → other");
eq(m.PART_CATEGORY_CHIPS[0].key, "all", "first chip is all");
eq(m.PART_CATEGORY_CHIPS.length, 6, "six chips");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && node "/private/tmp/claude-501/-Users-utkarshrawat-Wild-Dash/69df8faa-f32e-4610-893a-c3847b013371/scratchpad/goods-in-part.test.mjs"`
Expected: FAIL — `m.partCategory is not a function` (or assertion failures).

- [ ] **Step 3: Write minimal implementation**

In `lib/goods-in.ts`, add after the `toISO` function (line ~66):

```ts
export type PartCategory = "bulk" | "rm" | "fg" | "ancillary" | "other";

// Wild Nutrition part-code convention keys off the FIRST digit of the part number:
// 1=bulk/capsules, 2=raw materials, 3=finished goods, 4=ancillaries; anything else → other.
export function partCategory(partNumber: string): PartCategory {
  const c = (partNumber ?? "").trim().charAt(0);
  if (c === "1") return "bulk";
  if (c === "2") return "rm";
  if (c === "3") return "fg";
  if (c === "4") return "ancillary";
  return "other";
}

export const PART_CATEGORY_CHIPS: { key: PartCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "bulk", label: "Bulk" },
  { key: "rm", label: "RMs" },
  { key: "fg", label: "Finished Goods" },
  { key: "ancillary", label: "Ancillaries" },
  { key: "other", label: "Other" },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && node "/private/tmp/claude-501/-Users-utkarshrawat-Wild-Dash/69df8faa-f32e-4610-893a-c3847b013371/scratchpad/goods-in-part.test.mjs"`
Expected: `10 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
git add lib/goods-in.ts
git commit -m "feat(goods-in): partCategory helper + chip model"
```

---

### Task 2: Record ID + Void in the data model (pure)

**Files:**
- Modify: `lib/goods-in.ts` (`GoodsInRecord`, `GOODS_IN_HEADERS`, `recordToRow`, `parseGoodsInRecords`)
- Test: `/private/tmp/claude-501/-Users-utkarshrawat-Wild-Dash/69df8faa-f32e-4610-893a-c3847b013371/scratchpad/goods-in-record.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `GoodsInRecord` gains `recordId: string` (last field).
  - `GOODS_IN_HEADERS` gains `"Record ID"` as the 18th entry (index 17).
  - `recordToRow(r)` returns 18 values, `r.recordId` last.
  - `parseGoodsInRecords(rows)` reads `recordId` from `r[17]` and **excludes rows whose Status (`r[16]`) is `"Void"`** (case-insensitive).

- [ ] **Step 1: Write the failing test**

```js
// goods-in-record.test.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "/Users/utkarshrawat/Wild Dash/wild-dash/node_modules/typescript/lib/typescript.js";

const SRC = "/Users/utkarshrawat/Wild Dash/wild-dash/lib/goods-in.ts";
const OUT = new URL("./goods-in.compiled2.mjs", import.meta.url);
writeFileSync(OUT, ts.transpileModule(readFileSync(SRC, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2019 },
}).outputText);
const m = await import(pathToFileURL(OUT.pathname).href);

let pass = 0, fail = 0;
const eq = (got, want, msg) => { if (got === want) pass++; else { fail++; console.error(`FAIL ${msg}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); } };

// Headers: 18 cols, Record ID last
eq(m.GOODS_IN_HEADERS.length, 18, "18 headers");
eq(m.GOODS_IN_HEADERS[17], "Record ID", "col R is Record ID");

// recordToRow round-trips recordId at index 17
const rec = { timestamp: "2026-07-22T10:00:00Z", po: "PO1", partNumber: "30000001", description: "D",
  quantity: "5", supplier: "S", supplierProductCode: "SPC", batchLot: "B", bbd: "01/01/2027",
  haulier: "", date: "", time: "", cofaReceived: "", comments: "", coaUrl: "", docUrls: [],
  status: "Booked in", recordId: "PO1-30000001-123" };
const row = m.recordToRow(rec);
eq(row.length, 18, "row has 18 cells");
eq(row[17], "PO1-30000001-123", "recordId serialised at 17");

// parse reads recordId and drops Void
const rows = [
  ["2026-07-22T10:00:00Z","PO1","30000001","D","5","S","SPC","B","01/01/2027","","","","","","","","Booked in","PO1-30000001-1"],
  ["2026-07-22T09:00:00Z","PO2","40000002","D2","3","S2","","","","","","","","","","","Void","PO2-40000002-1"],
];
const parsed = m.parseGoodsInRecords(rows);
eq(parsed.length, 1, "Void row excluded");
eq(parsed[0].recordId, "PO1-30000001-1", "recordId parsed");
eq(parsed[0].po, "PO1", "active record kept");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && node "/private/tmp/claude-501/-Users-utkarshrawat-Wild-Dash/69df8faa-f32e-4610-893a-c3847b013371/scratchpad/goods-in-record.test.mjs"`
Expected: FAIL — `18 headers` (currently 17) and `Void row excluded` fail.

- [ ] **Step 3: Write minimal implementation**

In `lib/goods-in.ts`:

3a. Add `recordId` to the `GoodsInRecord` interface (after `status`):

```ts
  status: string;            // "Booked in" | "Void"
  recordId: string;          // stable id for edit/void targeting; "" for legacy rows
```

3b. Extend `GOODS_IN_HEADERS` (append `"Record ID"`):

```ts
export const GOODS_IN_HEADERS = [
  "Timestamp", "PO Number", "Part Number", "Description", "Quantity", "Supplier",
  "Supplier Product Code", "Batch/Lot No.", "BBD", "Haulier", "Date", "Time",
  "CofA Received", "Comments", "COA URL", "Document URLs", "Status", "Record ID",
];
```

3c. Extend `recordToRow` (append `r.recordId`):

```ts
export function recordToRow(r: GoodsInRecord): (string | number)[] {
  return [
    r.timestamp, r.po, r.partNumber, r.description, r.quantity, r.supplier,
    r.supplierProductCode, r.batchLot, r.bbd, r.haulier, r.date, r.time,
    r.cofaReceived, r.comments, r.coaUrl, r.docUrls.join(" | "), r.status, r.recordId,
  ];
}
```

3d. In `parseGoodsInRecords`, filter out Void rows and parse `recordId`. Replace the existing `.filter(...)` and add `recordId` to the mapped object:

```ts
export function parseGoodsInRecords(rows: (string | number)[][]): GoodsInRecord[] {
  return rows
    .filter(r => str(r[1]) !== "")                          // must have a PO
    .filter(r => str(r[16]).toLowerCase() !== "void")       // drop voided (soft-deleted) rows
    .map(r => ({
      timestamp: str(r[0]),
      po: str(r[1]),
      partNumber: str(r[2]),
      description: str(r[3]),
      quantity: str(r[4]),
      supplier: str(r[5]),
      supplierProductCode: str(r[6]),
      batchLot: str(r[7]),
      bbd: str(r[8]),
      haulier: str(r[9]),
      date: str(r[10]),
      time: str(r[11]),
      cofaReceived: str(r[12]),
      comments: str(r[13]),
      coaUrl: str(r[14]),
      docUrls: str(r[15]).split("|").map(s => s.trim()).filter(Boolean),
      status: str(r[16]) || "Booked in",
      recordId: str(r[17]),
    }))
    .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && node "/private/tmp/claude-501/-Users-utkarshrawat-Wild-Dash/69df8faa-f32e-4610-893a-c3847b013371/scratchpad/goods-in-record.test.mjs"`
Expected: `9 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
git add lib/goods-in.ts
git commit -m "feat(goods-in): Record ID column + Void exclusion in record model"
```

---

### Task 3: Sheet writers — update & void (verified on live sheet)

**Files:**
- Modify: `lib/sheets.ts` (`fetchGoodsInRows` range; add `updateGoodsInRecord`, `voidGoodsInRecord`)
- Test (approach verification): `/private/tmp/claude-501/-Users-utkarshrawat-Wild-Dash/69df8faa-f32e-4610-893a-c3847b013371/scratchpad/goods-in-write.live.mjs`

**Interfaces:**
- Consumes: `GOODS_IN_HEADERS` (18 cols) from Task 2; the `Record ID` at row index 17.
- Produces:
  - `updateGoodsInRecord(recordId: string, row: (string | number)[], fallbackKey?: string): Promise<void>` — finds the row (by Record ID col R; if not found and `fallbackKey` given, by `` `${po} ${part} ${timestamp}` ``), overwrites `A{n}:R{n}` with `row`. Throws `"Record not found"` if no match.
  - `voidGoodsInRecord(recordId: string, fallbackKey?: string): Promise<void>` — finds the row the same way, sets `Q{n}` (Status) to `"Void"`.

Both read the tab **fresh** (not through the 120s cache) so row indices are current.

- [ ] **Step 1: Write the live approach-verification script**

This proves the row-targeting/update/void logic against the real sheet using a **throwaway** row, then cleans up. It uses `googleapis` directly (the Next `unstable_cache` layer can't run outside Next), mirroring what the library functions will do.

```js
// goods-in-write.live.mjs — run with: node --env-file=.env.local <this>
import { google } from "/Users/utkarshrawat/Wild Dash/wild-dash/node_modules/googleapis/build/src/index.js";

const TAB = "Goods In";
const sheetId = process.env.PRODUCTION_REPORTS_SHEET_ID;
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const ID = "ZZ-EDIT-TEST-" + Date.now();
const base = ["2000-01-01T00:00:00Z","ZZ-EDIT-TEST","30000001","THROWAWAY","1","S","","","","","","","","","","","Booked in", ID];

async function findRow(recordId) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${TAB}!A2:R2000` });
  const rows = res.data.values ?? [];
  const i = rows.findIndex(r => String(r[17] ?? "").trim() === recordId);
  return i < 0 ? -1 : i + 2; // sheet row number
}

// 1. append throwaway
await sheets.spreadsheets.values.append({ spreadsheetId: sheetId, range: `${TAB}!A1`,
  valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: [base] } });
let n = await findRow(ID);
console.log("appended at row", n);

// 2. update (change Batch/Lot col H index 7)
const updated = [...base]; updated[7] = "EDITED-BATCH";
await sheets.spreadsheets.values.update({ spreadsheetId: sheetId, range: `${TAB}!A${n}:R${n}`,
  valueInputOption: "RAW", requestBody: { values: [updated] } });
let check = (await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${TAB}!A${n}:R${n}` })).data.values[0];
console.log("after update, batch =", check[7], check[7] === "EDITED-BATCH" ? "OK" : "FAIL");

// 3. void (Status col Q index 16)
await sheets.spreadsheets.values.update({ spreadsheetId: sheetId, range: `${TAB}!Q${n}`,
  valueInputOption: "RAW", requestBody: { values: [["Void"]] } });
check = (await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${TAB}!Q${n}` })).data.values[0];
console.log("after void, status =", check[0], check[0] === "Void" ? "OK" : "FAIL");

// 4. cleanup — delete the throwaway row entirely
const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
const gid = meta.data.sheets.find(s => s.properties.title === TAB).properties.sheetId;
await sheets.spreadsheets.batchUpdate({ spreadsheetId: sheetId, requestBody: { requests: [
  { deleteDimension: { range: { sheetId: gid, dimension: "ROWS", startIndex: n - 1, endIndex: n } } },
]}});
console.log("cleaned up row", n);
```

- [ ] **Step 2: Run it to prove the approach on the live sheet**

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && node --env-file=.env.local "/private/tmp/claude-501/-Users-utkarshrawat-Wild-Dash/69df8faa-f32e-4610-893a-c3847b013371/scratchpad/goods-in-write.live.mjs"`
Expected: prints `appended at row N`, `after update, batch = EDITED-BATCH OK`, `after void, status = Void OK`, `cleaned up row N`. Confirm the user's real `PO2600151` row is untouched (the script only ever targets `ZZ-EDIT-TEST-*`).

- [ ] **Step 3: Implement the library functions**

3a. In `lib/sheets.ts`, change the `fetchGoodsInRows` range from `A2:Q2000` to `A2:R2000`:

```ts
    const rows = await cachedValues(sheetId, `${GOODS_IN_TAB}!A2:R2000`);
```

3b. Add these two functions after `appendGoodsInRecord` (after line ~518). They locate the row fresh, then update:

```ts
// Find a Goods In row (1-based sheet row number) by Record ID (col R, index 17).
// Falls back to `${po} ${part} ${timestamp}` (cols B,C,A) for legacy rows without an ID.
async function findGoodsInRow(
  sheets: Awaited<ReturnType<typeof getSheets>>,
  sheetId: string,
  recordId: string,
  fallbackKey?: string,
): Promise<number> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${GOODS_IN_TAB}!A2:R2000` });
  const rows = (res.data.values ?? []) as string[][];
  let i = rows.findIndex(r => String(r[17] ?? "").trim() === recordId && recordId !== "");
  if (i < 0 && fallbackKey) {
    i = rows.findIndex(r => `${String(r[1] ?? "").trim()} ${String(r[2] ?? "").trim()} ${String(r[0] ?? "").trim()}` === fallbackKey);
  }
  if (i < 0) throw new Error("Record not found");
  return i + 2;
}

// Overwrite an existing Goods In record in place (edit). `row` must be 18 cells (A..R).
export async function updateGoodsInRecord(recordId: string, row: (string | number)[], fallbackKey?: string): Promise<void> {
  const sheetId = process.env.PRODUCTION_REPORTS_SHEET_ID;
  if (!sheetId) throw new Error("PRODUCTION_REPORTS_SHEET_ID env var missing");
  const sheets = await getSheets();
  const n = await findGoodsInRow(sheets, sheetId, recordId, fallbackKey);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId, range: `${GOODS_IN_TAB}!A${n}:R${n}`, valueInputOption: "RAW", requestBody: { values: [row] },
  });
}

// Soft-delete: set the Status cell (col Q) to "Void". Keeps the audit trail.
export async function voidGoodsInRecord(recordId: string, fallbackKey?: string): Promise<void> {
  const sheetId = process.env.PRODUCTION_REPORTS_SHEET_ID;
  if (!sheetId) throw new Error("PRODUCTION_REPORTS_SHEET_ID env var missing");
  const sheets = await getSheets();
  const n = await findGoodsInRow(sheets, sheetId, recordId, fallbackKey);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId, range: `${GOODS_IN_TAB}!Q${n}`, valueInputOption: "RAW", requestBody: { values: [["Void"]] },
  });
}
```

- [ ] **Step 4: Type-check**

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && npx tsc --noEmit`
Expected: no errors (a clean exit). If pre-existing unrelated errors appear, confirm none reference `lib/sheets.ts` or `lib/goods-in.ts`.

- [ ] **Step 5: Commit**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
git add lib/sheets.ts
git commit -m "feat(goods-in): updateGoodsInRecord + voidGoodsInRecord sheet writers"
```

---

### Task 4: API — edit mode + void endpoint

**Files:**
- Modify: `app/api/goods-in/route.ts`
- Create: `app/api/goods-in/void/route.ts`

**Interfaces:**
- Consumes: `updateGoodsInRecord`, `voidGoodsInRecord`, `appendGoodsInRecord`, `GOODS_IN_HEADERS`, `recordToRow` (Tasks 2–3).
- Produces:
  - `POST /api/goods-in` now accepts optional form fields `recordId`, `timestamp`, `coaUrlExisting`, `docUrlsExisting`. When `recordId` is present → edit (update in place); otherwise → append with a freshly generated `recordId`.
  - `POST /api/goods-in/void` accepts JSON `{ recordId, fallbackKey?, password }` → voids.

- [ ] **Step 1: Edit-mode in the existing POST route**

In `app/api/goods-in/route.ts`, update the imports and the record-build/save section.

1a. Imports:

```ts
import { appendGoodsInRecord, updateGoodsInRecord } from "@/lib/sheets";
```

1b. After the attachment-upload block, replace the `const record = {...}` + `try { await appendGoodsInRecord(...) }` section with edit-aware logic:

```ts
  const editId = g("recordId");
  const existingCoa = g("coaUrlExisting");
  const existingDocs = g("docUrlsExisting").split("|").map(s => s.trim()).filter(Boolean);

  const record: GoodsInRecord = {
    timestamp: editId ? (g("timestamp") || new Date().toISOString()) : new Date().toISOString(),
    po,
    partNumber: g("partNumber"),
    description: g("description"),
    quantity: g("quantity"),
    supplier: g("supplier"),
    supplierProductCode: g("supplierProductCode"),
    batchLot: g("batchLot"),
    bbd: g("bbd"),
    haulier: g("haulier"),
    date: g("date"),
    time: g("time"),
    cofaReceived: g("cofaReceived"),
    comments: g("comments"),
    // keep existing attachments on edit unless new ones were uploaded
    coaUrl: coaUrl || existingCoa,
    docUrls: docUrls.length ? docUrls : existingDocs,
    status: "Booked in",
    recordId: editId || `${po}-${g("partNumber")}-${Date.now()}`,
  };

  try {
    if (editId) {
      const fallbackKey = `${record.po} ${record.partNumber} ${record.timestamp}`;
      await updateGoodsInRecord(editId, recordToRow(record), fallbackKey);
    } else {
      await appendGoodsInRecord(GOODS_IN_HEADERS, recordToRow(record));
    }
    return NextResponse.json({ ok: true, record, warnings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save record";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
```

Note: the `GoodsInRecord` type now requires `recordId` (Task 2), so this object satisfies it. `recordToRow` and `GOODS_IN_HEADERS` are already imported at the top of the file.

- [ ] **Step 2: Create the void route**

Create `app/api/goods-in/void/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { voidGoodsInRecord } from "@/lib/sheets";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { recordId?: string; fallbackKey?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const expected = process.env.GOODS_IN_PASSWORD ?? process.env.PRODUCTION_REPORT_PASSWORD ?? "12345";
  if ((body.password ?? "") !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const recordId = (body.recordId ?? "").trim();
  const fallbackKey = (body.fallbackKey ?? "").trim() || undefined;
  if (!recordId && !fallbackKey) {
    return NextResponse.json({ error: "recordId required" }, { status: 400 });
  }

  try {
    await voidGoodsInRecord(recordId, fallbackKey);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete record";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 3: Type-check**

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && npx tsc --noEmit`
Expected: clean exit (no new errors referencing `app/api/goods-in/`).

- [ ] **Step 4: Commit**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
git add app/api/goods-in/route.ts app/api/goods-in/void/route.ts
git commit -m "feat(goods-in): API edit-mode update + void endpoint"
```

---

### Task 5: Form — edit pre-fill

**Files:**
- Modify: `components/GoodsInForm.tsx`

**Interfaces:**
- Consumes: `GoodsInRecord` (with `recordId`), the edit-aware POST from Task 4.
- Produces: `GoodsInForm` accepts an optional `record?: GoodsInRecord` prop. In edit mode it pre-fills the three compliance fields, shows an "Edit" title, and sends `recordId`, `timestamp`, `coaUrlExisting`, `docUrlsExisting` so the server updates in place.

- [ ] **Step 1: Add the prop and edit-aware state**

In `components/GoodsInForm.tsx`:

1a. Import the record type and update the component signature:

```ts
import type { GoodsInTask, GoodsInRecord } from "@/lib/goods-in";
```

```ts
export default function GoodsInForm({ task, record, onClose }: { task: GoodsInTask; record?: GoodsInRecord; onClose: () => void }) {
```

1b. Seed the compliance fields from `record` when editing (replace the three `useState("")` initialisers):

```ts
  const isEdit = !!record;
  const [supplierProductCode, setSupplierProductCode] = useState(record?.supplierProductCode ?? "");
  const [batchLot, setBatchLot] = useState(record?.batchLot ?? "");
  const [bbd, setBbd] = useState(record?.bbd ?? "");
  const [password, setPassword] = useState("");
```

1c. Extend `fields()` to carry the edit identifiers and existing attachments:

```ts
  function fields() {
    return {
      po: task.po, partNumber: task.partNumber, description: task.description,
      quantity: task.quantity != null ? String(task.quantity) : "", supplier: task.supplier,
      supplierProductCode, batchLot, bbd,
      ...(isEdit ? {
        recordId: record!.recordId,
        timestamp: record!.timestamp,
        coaUrlExisting: record!.coaUrl,
        docUrlsExisting: record!.docUrls.join(" | "),
      } : {}),
    };
  }
```

- [ ] **Step 2: Reflect edit mode in the header copy**

Replace the modal title line:

```tsx
            <h2 className="font-serif text-xl text-charcoal">{isEdit ? "Edit" : "G-In form"} &mdash; QA13-CF01</h2>
```

And the success heading (in the `saved` panel):

```tsx
            <p className="font-serif text-lg text-charcoal">G-In form {isEdit ? "updated" : "filed"} &amp; downloaded</p>
```

- [ ] **Step 3: Verify in the browser**

Deferred to Task 7 (form edit is exercised end-to-end there). For now confirm it compiles:
Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 4: Commit**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
git add components/GoodsInForm.tsx
git commit -m "feat(goods-in): form pre-fills for edit + carries edit identifiers"
```

---

### Task 6: View — part-code filters + delete wiring

**Files:**
- Modify: `components/GoodsInView.tsx`

**Interfaces:**
- Consumes: `partCategory`, `PART_CATEGORY_CHIPS` (Task 1), edit-capable `GoodsInForm` (Task 5), `POST /api/goods-in/void` (Task 4).
- Produces: independent part-type chip rows on both lists; reopen passes the matching record into the form; a Delete button on each filed record voids it after confirmation.

- [ ] **Step 1: Imports, state, and a reusable chip row**

1a. Update imports at the top of `components/GoodsInView.tsx`:

```ts
import { useState, useMemo } from "react";
import type { GoodsInTask, GoodsInRecord, Urgency, PartCategory } from "@/lib/goods-in";
import { summarise, partCategory, PART_CATEGORY_CHIPS } from "@/lib/goods-in";
```

1b. Add state inside the component (alongside the existing `filter`/`active`):

```ts
  const [tasksPart, setTasksPart] = useState<PartCategory | "all">("all");
  const [recordsPart, setRecordsPart] = useState<PartCategory | "all">("all");
  const [activeRecord, setActiveRecord] = useState<GoodsInRecord | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
```

1c. Add a small chip-row component below the `Kpi` function (module scope):

```tsx
function PartChips({ value, onChange }: { value: PartCategory | "all"; onChange: (v: PartCategory | "all") => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PART_CATEGORY_CHIPS.map(c => (
        <button key={c.key} type="button" onClick={() => onChange(c.key)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${value === c.key ? "bg-charcoal text-white border-charcoal" : "border-[#e4ddd4] text-text-muted hover:bg-cream"}`}>
          {c.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Filter the two lists by part category**

Replace the `shown` memo and add a records memo:

```ts
  const shown = useMemo(
    () => tasks.filter(t => (filter === "all" || t.status === filter) && (tasksPart === "all" || partCategory(t.partNumber) === tasksPart)),
    [tasks, filter, tasksPart],
  );
  const shownRecords = useMemo(
    () => records.filter(r => recordsPart === "all" || partCategory(r.partNumber) === recordsPart),
    [records, recordsPart],
  );
```

Then change the filed-records table to iterate `shownRecords` instead of `records` (the `{records.map(...)}` and the `records.length === 0` empty-state guard both become `shownRecords`). Keep the empty-state copy but branch it:

```tsx
        {shownRecords.length === 0 ? (
          <p className="px-5 py-12 text-center text-text-muted text-sm">
            {records.length === 0 ? "No forms filed yet. Open a G-In form above and save it to create one." : "No filed forms match this filter."}
          </p>
```

- [ ] **Step 3: Add the part-chip rows to both list headers**

3a. In the tasks-list header block (the `flex items-center justify-between` div holding the `<h2>Goods In tasks</h2>` and the status chips), add the part chips as a second row. Wrap the header so the status chips and part chips stack:

```tsx
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-serif text-lg font-medium text-charcoal">Goods In tasks</h2>
          <div className="flex gap-1.5">
            {(["awaiting", "booked_in", "all"] as const).map(f => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === f ? "bg-copper text-white border-copper" : "border-[#e4ddd4] text-text-muted hover:bg-cream"}`}>
                {f === "awaiting" ? "Awaiting" : f === "booked_in" ? "Filed" : "All"}
              </button>
            ))}
          </div>
        </div>
        <PartChips value={tasksPart} onChange={setTasksPart} />
      </div>
```

(This replaces the existing `mb-3 flex ...` header div and its contents.)

3b. In the filed-records header block (the `<div className="mb-3">` with `<h2>Filed Goods In forms</h2>`), add part chips under the subtitle:

```tsx
      <div className="mb-3 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-lg font-medium text-charcoal">Filed Goods In forms</h2>
          <p className="text-text-muted text-xs mt-0.5">Batch &amp; BBD captured for warehouse verification. Download the Word form to complete the QA checklist.</p>
        </div>
        <PartChips value={recordsPart} onChange={setRecordsPart} />
      </div>
```

- [ ] **Step 4: Wire reopen to pass the record into the form**

4a. The tasks-list "Filed · reopen" button should open the form with its record. Replace that button's handler:

```tsx
                        {t.status === "booked_in" ? (
                          <button onClick={() => { setActiveRecord(records.find(r => r.po === t.po && r.partNumber === t.partNumber) ?? null); setActive(t); }}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-[10px] font-medium hover:bg-emerald-200 transition-colors">
                            Filed · reopen
                          </button>
                        ) : (
                          <button onClick={() => { setActiveRecord(null); setActive(t); }}
                            className="rounded-lg bg-copper text-white px-3 py-1.5 text-xs font-medium hover:bg-copper-light transition-colors">
                            G-In form &rarr;
                          </button>
                        )}
```

4b. Render the form with the record and reset `activeRecord` on close. Replace the final `{active && <GoodsInForm ... />}` line:

```tsx
      {active && <GoodsInForm task={active} record={activeRecord ?? undefined} onClose={() => { setActive(null); setActiveRecord(null); }} />}
```

- [ ] **Step 5: Add a Delete (void) action to each filed record row**

5a. Add a delete handler inside the component (before the `return`):

```ts
  async function del(r: GoodsInRecord) {
    if (!window.confirm(`Delete the filed Goods In form for PO ${r.po} / part ${r.partNumber}? It returns to the awaiting list.`)) return;
    const password = window.prompt("Goods In / compliance password to delete:") ?? "";
    if (!password) return;
    setDeleting(r.recordId || `${r.po} ${r.partNumber} ${r.timestamp}`);
    try {
      const res = await fetch("/api/goods-in/void", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: r.recordId, fallbackKey: `${r.po} ${r.partNumber} ${r.timestamp}`, password }),
      });
      const data = await res.json();
      if (!res.ok) { window.alert(data.error || "Failed to delete."); return; }
      router.refresh();
    } catch {
      window.alert("Network error — please try again.");
    } finally {
      setDeleting(null);
    }
  }
```

5b. Add `useRouter` — update the top import and instantiate it in the component:

```ts
import { useRouter } from "next/navigation";
```

```ts
export default function GoodsInView({ tasks, records }: { tasks: GoodsInTask[]; records: GoodsInRecord[] }) {
  const router = useRouter();
```

5c. In the filed-records table, add a Delete button next to the existing "Word" download button. Change the last `<td>` of each record row to hold both:

```tsx
                    <td className={`${TD} text-right`}>
                      <div className="inline-flex items-center gap-3">
                        <button onClick={() => downloadGrn(r)} className="text-copper hover:text-copper-light text-xs font-medium inline-flex items-center gap-1">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                          Word
                        </button>
                        <button onClick={() => del(r)} disabled={deleting !== null}
                          className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-40">
                          {deleting === (r.recordId || `${r.po} ${r.partNumber} ${r.timestamp}`) ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
```

- [ ] **Step 6: Type-check**

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 7: Commit**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
git add components/GoodsInView.tsx
git commit -m "feat(goods-in): part-code filters on both lists + edit/delete wiring"
```

---

### Task 7: Browser verification & deploy

**Files:** none (verification + deploy only).

**Interfaces:** exercises Tasks 1–6 end-to-end against the running dev server.

- [ ] **Step 1: Start the dev server**

Use the Browser pane: `preview_start` with `{ name: "wild-dash" }` (create `.claude/launch.json` with `runtimeExecutable: "npm"`, `runtimeArgs: ["run","dev"]`, `port: 3000` if it doesn't exist). Navigate to `http://localhost:3000/goods-in`. If the market-modal blocks, set cookies `marketMode=dtc; marketsConfigured=1` and reload.

- [ ] **Step 2: Verify part-code filters**

On `/goods-in`: click each part chip (Bulk / RMs / Finished Goods / Ancillaries / Other) above the **tasks** list and confirm the rows narrow to matching leading digits (via `read_page`). Repeat on the **filed records** list chips independently. Confirm "All" restores the full list and the two lists filter independently.

- [ ] **Step 3: Verify edit round-trip**

Click **G-In form →** on an awaiting PO, fill Supplier Code / Batch / BBD + password `12345`, Save. After it appears under Filed, click **Filed · reopen** and confirm the three fields are **pre-filled**. Change the Batch value, Save. Confirm via `read_page` (and, if needed, a fresh read of the sheet with the Task 3 googleapis pattern) that the row was **updated in place** — no duplicate PO+part row was appended, and the title read "Edit — QA13-CF01".

- [ ] **Step 4: Verify delete → returns to awaiting**

Click **Delete** on the filed record just edited, confirm the dialog + password prompt (`12345`). After `router.refresh()` (allow for the ~120s cache; hard-reload if needed), confirm the record leaves "Filed Goods In forms" and the PO line reappears as an awaiting **G-In form →** task. Confirm on the sheet that the row still exists with Status `Void` (audit trail preserved), not physically removed.

- [ ] **Step 5: Clean up test data**

Delete any throwaway records created during Steps 3–4 from the `Goods In` tab (or leave the Void row if you want to keep the demonstration — but remove any active test PO records so the live list is clean). Never touch `PO2600151`.

- [ ] **Step 6: Deploy**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
git push origin main
```

Then confirm the Vercel build succeeded: `npx vercel ls skudashboard` (or check the deploy URL). Smoke-test `/goods-in` on the live site.

- [ ] **Step 7: Update docs**

Append a short note to `CONTEXT.md` §6i and `WILDDASHHANDOFF.md` recording: Record ID column (col R, 18 cols now), Void soft-delete, edit-in-place, and the part-code filters. Commit:

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
git add CONTEXT.md WILDDASHHANDOFF.md
git commit -m "docs: Goods In edit/void/filters"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- §3 Record ID column → Task 2 (headers/row/parse) + Task 3 (range) ✅
- §3 Status Void value → Task 2 (parse exclusion) + Task 3 (`voidGoodsInRecord`) ✅
- §3 Record ID generation + legacy fallback → Task 4 (generate) + Task 3 (`findGoodsInRow` fallback) ✅
- §4 partCategory + chips both lists, independent state → Task 1 + Task 6 ✅
- §4 derive from leading digit (ignore partType col) → Task 1 ✅
- §5 edit pre-fill + update-in-place + retain attachments → Tasks 4, 5 ✅
- §6 delete=void, confirm, returns to awaiting → Tasks 4 (route), 6 (button) + Task 2 (parse exclusion drives task revert) ✅
- §7 testing (pure offline, throwaway-row live write, browser E2E, avoid real record) → Tasks 1–3, 7 ✅
- §8 cache-lag note honored (Step 4 allows for it); header extension non-destructive (Task 2/3) ✅

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✅

**Type consistency:** `GoodsInRecord.recordId` added in Task 2 and used consistently in Tasks 3–6; `partCategory`/`PART_CATEGORY_CHIPS` names match across Tasks 1 and 6; `updateGoodsInRecord(recordId, row, fallbackKey?)` / `voidGoodsInRecord(recordId, fallbackKey?)` signatures match between Task 3 (def) and Task 4 (call); form field names (`recordId`, `timestamp`, `coaUrlExisting`, `docUrlsExisting`) match between Task 5 (send) and Task 4 (read). ✅
