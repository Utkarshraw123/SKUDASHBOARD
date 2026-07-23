# Goods In — Multi-line PO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let compliance file an entire multi-line PO (e.g. PO2600151) from ONE grouped Goods In form — all products auto-populated, per-line Supplier Product Code / Batch-Lot / BBD, partial deliveries supported — producing one combined QA13-CF01 Word doc; and restrict Goods In to stock codes (1/2/3/4) only.

**Architecture:** A bulk-entry UI over the EXISTING per-line record model (`Goods In` tab, one row per PO+part, 18 cols incl. Record ID + Status). The tasks list groups open POs by PO number; a multi-line PO opens a new grouped form, a single-line PO keeps the current modal. Saving loops the ticked lines through the SAME create/update-in-place logic already in use, then `revalidateTag("sheets")`. No sheet-schema change.

**Tech Stack:** Next.js 14.2.5 App Router (TS), React 18, `googleapis` (service account), `docx`, `@vercel/blob`, Tailwind. No test runner — pure logic uses the offline transpile-against-Node pattern; live writes are tested against a throwaway PO; UI is verified in the browser.

## Global Constraints

- **Datastore is Google Sheets.** Write target `PRODUCTION_REPORTS_SHEET_ID`, tab `Goods In`, 18 cols A–R (Record ID = col R / index 17, Status = col Q / index 16). **Never mutate the real record `PO2600151`/`20000022`** in tests — use a throwaway PO (`ZZ-*`) and clean it up.
- **Stock-only:** Goods In shows only lines whose `partCategory` is bulk/rm/fg/ancillary (leading digit 1/2/3/4). `partCategory(partNumber) === "other"` lines (freight/service/`ZZ…`/5-/7-codes) are excluded everywhere in the tasks list, and the **"Other" filter chip is removed** from Goods In.
- **Record model unchanged:** one row per PO+part. Edit = update in place (Record ID or fallback `${po} ${part} ${timestamp}`); Delete = Void (Status→"Void"); both already exist in `lib/sheets.ts`.
- **Cache:** every write route calls `revalidateTag("sheets")` after the write (the tag `cachedValues` uses) so lists refresh immediately.
- **Keep both forms:** single-line PO → existing `GoodsInForm` modal; multi-line PO → new `GoodsInPoForm`. Routed by line count.
- **Attachments:** one CofA + docs set per delivery, applied to all lines saved in that submission; degrades gracefully without `BLOB_READ_WRITE_TOKEN` (existing warning).
- Brand styling: copper `#c9612e`, cream chips, charcoal active part-chips, `border-[#e4ddd4]`, `rounded-full` pills, serif headings — match existing `GoodsInView`.
- tsconfig predates ES2015 downlevel iteration: use `Array.from(map.entries())`, not `for..of` over a Map.
- Do NOT commit scratchpad `.mjs` test files. Deploy = `git push origin main` (auto-deploys) after browser verification.

---

### Task 1: Stock-only filter + Goods-In chip list (pure)

**Files:**
- Modify: `lib/goods-in.ts`
- Test: `<scratch>/gi-stock.test.mjs`  (`<scratch>` = `/private/tmp/claude-501/-Users-utkarshrawat-Wild-Dash/69df8faa-f32e-4610-893a-c3847b013371/scratchpad`)

**Interfaces produced:**
- `isStockPart(partNumber: string): boolean` — `partCategory(partNumber) !== "other"`.
- `GOODS_IN_PART_CHIPS` — `PART_CATEGORY_CHIPS` without the `"other"` entry (5 chips: All/Bulk/RMs/Finished Goods/Ancillaries).
- `buildGoodsInTasks` now excludes non-stock lines.

- [ ] **Step 1: Failing test** — create `<scratch>/gi-stock.test.mjs`:

```js
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "/Users/utkarshrawat/Wild Dash/wild-dash/node_modules/typescript/lib/typescript.js";
const SRC = "/Users/utkarshrawat/Wild Dash/wild-dash/lib/goods-in.ts";
const OUT = new URL("./gi.compiled-stock.mjs", import.meta.url);
writeFileSync(OUT, ts.transpileModule(readFileSync(SRC,"utf8"), { compilerOptions:{ module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2019 } }).outputText);
const m = await import(pathToFileURL(OUT.pathname).href);
let pass=0, fail=0; const eq=(g,w,msg)=>{ if(g===w)pass++; else {fail++; console.error(`FAIL ${msg}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`);} };
eq(m.isStockPart("10000001"), true, "1=stock");
eq(m.isStockPart("20000001"), true, "2=stock");
eq(m.isStockPart("30000001"), true, "3=stock");
eq(m.isStockPart("40000001"), true, "4=stock");
eq(m.isStockPart("50000003"), false, "5=not stock");
eq(m.isStockPart("ZZ.WHO.UK1-60000"), false, "ZZ=not stock");
eq(m.GOODS_IN_PART_CHIPS.length, 5, "5 chips (no Other)");
eq(m.GOODS_IN_PART_CHIPS.some(c=>c.key==="other"), false, "no Other chip");
// buildGoodsInTasks excludes non-stock
const pos = [
  { order:"PO1", partNumber:"20000001", description:"rm", partType:"", vendorName:"S", orderQuantity:5, dueDate:"01/08/2026" },
  { order:"PO1", partNumber:"ZZ.X", description:"freight", partType:"", vendorName:"S", orderQuantity:1, dueDate:"01/08/2026" },
];
const tasks = m.buildGoodsInTasks(pos, [], new Date("2026-07-23"));
eq(tasks.length, 1, "non-stock line excluded");
eq(tasks[0].partNumber, "20000001", "only stock line kept");
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
```

- [ ] **Step 2: Run — expect FAIL** (`isStockPart is not a function`):

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && node "<scratch>/gi-stock.test.mjs"`

- [ ] **Step 3: Implement** — in `lib/goods-in.ts`, add right after the `PART_CATEGORY_CHIPS` definition:

```ts
export function isStockPart(partNumber: string): boolean {
  return partCategory(partNumber) !== "other";
}

// Goods In only receives stock (1/2/3/4) — the "Other" chip is dropped from its filter.
export const GOODS_IN_PART_CHIPS = PART_CATEGORY_CHIPS.filter(c => c.key !== "other");
```

Then in `buildGoodsInTasks`, change the `pos.map(...)` to filter first. The current line is `const tasks = pos.map((p): GoodsInTask => {`. Replace it with:

```ts
  const tasks = pos.filter(p => isStockPart(p.partNumber)).map((p): GoodsInTask => {
```

- [ ] **Step 4: Run — expect `10 passed, 0 failed`:**

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && node "<scratch>/gi-stock.test.mjs"`

- [ ] **Step 5: Commit:**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
git add lib/goods-in.ts && git commit -m "feat(goods-in): stock-only filter (1/2/3/4) + Goods-In chip list"
```

---

### Task 2: PO grouping builder (pure)

**Files:**
- Modify: `lib/goods-in.ts`
- Test: `<scratch>/gi-po.test.mjs`

**Interfaces produced:**
- `GoodsInLine { partNumber, description, partType, quantity: number|null, dueDate, dueISO, urgency: Urgency, record: GoodsInRecord|null }`
- `GoodsInPoStatus = "awaiting" | "partial" | "filed"`
- `GoodsInPoTask { po, supplier, lines: GoodsInLine[], totalCount, filedCount, status: GoodsInPoStatus, dueDate, dueISO, urgency }`
- `buildGoodsInPoTasks(pos, records, today?): GoodsInPoTask[]` — groups stock lines by PO; `record` = the active (non-Void) record for that PO+part; status from filedCount; urgency/dueDate from the earliest UNFILED line; sorted awaiting→partial→filed then urgency then due.
- `summarisePo(tasks): { total, awaiting, partial, filed, dueToday, overdue }`

- [ ] **Step 1: Failing test** — create `<scratch>/gi-po.test.mjs`:

```js
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "/Users/utkarshrawat/Wild Dash/wild-dash/node_modules/typescript/lib/typescript.js";
const SRC = "/Users/utkarshrawat/Wild Dash/wild-dash/lib/goods-in.ts";
const OUT = new URL("./gi.compiled-po.mjs", import.meta.url);
writeFileSync(OUT, ts.transpileModule(readFileSync(SRC,"utf8"), { compilerOptions:{ module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2019 } }).outputText);
const m = await import(pathToFileURL(OUT.pathname).href);
let pass=0, fail=0; const eq=(g,w,msg)=>{ if(g===w)pass++; else {fail++; console.error(`FAIL ${msg}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`);} };

const pos = [
  { order:"PO1", partNumber:"20000001", description:"rm1", partType:"", vendorName:"Sup", orderQuantity:5, dueDate:"05/08/2026" },
  { order:"PO1", partNumber:"20000002", description:"rm2", partType:"", vendorName:"Sup", orderQuantity:3, dueDate:"01/08/2026" },
  { order:"PO1", partNumber:"ZZ.FREIGHT", description:"freight", partType:"", vendorName:"Sup", orderQuantity:1, dueDate:"01/08/2026" },
  { order:"PO2", partNumber:"30000009", description:"fg", partType:"", vendorName:"Sup2", orderQuantity:9, dueDate:"10/08/2026" },
];
// one line of PO1 already filed
const records = [{ timestamp:"2026-07-01T00:00:00Z", po:"PO1", partNumber:"20000001", description:"rm1", quantity:"5", supplier:"Sup", supplierProductCode:"X", batchLot:"B1", bbd:"", haulier:"", date:"", time:"", cofaReceived:"", comments:"", coaUrl:"", docUrls:[], status:"Booked in", recordId:"PO1-20000001-1" }];
const tasks = m.buildGoodsInPoTasks(pos, records, new Date("2026-07-23"));
eq(tasks.length, 2, "two PO groups");
const po1 = tasks.find(t=>t.po==="PO1");
eq(po1.totalCount, 2, "PO1 has 2 stock lines (freight excluded)");
eq(po1.filedCount, 1, "PO1 one filed");
eq(po1.status, "partial", "PO1 partial");
eq(po1.dueISO, "2026-08-01", "PO1 urgency from earliest UNFILED line (20000002)");
const filedLine = po1.lines.find(l=>l.partNumber==="20000001");
eq(!!filedLine.record, true, "filed line carries its record");
eq(po1.lines.find(l=>l.partNumber==="20000002").record, null, "unfiled line has null record");
const po2 = tasks.find(t=>t.po==="PO2");
eq(po2.status, "awaiting", "PO2 awaiting");
// sort: partial(PO1) before awaiting? no — awaiting(0) before partial(1). PO2 awaiting first.
eq(tasks[0].po, "PO2", "awaiting sorts before partial");
const s = m.summarisePo(tasks);
eq(s.total, 2, "summary total"); eq(s.awaiting, 1, "summary awaiting"); eq(s.partial, 1, "summary partial");
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
```

- [ ] **Step 2: Run — expect FAIL** (`buildGoodsInPoTasks is not a function`).

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && node "<scratch>/gi-po.test.mjs"`

- [ ] **Step 3: Implement** — in `lib/goods-in.ts`, add after `buildGoodsInTasks` (and its types near the top). Add the interfaces after `GoodsInTask`:

```ts
export interface GoodsInLine {
  partNumber: string;
  description: string;
  partType: string;
  quantity: number | null;
  dueDate: string;
  dueISO: string;
  urgency: Urgency;
  record: GoodsInRecord | null;
}
export type GoodsInPoStatus = "awaiting" | "partial" | "filed";
export interface GoodsInPoTask {
  po: string;
  supplier: string;
  lines: GoodsInLine[];
  totalCount: number;
  filedCount: number;
  status: GoodsInPoStatus;
  dueDate: string;   // earliest UNFILED line due (DD/MM/YYYY), or ""
  dueISO: string;
  urgency: Urgency;
}
```

And add the builder + summary (place after `buildGoodsInTasks`):

```ts
// Group open stock PO lines by PO for the multi-line "file the whole PO" form.
export function buildGoodsInPoTasks(pos: BulkPoRow[], records: GoodsInRecord[], today = new Date()): GoodsInPoTask[] {
  const t0 = new Date(today); t0.setHours(0, 0, 0, 0);
  const urgencyOf = (due: Date | null): Urgency => {
    if (!due) return "none";
    const days = Math.round((due.getTime() - t0.getTime()) / 86400000);
    if (days < 0) return "overdue";
    if (days === 0) return "today";
    if (days <= 7) return "soon";
    return "later";
  };
  const rank: Record<Urgency, number> = { overdue: 0, today: 1, soon: 2, later: 3, none: 4 };
  const recByKey = new Map<string, GoodsInRecord>();
  for (const r of records) recByKey.set(`${r.po} ${r.partNumber}`, r);

  const groups = new Map<string, { supplier: string; lines: GoodsInLine[] }>();
  for (const p of pos) {
    if (!isStockPart(p.partNumber)) continue;
    const due = parseDMY(p.dueDate);
    const line: GoodsInLine = {
      partNumber: p.partNumber, description: p.description, partType: p.partType,
      quantity: p.orderQuantity, dueDate: p.dueDate, dueISO: due ? toISO(due) : "",
      urgency: urgencyOf(due), record: recByKey.get(`${p.order} ${p.partNumber}`) ?? null,
    };
    const g = groups.get(p.order);
    if (g) g.lines.push(line);
    else groups.set(p.order, { supplier: p.vendorName, lines: [line] });
  }

  const tasks: GoodsInPoTask[] = Array.from(groups.entries()).map(([po, g]) => {
    const total = g.lines.length;
    const filedCount = g.lines.filter(l => l.record).length;
    const status: GoodsInPoStatus = filedCount === 0 ? "awaiting" : filedCount === total ? "filed" : "partial";
    const pool = g.lines.filter(l => !l.record);
    const src = pool.length ? pool : g.lines;
    let earliest: GoodsInLine | null = null;
    for (const l of src) {
      if (!l.dueISO) continue;
      if (!earliest || (earliest.dueISO && l.dueISO < earliest.dueISO)) earliest = l;
    }
    if (!earliest) earliest = src[0];
    return {
      po, supplier: g.supplier, lines: g.lines, totalCount: total, filedCount, status,
      dueDate: earliest?.dueDate ?? "", dueISO: earliest?.dueISO ?? "", urgency: earliest?.urgency ?? "none",
    };
  });

  const statusRank: Record<GoodsInPoStatus, number> = { awaiting: 0, partial: 1, filed: 2 };
  return tasks.sort((a, b) => {
    if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status];
    if (rank[a.urgency] !== rank[b.urgency]) return rank[a.urgency] - rank[b.urgency];
    return (a.dueISO || "9999").localeCompare(b.dueISO || "9999");
  });
}

export function summarisePo(tasks: GoodsInPoTask[]) {
  return {
    total: tasks.length,
    awaiting: tasks.filter(t => t.status === "awaiting").length,
    partial: tasks.filter(t => t.status === "partial").length,
    filed: tasks.filter(t => t.status === "filed").length,
    dueToday: tasks.filter(t => t.status !== "filed" && t.urgency === "today").length,
    overdue: tasks.filter(t => t.status !== "filed" && t.urgency === "overdue").length,
  };
}
```

- [ ] **Step 4: Run — expect `10 passed, 0 failed`:**

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && node "<scratch>/gi-po.test.mjs"`

- [ ] **Step 5: Commit:**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
git add lib/goods-in.ts && git commit -m "feat(goods-in): buildGoodsInPoTasks PO grouping + summarisePo"
```

---

### Task 3: Batch line→records mapper (pure)

**Files:**
- Modify: `lib/goods-in.ts`
- Test: `<scratch>/gi-map.test.mjs`

**Interfaces produced:**
- `PoLineInput { partNumber, description, quantity, supplier, supplierProductCode, batchLot, bbd, existing: boolean, recordId?, timestamp? }`
- `poLinesToRecords({ po, lines: PoLineInput[], coaUrl, docUrls, now? }): { record: GoodsInRecord; isEdit: boolean; fallbackKey: string }[]` — one entry per line. `isEdit = line.existing`. New lines get a unique generated `recordId` and `timestamp=now`; existing lines keep their `recordId` (or "" → generated) and their `timestamp` (fallback now). `fallbackKey = \`${po} ${partNumber} ${timestamp}\``. Shared `coaUrl`/`docUrls` copied onto every record.

- [ ] **Step 1: Failing test** — create `<scratch>/gi-map.test.mjs`:

```js
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "/Users/utkarshrawat/Wild Dash/wild-dash/node_modules/typescript/lib/typescript.js";
const SRC = "/Users/utkarshrawat/Wild Dash/wild-dash/lib/goods-in.ts";
const OUT = new URL("./gi.compiled-map.mjs", import.meta.url);
writeFileSync(OUT, ts.transpileModule(readFileSync(SRC,"utf8"), { compilerOptions:{ module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2019 } }).outputText);
const m = await import(pathToFileURL(OUT.pathname).href);
let pass=0, fail=0; const eq=(g,w,msg)=>{ if(g===w)pass++; else {fail++; console.error(`FAIL ${msg}: got ${JSON.stringify(g)} want ${JSON.stringify(w)}`);} };
const out = m.poLinesToRecords({
  po:"PO9", coaUrl:"C", docUrls:["D1"], now:"2026-07-23T00:00:00Z",
  lines:[
    { partNumber:"20000001", description:"a", quantity:"5", supplier:"S", supplierProductCode:"P1", batchLot:"B1", bbd:"", existing:true, recordId:"PO9-20000001-old", timestamp:"2026-07-01T00:00:00Z" },
    { partNumber:"20000002", description:"b", quantity:"3", supplier:"S", supplierProductCode:"P2", batchLot:"B2", bbd:"", existing:true, recordId:"", timestamp:"2026-06-15T00:00:00Z" },
    { partNumber:"30000003", description:"c", quantity:"1", supplier:"S", supplierProductCode:"P3", batchLot:"B3", bbd:"", existing:false },
  ],
});
eq(out.length, 3, "3 records");
eq(out[0].isEdit, true, "line0 edit");
eq(out[0].record.recordId, "PO9-20000001-old", "line0 keeps recordId");
eq(out[0].record.timestamp, "2026-07-01T00:00:00Z", "line0 keeps timestamp");
eq(out[0].fallbackKey, "PO9 20000001 2026-07-01T00:00:00Z", "line0 fallbackKey");
eq(out[1].isEdit, true, "line1 edit (legacy blank id)");
eq(out[1].record.recordId.startsWith("PO9-20000002-"), true, "line1 gains generated recordId");
eq(out[1].record.timestamp, "2026-06-15T00:00:00Z", "line1 keeps original timestamp");
eq(out[2].isEdit, false, "line2 new");
eq(out[2].record.timestamp, "2026-07-23T00:00:00Z", "line2 timestamp=now");
eq(out[0].record.coaUrl, "C", "shared coa"); eq(out[2].record.docUrls[0], "D1", "shared docs");
eq(out[0].record.status, "Booked in", "status booked in");
// unique recordIds across new lines
const ids = new Set(out.map(o=>o.record.recordId)); eq(ids.size, 3, "unique recordIds");
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
```

- [ ] **Step 2: Run — expect FAIL** (`poLinesToRecords is not a function`).

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && node "<scratch>/gi-map.test.mjs"`

- [ ] **Step 3: Implement** — in `lib/goods-in.ts`, add (near the other exports):

```ts
export interface PoLineInput {
  partNumber: string; description: string; quantity: string; supplier: string;
  supplierProductCode: string; batchLot: string; bbd: string;
  existing: boolean; recordId?: string; timestamp?: string;
}

// Map submitted PO lines → records to write, flagged create vs update-in-place.
export function poLinesToRecords(input: {
  po: string; lines: PoLineInput[]; coaUrl: string; docUrls: string[]; now?: string;
}): { record: GoodsInRecord; isEdit: boolean; fallbackKey: string }[] {
  const now = input.now ?? new Date().toISOString();
  return input.lines.map((l, i) => {
    const timestamp = l.existing ? (l.timestamp || now) : now;
    const recordId = l.recordId && l.recordId.trim()
      ? l.recordId.trim()
      : `${input.po}-${l.partNumber}-${Date.now()}-${i}`;
    const record: GoodsInRecord = {
      timestamp, po: input.po, partNumber: l.partNumber, description: l.description,
      quantity: l.quantity, supplier: l.supplier, supplierProductCode: l.supplierProductCode,
      batchLot: l.batchLot, bbd: l.bbd, haulier: "", date: "", time: "", cofaReceived: "",
      comments: "", coaUrl: input.coaUrl, docUrls: input.docUrls, status: "Booked in", recordId,
    };
    return { record, isEdit: l.existing, fallbackKey: `${input.po} ${l.partNumber} ${timestamp}` };
  });
}
```

- [ ] **Step 4: Run — expect `13 passed, 0 failed`:**

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && node "<scratch>/gi-map.test.mjs"`

- [ ] **Step 5: Commit:**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
git add lib/goods-in.ts && git commit -m "feat(goods-in): poLinesToRecords batch mapper"
```

---

### Task 4: Combined QA13-CF01 Word doc (products table)

**Files:**
- Modify: `lib/goods-in-doc.ts`
- Test: `<scratch>/gi-doc.test.mjs`

**Interfaces produced:**
- `buildGoodsInPoDoc(input: { po: string; supplier: string; lines: { partNumber: string; description: string; quantity: string; supplierProductCode: string; batchLot: string; bbd: string }[] }): Promise<Buffer>` — one QA13-CF01 for the PO with a products table + the same checklist/sign sections as the single doc.
- `poDocFilename(po: string): string` → `GoodsIn-<po>-all.docx`.

- [ ] **Step 1: READ `lib/goods-in-doc.ts` fully** to learn the helpers (`run`, `para`, `table`, `cell`, `bar`, `checklist`, constants `CW`, `pct`, `TB`, `emptyLines`) and the exact section order of `buildGoodsInDoc` (header block → core-fields table → inbound checks → Vehicle/Pallet/Certification checklists → FINISHED GOODS QC → Comments → SIGN/COMPLIANCE SIGN).

- [ ] **Step 2: Failing test** — create `<scratch>/gi-doc.test.mjs` (asserts a valid, non-trivial .docx is produced for a multi-line PO):

```js
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "/Users/utkarshrawat/Wild Dash/wild-dash/node_modules/typescript/lib/typescript.js";
// Transpile the doc module + its type-only dep is erased; docx is resolved from node_modules.
const SRC = "/Users/utkarshrawat/Wild Dash/wild-dash/lib/goods-in-doc.ts";
const dir = mkdtempSync(join(tmpdir(), "gidoc-"));
const OUT = join(dir, "doc.mjs");
let js = ts.transpileModule(readFileSync(SRC,"utf8"), { compilerOptions:{ module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2019 } }).outputText;
js = js.replace(/from ["']docx["']/g, 'from "/Users/utkarshrawat/Wild Dash/wild-dash/node_modules/docx/build/index.js"');
writeFileSync(OUT, js);
const m = await import(pathToFileURL(OUT).href);
let pass=0, fail=0; const ok=(c,msg)=>{ if(c)pass++; else {fail++; console.error("FAIL "+msg);} };
const buf = await m.buildGoodsInPoDoc({ po:"PO9", supplier:"Acme", lines:[
  { partNumber:"20000001", description:"RM one", quantity:"5", supplierProductCode:"P1", batchLot:"B1", bbd:"01/01/2028" },
  { partNumber:"30000002", description:"FG two", quantity:"9", supplierProductCode:"P2", batchLot:"B2", bbd:"02/02/2028" },
]});
ok(Buffer.isBuffer(buf), "returns a Buffer");
ok(buf.length > 3000, "non-trivial size ("+buf.length+")");
ok(buf.slice(0,2).toString("latin1") === "PK", "valid .docx (zip PK header)");
ok(m.poDocFilename("PO9") === "GoodsIn-PO9-all.docx", "filename");
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
```

- [ ] **Step 3: Run — expect FAIL** (`buildGoodsInPoDoc is not a function`).

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && node "<scratch>/gi-doc.test.mjs"`

- [ ] **Step 4: Implement** in `lib/goods-in-doc.ts`. Add a new exported `buildGoodsInPoDoc` that mirrors `buildGoodsInDoc` EXACTLY except it replaces the single-product **core-fields table** with a header line (PO + Supplier) and a **products table**, and drops the per-record Batch/BBD/SupplierCode single fields. Keep every other section (inbound checks, the three checklists, FINISHED GOODS QC, Comments, SIGN/COMPLIANCE SIGN) identical to `buildGoodsInDoc`. Use the file's existing `Packer`, `Document`, `table`, `cell`, `bar`, `para`, `run`, `CW`, and section helpers.

The products table (column widths sum to `CW`):

```ts
  const H = (t: string, w: number, align?: (typeof AlignmentType)[keyof typeof AlignmentType]) => cell(w, t, { head: true, align });
  const COLS = [1750, 3216, 900, 1800, 1600, 1400]; // = CW (10666): Part, Description, Qty, Supplier Code, Batch/Lot, BBD
  const productsTable = table(COLS, [
    new TableRow({ children: [
      H("Part", COLS[0]), H("Description", COLS[1]), H("Qty", COLS[2], AlignmentType.RIGHT),
      H("Supplier Product Code", COLS[3]), H("Batch/Lot No.", COLS[4]), H("BBD", COLS[5]),
    ] }),
    ...input.lines.map(l => new TableRow({ children: [
      cell(COLS[0], l.partNumber), cell(COLS[1], l.description),
      cell(COLS[2], l.quantity, { align: AlignmentType.RIGHT }),
      cell(COLS[3], l.supplierProductCode), cell(COLS[4], l.batchLot), cell(COLS[5], l.bbd),
    ] })),
  ]);
```

Compose the document children in this order: the existing top header block (title / QA13-CF01 / date row — copy from `buildGoodsInDoc`, substituting PO=`input.po`, Supplier=`input.supplier`), then a `bar("Products received")`, then `productsTable`, then EVERY remaining section copied verbatim from `buildGoodsInDoc` (inbound checks through SIGN/COMPLIANCE SIGN). Return `await Packer.toBuffer(doc)`.

Also add:

```ts
export function poDocFilename(po: string): string {
  const safe = (s: string) => (s || "").replace(/[^A-Za-z0-9._-]+/g, "-");
  return `GoodsIn-${safe(po) || "PO"}-all.docx`;
}
```

Ensure `AlignmentType`, `TableRow` are already imported in the file (they are used by `buildGoodsInDoc`); reuse the same imports.

- [ ] **Step 5: Run — expect `4 passed, 0 failed`:**

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && node "<scratch>/gi-doc.test.mjs"`

- [ ] **Step 6: Type-check + commit:**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
npx tsc --noEmit
git add lib/goods-in-doc.ts && git commit -m "feat(goods-in): buildGoodsInPoDoc combined QA13-CF01 products table"
```

---

### Task 5: Shared blob-upload helper (refactor existing route)

**Files:**
- Create: `lib/goods-in-upload.ts`
- Modify: `app/api/goods-in/route.ts`

**Interfaces produced:**
- `uploadGoodsInAttachments(form: FormData, po: string): Promise<{ coaUrl: string; docUrls: string[]; warnings: string[] }>` — the exact CofA/docs Vercel-Blob upload logic currently inline in `route.ts`, extracted verbatim (reads form fields `coa` and `docs`, guards on `BLOB_READ_WRITE_TOKEN`, same warning strings).

- [ ] **Step 1: Create `lib/goods-in-upload.ts`:**

```ts
import { put } from "@vercel/blob";

// Upload CofA + documents to Vercel Blob when configured; degrade gracefully otherwise.
// Shared by the single-line and multi-line (PO) Goods In save routes.
export async function uploadGoodsInAttachments(
  form: FormData, po: string,
): Promise<{ coaUrl: string; docUrls: string[]; warnings: string[] }> {
  const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  const warnings: string[] = [];
  const upload = async (file: File): Promise<string> => {
    const safe = `goods-in/${po.replace(/[^A-Za-z0-9._-]+/g, "-")}/${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]+/g, "-")}`;
    const blob = await put(safe, file, { access: "public" });
    return blob.url;
  };

  let coaUrl = "";
  const coaFile = form.get("coa");
  if (coaFile instanceof File && coaFile.size > 0) {
    if (hasBlob) {
      try { coaUrl = await upload(coaFile); } catch { warnings.push("CofA upload failed."); }
    } else warnings.push("File storage not configured — CofA was not uploaded. Enable Vercel Blob to store attachments.");
  }

  const docUrls: string[] = [];
  const docFiles = form.getAll("docs").filter((f): f is File => f instanceof File && f.size > 0);
  for (const f of docFiles) {
    if (hasBlob) {
      try { docUrls.push(await upload(f)); } catch { warnings.push(`Upload failed: ${f.name}`); }
    } else if (!warnings.some(w => w.includes("File storage"))) {
      warnings.push("File storage not configured — documents were not uploaded.");
    }
  }
  return { coaUrl, docUrls, warnings };
}
```

- [ ] **Step 2: Refactor `app/api/goods-in/route.ts`** to use it. Remove the `import { put } from "@vercel/blob";` line and the inline upload block (from `// Upload attachments to Vercel Blob…` through the `docFiles` loop that builds `coaUrl`/`docUrls`/`warnings`). Add the import `import { uploadGoodsInAttachments } from "@/lib/goods-in-upload";` and, at the spot where `po` is known (after `const po = g("po")` and its validation), replace the removed block with:

```ts
  const { coaUrl, docUrls, warnings } = await uploadGoodsInAttachments(form, po);
```

Leave everything else (record build, edit/append, `revalidateTag`) unchanged. `coaUrl`, `docUrls`, `warnings` keep the same names, so downstream code is untouched.

- [ ] **Step 3: Type-check (must be clean) + confirm behaviour unchanged:**

Run: `cd "/Users/utkarshrawat/Wild Dash/wild-dash" && npx tsc --noEmit`
Expected: clean. (The single-line save path is unchanged; it's re-verified in Task 9.)

- [ ] **Step 4: Commit:**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
git add lib/goods-in-upload.ts app/api/goods-in/route.ts
git commit -m "refactor(goods-in): extract shared uploadGoodsInAttachments helper"
```

---

### Task 6: Batch save route + combined-doc route

**Files:**
- Create: `app/api/goods-in/po/route.ts`
- Create: `app/api/goods-in/doc/po/route.ts`

**Interfaces produced:**
- `POST /api/goods-in/po` — multipart: `po`, `supplier`, `password`, `lines` (JSON string = `PoLineInput[]` for ticked lines), optional `coa` + `docs`. Password-gated; uploads attachments once; for each line `updateGoodsInRecord` (if `existing`) else `appendGoodsInRecord`; `revalidateTag("sheets")`; returns `{ ok, records, warnings }`.
- `POST /api/goods-in/doc/po` — JSON `{ po, supplier, lines }` → streams the combined `.docx`.

- [ ] **Step 1: Create `app/api/goods-in/po/route.ts`:**

```ts
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { appendGoodsInRecord, updateGoodsInRecord } from "@/lib/sheets";
import { GOODS_IN_HEADERS, recordToRow, poLinesToRecords, type PoLineInput } from "@/lib/goods-in";
import { uploadGoodsInAttachments } from "@/lib/goods-in-upload";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }

  const g = (k: string) => String(form.get(k) ?? "").trim();
  const expected = process.env.GOODS_IN_PASSWORD ?? process.env.PRODUCTION_REPORT_PASSWORD ?? "12345";
  if (g("password") !== expected) return NextResponse.json({ error: "Incorrect password" }, { status: 401 });

  const po = g("po");
  if (!po) return NextResponse.json({ error: "PO Number is required" }, { status: 400 });

  let lines: PoLineInput[];
  try {
    const parsed = JSON.parse(g("lines") || "[]");
    lines = Array.isArray(parsed) ? parsed : [];
  } catch { return NextResponse.json({ error: "Invalid lines payload" }, { status: 400 }); }
  if (lines.length === 0) return NextResponse.json({ error: "No received lines to file" }, { status: 400 });

  const { coaUrl, docUrls, warnings } = await uploadGoodsInAttachments(form, po);

  try {
    const mapped = poLinesToRecords({ po, lines, coaUrl, docUrls });
    for (const { record, isEdit, fallbackKey } of mapped) {
      if (isEdit) await updateGoodsInRecord(record.recordId, recordToRow(record), fallbackKey);
      else await appendGoodsInRecord(GOODS_IN_HEADERS, recordToRow(record));
    }
    revalidateTag("sheets");
    return NextResponse.json({ ok: true, records: mapped.map(m => m.record), warnings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save records";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/goods-in/doc/po/route.ts`:**

```ts
import { NextRequest, NextResponse } from "next/server";
import { buildGoodsInPoDoc, poDocFilename } from "@/lib/goods-in-doc";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { po?: string; supplier?: string; lines?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const s = (v: unknown) => String(v ?? "");
  const po = s(body.po);
  const supplier = s(body.supplier);
  const lines = Array.isArray(body.lines) ? body.lines.map((l: Record<string, unknown>) => ({
    partNumber: s(l.partNumber), description: s(l.description), quantity: s(l.quantity),
    supplierProductCode: s(l.supplierProductCode), batchLot: s(l.batchLot), bbd: s(l.bbd),
  })) : [];

  const buf = await buildGoodsInPoDoc({ po, supplier, lines });
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${poDocFilename(po)}"`,
    },
  });
}
```

- [ ] **Step 3: Type-check + commit:**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
npx tsc --noEmit
git add app/api/goods-in/po/route.ts app/api/goods-in/doc/po/route.ts
git commit -m "feat(goods-in): batch PO save route + combined-doc route"
```

(Live end-to-end for these routes is exercised in Task 9 against a throwaway PO.)

---

### Task 7: Grouped multi-line form (`components/GoodsInPoForm.tsx`)

**Files:**
- Create: `components/GoodsInPoForm.tsx`

**Interfaces produced:**
- `GoodsInPoForm({ task, onClose }: { task: GoodsInPoTask; onClose: () => void })` — modal listing every line of the PO; a "Received" tick per row (auto-ticks when Batch/Lot typed); pre-filled + ticked for lines with an existing record; one password + optional CofA/docs; **Save & download** posts ticked lines to `/api/goods-in/po` then downloads the combined doc; **Preview** downloads the combined doc from current ticked rows.

- [ ] **Step 1: Create the component:**

```tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { GoodsInPoTask, GoodsInLine } from "@/lib/goods-in";

const inputCls = "w-full rounded-lg border border-[#e4ddd4] px-2 py-1.5 text-sm text-charcoal focus:outline-none focus:border-copper bg-white";
const labelCls = "block text-[11px] tracking-widest uppercase text-text-muted mb-1";
const TH = "px-2 py-2 text-[10px] tracking-widest uppercase text-text-muted font-medium text-left whitespace-nowrap";

type RowState = { received: boolean; supplierProductCode: string; batchLot: string; bbd: string };

export default function GoodsInPoForm({ task, onClose }: { task: GoodsInPoTask; onClose: () => void }) {
  const router = useRouter();
  const [rows, setRows] = useState<RowState[]>(
    task.lines.map(l => ({
      received: !!l.record,
      supplierProductCode: l.record?.supplierProductCode ?? "",
      batchLot: l.record?.batchLot ?? "",
      bbd: l.record?.bbd ?? "",
    })),
  );
  const [password, setPassword] = useState("");
  const coaRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"save" | "doc" | null>(null);
  const [saved, setSaved] = useState<{ warnings: string[]; count: number } | null>(null);
  const [error, setError] = useState("");

  const setRow = (i: number, patch: Partial<RowState>) =>
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const allReceived = rows.every(r => r.received);
  const toggleAll = () => setRows(rs => rs.map(r => ({ ...r, received: !allReceived })));

  const receivedLinePayload = () =>
    task.lines
      .map((l, i) => ({ l, r: rows[i] }))
      .filter(({ r }) => r.received)
      .map(({ l, r }) => ({
        partNumber: l.partNumber, description: l.description,
        quantity: l.quantity != null ? String(l.quantity) : "", supplier: task.supplier,
        supplierProductCode: r.supplierProductCode, batchLot: r.batchLot, bbd: r.bbd,
        existing: !!l.record, recordId: l.record?.recordId ?? "", timestamp: l.record?.timestamp ?? "",
      }));

  async function downloadDoc() {
    const lines = receivedLinePayload();
    const res = await fetch("/api/goods-in/doc/po", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ po: task.po, supplier: task.supplier, lines }),
    });
    if (!res.ok) throw new Error("Failed to generate the Word form");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `GoodsIn-${task.po}-all.docx`; a.click();
    URL.revokeObjectURL(url);
  }

  async function preview() {
    setBusy("doc"); setError("");
    try {
      if (receivedLinePayload().length === 0) { setError("Tick at least one received line first."); return; }
      await downloadDoc();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  async function save() {
    setBusy("save"); setError("");
    try {
      const lines = receivedLinePayload();
      if (lines.length === 0) { setError("Tick at least one received line."); return; }
      const fd = new FormData();
      fd.append("po", task.po);
      fd.append("supplier", task.supplier);
      fd.append("password", password);
      fd.append("lines", JSON.stringify(lines));
      const coa = coaRef.current?.files?.[0];
      if (coa) fd.append("coa", coa);
      for (const d of Array.from(docsRef.current?.files ?? [])) fd.append("docs", d);

      const res = await fetch("/api/goods-in/po", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save."); return; }
      try { await downloadDoc(); } catch { /* saved; can re-download from the list */ }
      setSaved({ warnings: Array.isArray(data.warnings) ? data.warnings : [], count: lines.length });
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl bg-cream border border-[#e4ddd4] shadow-xl my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[#e4ddd4]">
          <div>
            <h2 className="font-serif text-xl text-charcoal">Goods In — PO {task.po}</h2>
            <p className="text-xs text-text-muted mt-1">{task.supplier || "—"} · {task.totalCount} items. Tick each product received and record Supplier Code, Batch/Lot &amp; BBD.</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-charcoal text-xl leading-none">&times;</button>
        </div>

        {saved ? (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center text-2xl">✓</div>
            <p className="font-serif text-lg text-charcoal">{saved.count} product{saved.count === 1 ? "" : "s"} filed &amp; form downloaded</p>
            <p className="text-sm text-text-muted mt-2 max-w-md mx-auto">The combined QA13-CF01 Word file is in your downloads. Filed lines appear under <strong className="text-charcoal">Filed Goods In forms</strong>; unticked lines stay in the awaiting list.</p>
            {saved.warnings.length > 0 && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">{saved.warnings.join(" ")}</p>}
            <div className="mt-6"><button onClick={onClose} className="bg-copper text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-copper-light transition-colors">Done</button></div>
          </div>
        ) : (
          <>
            <div className="px-6 py-4">
              <div className="flex justify-end mb-2">
                <button type="button" onClick={toggleAll} className="text-xs px-3 py-1.5 rounded-full border border-[#e4ddd4] text-text-muted hover:bg-cream">
                  {allReceived ? "Untick all" : "Select all received"}
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[#e4ddd4] bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-cream border-b border-[#e4ddd4]">
                    <tr>
                      <th className={TH}>Recv</th><th className={TH}>Part</th><th className={TH}>Description</th>
                      <th className={`${TH} text-right`}>Qty</th><th className={TH}>Supplier Code</th><th className={TH}>Batch/Lot</th><th className={TH}>BBD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {task.lines.map((l: GoodsInLine, i) => (
                      <tr key={l.partNumber + i} className="border-b border-[#e4ddd4]/60">
                        <td className="px-2 py-1.5 text-center">
                          <input type="checkbox" checked={rows[i].received} onChange={e => setRow(i, { received: e.target.checked })} />
                        </td>
                        <td className="px-2 py-1.5 font-mono text-xs">{l.partNumber}</td>
                        <td className="px-2 py-1.5 text-charcoal max-w-[220px] truncate" title={l.description}>{l.description}</td>
                        <td className="px-2 py-1.5 text-right">{l.quantity != null ? l.quantity.toLocaleString() : "—"}</td>
                        <td className="px-2 py-1.5"><input className={inputCls} value={rows[i].supplierProductCode} onChange={e => setRow(i, { supplierProductCode: e.target.value })} /></td>
                        <td className="px-2 py-1.5"><input className={inputCls} value={rows[i].batchLot}
                          onChange={e => setRow(i, { batchLot: e.target.value, received: e.target.value.trim() ? true : rows[i].received })} placeholder="LOT-…" /></td>
                        <td className="px-2 py-1.5"><input className={inputCls} value={rows[i].bbd} onChange={e => setRow(i, { bbd: e.target.value })} placeholder="DD/MM/YYYY" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                <div><label className={labelCls}>Attach CofA (whole delivery)</label>
                  <input ref={coaRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="w-full text-xs text-text-muted file:mr-3 file:rounded-full file:border-0 file:bg-cream-dark file:px-3 file:py-1.5 file:text-charcoal" /></div>
                <div><label className={labelCls}>Other documents</label>
                  <input ref={docsRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" className="w-full text-xs text-text-muted file:mr-3 file:rounded-full file:border-0 file:bg-cream-dark file:px-3 file:py-1.5 file:text-charcoal" /></div>
              </div>
              <div className="mt-4 max-w-xs"><label className={labelCls}>Password</label>
                <input type="password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} placeholder="Goods In / compliance password" /></div>

              {error && <div className="rounded-xl px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200 mt-4">{error}</div>}
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#e4ddd4]">
              <button onClick={preview} disabled={busy !== null} className="inline-flex items-center gap-1.5 text-sm font-medium text-copper hover:text-copper-light disabled:opacity-50">
                {busy === "doc" ? "Generating…" : "Preview Word form"}
              </button>
              <button onClick={save} disabled={busy !== null} className="bg-copper text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-copper-light transition-colors disabled:opacity-50">
                {busy === "save" ? "Saving…" : "Save & download form"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit:**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
npx tsc --noEmit
git add components/GoodsInPoForm.tsx
git commit -m "feat(goods-in): GoodsInPoForm multi-line grouped receiving form"
```

---

### Task 8: View refactor to PO groups + page wiring

**Files:**
- Modify: `app/goods-in/page.tsx`
- Modify: `components/GoodsInView.tsx`

**Interfaces consumed:** `buildGoodsInPoTasks`, `summarisePo`, `GOODS_IN_PART_CHIPS`, `partCategory`, `GoodsInPoTask`, `GoodsInTask`, `GoodsInPoForm`, existing `GoodsInForm`.

- [ ] **Step 1: `app/goods-in/page.tsx`** — build PO tasks and pass them. Replace the imports + data block:

```tsx
import { fetchBulkOpenPOs, fetchGoodsInRows } from "@/lib/sheets";
import { buildGoodsInPoTasks, parseGoodsInRecords } from "@/lib/goods-in";
import GoodsInView from "@/components/GoodsInView";

export const revalidate = 60;

export default async function GoodsInPage() {
  const [pos, rows] = await Promise.all([fetchBulkOpenPOs(), fetchGoodsInRows()]);
  const records = parseGoodsInRecords(rows);
  const poTasks = buildGoodsInPoTasks(pos, records);

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-medium text-charcoal tracking-wide">Goods In</h1>
        <p className="text-text-muted text-sm mt-2 tracking-wide">
          Today&rsquo;s incoming deliveries, grouped by purchase order (stock items only). Open a PO to record supplier code, batch/lot &amp; BBD for each product and download the QA13-CF01 Word form. Filed forms appear below.
        </p>
      </div>
      <GoodsInView poTasks={poTasks} records={records} />
    </div>
  );
}
```

- [ ] **Step 2: Replace `components/GoodsInView.tsx` entirely** with the PO-grouped version below. It: shows one row per PO with an "X of N filed" badge + status; routes clicks to `GoodsInForm` (single-line PO) or `GoodsInPoForm` (multi-line); uses `GOODS_IN_PART_CHIPS` (no "Other"); adds `partial` to the status filter; groups filed records by PO with a "Word (all)" download; keeps per-line Delete (Void).

```tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { GoodsInTask, GoodsInRecord, GoodsInPoTask, Urgency, PartCategory, GoodsInPoStatus } from "@/lib/goods-in";
import { summarisePo, partCategory, GOODS_IN_PART_CHIPS } from "@/lib/goods-in";
import CountUp from "./CountUp";
import GoodsInForm from "./GoodsInForm";
import GoodsInPoForm from "./GoodsInPoForm";

const URGENCY: Record<Urgency, { label: string; cls: string }> = {
  overdue: { label: "Overdue", cls: "bg-red-100 text-red-700" },
  today: { label: "Due today", cls: "bg-amber-100 text-amber-700" },
  soon: { label: "This week", cls: "bg-[#fdf3ee] text-copper" },
  later: { label: "Upcoming", cls: "bg-cream-dark text-text-muted" },
  none: { label: "No date", cls: "bg-cream-dark text-text-muted" },
};
const PO_STATUS: Record<GoodsInPoStatus, { label: string; cls: string }> = {
  awaiting: { label: "Awaiting", cls: "bg-cream-dark text-text-muted" },
  partial: { label: "Partial", cls: "bg-amber-100 text-amber-700" },
  filed: { label: "Filed", cls: "bg-emerald-100 text-emerald-700" },
};

const TH = "px-4 py-3 text-[10px] tracking-widest uppercase text-text-muted font-medium text-left whitespace-nowrap";
const TD = "px-4 py-3 whitespace-nowrap";

function Kpi({ label, value, color, sub }: { label: string; value: number; color?: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e4ddd4] px-5 py-4">
      <p className="text-[10px] tracking-widest uppercase text-text-muted mb-1">{label}</p>
      <p className={`text-2xl font-serif font-medium ${color ?? "text-charcoal"}`}><CountUp value={value} /></p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

function PartChips({ value, onChange }: { value: PartCategory | "all"; onChange: (v: PartCategory | "all") => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {GOODS_IN_PART_CHIPS.map(c => (
        <button key={c.key} type="button" onClick={() => onChange(c.key)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${value === c.key ? "bg-charcoal text-white border-charcoal" : "border-[#e4ddd4] text-text-muted hover:bg-cream"}`}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

// Reconstruct a single-line GoodsInTask so a 1-line PO reuses the existing simple modal.
function toSingleTask(po: GoodsInPoTask): { task: GoodsInTask; record: GoodsInRecord | null } {
  const l = po.lines[0];
  return {
    task: {
      po: po.po, partNumber: l.partNumber, description: l.description, partType: l.partType,
      supplier: po.supplier, quantity: l.quantity, dueDate: l.dueDate, dueISO: l.dueISO,
      status: l.record ? "booked_in" : "awaiting", urgency: l.urgency,
    },
    record: l.record,
  };
}

async function downloadGrn(rec: GoodsInRecord) {
  const res = await fetch("/api/goods-in/doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rec) });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `GoodsIn-${rec.po}-${rec.partNumber}.docx`; a.click();
  URL.revokeObjectURL(url);
}
async function downloadPoGrn(po: string, supplier: string, recs: GoodsInRecord[]) {
  const lines = recs.map(r => ({ partNumber: r.partNumber, description: r.description, quantity: r.quantity, supplierProductCode: r.supplierProductCode, batchLot: r.batchLot, bbd: r.bbd }));
  const res = await fetch("/api/goods-in/doc/po", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ po, supplier, lines }) });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `GoodsIn-${po}-all.docx`; a.click();
  URL.revokeObjectURL(url);
}

export default function GoodsInView({ poTasks, records }: { poTasks: GoodsInPoTask[]; records: GoodsInRecord[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "awaiting" | "partial" | "filed">("awaiting");
  const [tasksPart, setTasksPart] = useState<PartCategory | "all">("all");
  const [recordsPart, setRecordsPart] = useState<PartCategory | "all">("all");
  const [singleActive, setSingleActive] = useState<{ task: GoodsInTask; record: GoodsInRecord | null } | null>(null);
  const [poActive, setPoActive] = useState<GoodsInPoTask | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const s = summarisePo(poTasks);

  const shown = useMemo(
    () => poTasks.filter(t =>
      (filter === "all" || t.status === filter) &&
      (tasksPart === "all" || t.lines.some(l => partCategory(l.partNumber) === tasksPart))),
    [poTasks, filter, tasksPart],
  );

  // Filed records grouped by PO (active, non-void), part-filtered.
  const recordGroups = useMemo(() => {
    const filtered = records.filter(r => recordsPart === "all" || partCategory(r.partNumber) === recordsPart);
    const map = new Map<string, GoodsInRecord[]>();
    for (const r of filtered) { const a = map.get(r.po); if (a) a.push(r); else map.set(r.po, [r]); }
    return Array.from(map.entries());
  }, [records, recordsPart]);

  function openPo(t: GoodsInPoTask) {
    if (t.totalCount === 1) setSingleActive(toSingleTask(t));
    else setPoActive(t);
  }

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
    } catch { window.alert("Network error — please try again."); }
    finally { setDeleting(null); }
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Kpi label="Awaiting" value={s.awaiting} color="text-copper" sub="POs to file" />
        <Kpi label="Partial" value={s.partial} color={s.partial > 0 ? "text-amber-600" : undefined} sub="part-filed" />
        <Kpi label="Overdue" value={s.overdue} color={s.overdue > 0 ? "text-red-600" : undefined} />
        <Kpi label="Filed" value={s.filed} color="text-emerald-600" sub="POs complete" />
      </div>

      {/* PO tasks */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-serif text-lg font-medium text-charcoal">Goods In by PO</h2>
          <div className="flex gap-1.5">
            {(["awaiting", "partial", "filed", "all"] as const).map(f => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === f ? "bg-copper text-white border-copper" : "border-[#e4ddd4] text-text-muted hover:bg-cream"}`}>
                {f === "awaiting" ? "Awaiting" : f === "partial" ? "Partial" : f === "filed" ? "Filed" : "All"}
              </button>
            ))}
          </div>
        </div>
        <PartChips value={tasksPart} onChange={setTasksPart} />
      </div>

      <div className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden mb-10">
        {shown.length === 0 ? (
          <p className="px-5 py-12 text-center text-text-muted text-sm">
            {poTasks.length === 0 ? "No open purchase orders." : "Nothing matches this filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream border-b border-[#e4ddd4]">
                <tr>
                  <th className={TH}>PO</th><th className={TH}>Supplier</th><th className={`${TH} text-right`}>Items</th>
                  <th className={TH}>Progress</th><th className={TH}>Earliest due</th><th className={`${TH} text-right`}></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(t => {
                  const u = URGENCY[t.urgency];
                  const ps = PO_STATUS[t.status];
                  return (
                    <tr key={t.po} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                      <td className={`${TD} font-mono text-xs text-copper`}>{t.po}</td>
                      <td className="px-4 py-3 text-text-muted max-w-[200px] truncate" title={t.supplier}>{t.supplier || "—"}</td>
                      <td className={`${TD} text-right`}>{t.totalCount}</td>
                      <td className={TD}>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${ps.cls}`}>{ps.label}</span>
                        <span className="ml-2 text-xs text-text-muted">{t.filedCount} of {t.totalCount} filed</span>
                      </td>
                      <td className={TD}>
                        <span className="text-charcoal">{t.dueDate || "—"}</span>
                        {t.status !== "filed" && <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${u.cls}`}>{u.label}</span>}
                      </td>
                      <td className={`${TD} text-right`}>
                        <button onClick={() => openPo(t)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${t.status === "filed" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-copper text-white hover:bg-copper-light"}`}>
                          {t.status === "filed" ? "Review →" : t.status === "partial" ? "Continue →" : "Open PO →"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Filed records, grouped by PO */}
      <div className="mb-3 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-lg font-medium text-charcoal">Filed Goods In forms</h2>
          <p className="text-text-muted text-xs mt-0.5">Batch &amp; BBD captured for warehouse verification. Download the combined Word form per PO.</p>
        </div>
        <PartChips value={recordsPart} onChange={setRecordsPart} />
      </div>
      <div className="space-y-4">
        {recordGroups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#e4ddd4] px-5 py-12 text-center text-text-muted text-sm">
            {records.length === 0 ? "No forms filed yet. Open a PO above and save it to create one." : "No filed forms match this filter."}
          </div>
        ) : recordGroups.map(([po, recs]) => (
          <div key={po} className="bg-white rounded-2xl border border-[#e4ddd4] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-cream border-b border-[#e4ddd4]">
              <div className="text-sm"><span className="font-mono text-copper">{po}</span><span className="text-text-muted"> · {recs.length} filed</span></div>
              <button onClick={() => downloadPoGrn(po, recs[0]?.supplier ?? "", recs)} className="text-copper hover:text-copper-light text-xs font-medium inline-flex items-center gap-1">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                Word (all)
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream border-b border-[#e4ddd4]">
                  <tr>
                    <th className={TH}>Part</th><th className={TH}>Batch/Lot</th><th className={TH}>BBD</th><th className={TH}>Supplier Code</th>
                    <th className={TH}>CofA</th><th className={TH}>Docs</th><th className={`${TH} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recs.map((r, i) => (
                    <tr key={r.partNumber + r.timestamp + i} className="border-b border-[#e4ddd4]/60 hover:bg-cream transition-colors">
                      <td className={`${TD} font-mono text-xs`}>{r.partNumber}</td>
                      <td className={`${TD} font-mono text-xs`}>{r.batchLot || "—"}</td>
                      <td className={TD}>{r.bbd || "—"}</td>
                      <td className={`${TD} font-mono text-xs`}>{r.supplierProductCode || "—"}</td>
                      <td className={TD}>{r.coaUrl ? <a href={r.coaUrl} target="_blank" rel="noopener noreferrer" className="text-copper hover:underline">CofA ↗</a> : <span className="text-text-muted">—</span>}</td>
                      <td className={TD}>{r.docUrls.length ? r.docUrls.map((u, j) => <a key={j} href={u} target="_blank" rel="noopener noreferrer" className="text-copper hover:underline mr-2">#{j + 1}</a>) : <span className="text-text-muted">—</span>}</td>
                      <td className={`${TD} text-right`}>
                        <div className="inline-flex items-center gap-3">
                          <button onClick={() => downloadGrn(r)} className="text-copper hover:text-copper-light text-xs font-medium">Word</button>
                          <button onClick={() => del(r)} disabled={deleting !== null} className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-40">
                            {deleting === (r.recordId || `${r.po} ${r.partNumber} ${r.timestamp}`) ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {singleActive && <GoodsInForm task={singleActive.task} record={singleActive.record ?? undefined} onClose={() => setSingleActive(null)} />}
      {poActive && <GoodsInPoForm task={poActive} onClose={() => setPoActive(null)} />}
    </div>
  );
}
```

- [ ] **Step 3: Type-check + commit:**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
npx tsc --noEmit
git add app/goods-in/page.tsx components/GoodsInView.tsx
git commit -m "feat(goods-in): PO-grouped tasks/filed view + single/multi form routing"
```

---

### Task 9: Live end-to-end, browser verification & deploy

**Files:** none (verification + deploy). `<scratch>` = the scratchpad dir.

- [ ] **Step 1: Live batch round-trip against a THROWAWAY PO** (never `PO2600151`). Start the dev server (Browser pane `preview_start { name: "wild-dash" }`). Create `<scratch>/po-e2e.mjs`: seed a fake PO's records via the API is not possible (POs come from the Open POs sheet), so test the SAVE路由 directly — POST `/api/goods-in/po` with `po="ZZ-PO-<ts>"`, three lines, two marked received (one `existing:false`) → assert 2 rows appended to the `Goods In` tab with those parts + "Booked in"; then POST again with one of them `existing:true` (recordId from the first response) + batch changed + the third line newly received → assert the edited row updated **in place** (no duplicate) and the third appended; then void all test rows and hard-delete them from the sheet (reuse the googleapis cleanup pattern from earlier E2E scripts). Print PASS/FAIL. Run with `node --env-file=.env.local`.

- [ ] **Step 2: Browser** (`http://localhost:3000/goods-in`, set cookies `marketMode=dtc; marketsConfigured=1`, viewport 1280×900):
  - Tasks list shows **one row per PO**; `PO2600151` shows `26 items` (or current count) with an "Awaiting/Partial" badge and "X of N filed". No `ZZ…`/5-code rows anywhere; the part-chip row has **no "Other"**.
  - Click a **multi-line** PO → `GoodsInPoForm` opens with **all its stock lines auto-populated** (Part/Desc/Qty). Type a Batch/Lot on two rows → those rows auto-tick. Save with password `12345` → success panel; combined `.docx` downloads. Confirm (via a fresh sheet read or reload after ~cache) those two lines became filed and the PO row shows "2 of N filed" / Partial.
  - Reopen the same PO (Continue →) → the two filed lines are **pre-filled and ticked**; edit one batch, save → no duplicate row (verify against the sheet).
  - Click a **single-line** PO → the original `GoodsInForm` modal opens (unchanged).
  - Filed list is **grouped by PO** with a **"Word (all)"** download; per-line **Delete** returns that line to awaiting (thanks to the cache-bust).
  - Open the downloaded combined `.docx` (`qlmanage -t -s 1100 -o <scratch> <file>.docx` or render) → it is a valid QA13-CF01 with the **products table** listing the filed lines and the QC/sign sections once.
  - Clean up any `ZZ-*` test rows from the sheet.

- [ ] **Step 3: Screenshot** the grouped tasks list + an open multi-line form for the user (`computer {action:"screenshot"}`).

- [ ] **Step 4: Deploy:**

```bash
cd "/Users/utkarshrawat/Wild Dash/wild-dash"
git push origin main
```

Confirm the Vercel build is Ready (`npx vercel ls skudashboard`), smoke-test `https://skudashboard.vercel.app/goods-in`.

- [ ] **Step 5: Docs** — append to `CONTEXT.md` §6i and `WILDDASHHANDOFF.md`: multi-line PO grouping, stock-only (1/2/3/4) filter + "Other" chip removed, `GoodsInPoForm`, `/api/goods-in/po` + `/api/goods-in/doc/po`, `buildGoodsInPoDoc`, combined "Word (all)". Commit + push.

---

## Self-Review

**Spec coverage:**
- §3.5 stock-only + Other chip removed → Task 1 (filter/chips) + Task 8 (view uses `GOODS_IN_PART_CHIPS`) ✅
- §3.1 group by PO → Task 2 (`buildGoodsInPoTasks`) + Task 8 (rows) ✅
- §3.4 keep both forms, route by line count → Task 8 (`openPo`/`toSingleTask`) ✅
- §3.2 partial deliveries (received tick, auto-tick on batch, X of N) → Task 7 (form) + Task 2 (status) + Task 8 (progress) ✅
- §7 batch save (create/update-in-place per line, revalidateTag) → Task 3 (mapper) + Task 6 (route) ✅
- §3.3/§9 combined QA13-CF01 products table + doc route + Word(all) → Task 4 + Task 6 + Task 8 ✅
- §8 attachments per delivery, graceful degrade → Task 5 (shared helper) + Task 6 ✅
- §12 testing (pure offline, live throwaway, browser, avoid real record) → Tasks 1–4, 9 ✅

**Placeholder scan:** none — all steps carry full code (the one "copy verbatim from buildGoodsInDoc" in Task 4 is a deliberate, bounded instruction after reading the file, not a vague TODO). ✅

**Type consistency:** `GoodsInPoTask`/`GoodsInLine`/`GoodsInPoStatus` defined in Task 2, consumed identically in Tasks 7–8; `PoLineInput` + `poLinesToRecords` signatures match between Task 3 (def) and Task 6 (call); `buildGoodsInPoDoc`/`poDocFilename` match between Task 4 (def) and Task 6/8 (calls); `uploadGoodsInAttachments` matches between Task 5 (def) and Tasks 5/6 (calls); view prop changes to `{ poTasks, records }` in Task 8 match the page in Task 8 Step 1. ✅
