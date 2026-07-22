# Goods In — Edit, Void, and Part-Code Filters — Design

> Date: 2026-07-22 · Feature area: `/goods-in`
> Approved by user in brainstorming. Pairs with `CONTEXT.md` §6i and `WILDDASHHANDOFF.md` §1e/§4b.

## 1. Problem

The Goods In receiving section (`/goods-in`) turns open POs into "G-In form" tasks; filing
one writes a QA13-CF01 record to the `Goods In` sheet tab and generates a Word doc. Two gaps:

1. **No real edit.** The "Filed · reopen" button reopens the *blank* create form. Because the
   sheet is append-only (`appendGoodsInRecord`), re-saving a filed PO line appends a **duplicate**
   row with the same `PO + part`. There is no way to correct a filed record, and no way to remove
   one so the PO can be re-done.
2. **No part-code filter.** Both the tasks list and the filed-records list show all part types
   mixed together. The user wants to narrow by Wild Nutrition part code: 1=Bulk, 2=RMs,
   3=Finished Goods, 4=Ancillaries, and everything else as "Other".

## 2. Scope

**In scope**
- Part-code filter on **both** lists (tasks + filed records), derived from the leading digit of
  the part number.
- **Edit** a filed record in place (pre-filled form → updates the same sheet row, no duplicate).
- **Delete = Void** a filed record (audit-preserving soft delete) which returns the PO line to
  awaiting "G-In form" status.

**Out of scope** (explicitly deferred by the user)
- Editing the auto-filled PO-derived fields (received Quantity, Description, Supplier).
- In-app capture of Haulier / Date / Time / CofA-received / Comments (these stay blank on the
  sheet and live only on the Word doc for the warehouse).
- Separate add/remove attachment management (edit retains existing attachments; uploading a new
  file on edit adds/replaces as it does today).

## 3. Data model changes (`Goods In` sheet tab)

The tab currently has 17 columns A–Q (`GOODS_IN_HEADERS`), read back `A2:Q2000`.

- **Add column R "Record ID"** → `GOODS_IN_HEADERS` becomes 18 columns; reads become `A2:R2000`.
  The header extends **non-destructively** — `appendGoodsInRecord` already upserts/extends the
  header row on write, and the same upsert path is reused by the update/void writers.
- **`Status` (col Q)** gains a second value: `"Booked in"` (active) and `"Void"` (deleted).
- **Record ID generation:** new records get a generated id, e.g. `${po}-${part}-${Date.now()}`
  (stable, unique, human-legible). The one existing **legacy** row (`PO2600151` / `20000022`,
  no Record ID) is matched by fallback key `PO + part + timestamp` when it needs targeting.

No other tab or spreadsheet changes. `PRODUCTION_REPORTS_SHEET_ID` unchanged.

## 4. Part-code filter

New pure helper in `lib/goods-in.ts`:

```
export type PartCategory = "bulk" | "rm" | "fg" | "ancillary" | "other";
export function partCategory(partNumber: string): PartCategory
```

Maps the **first character** of the trimmed part number: `1→bulk`, `2→rm`, `3→fg`, `4→ancillary`,
anything else (other digit, blank, non-numeric) → `other`. This intentionally ignores the
free-text `partType` column (`BulkPoRow.partType` = sheet col H), which does not reliably follow
the code convention.

A shared chip-label list is exported for the UI:
`All · Bulk · RMs · Finished Goods · Ancillaries · Other`.

**UI (`components/GoodsInView.tsx`):**
- A part-type chip row is added above the **tasks** list (a second control alongside the existing
  `Awaiting / Filed / All` status chips) and above the **filed records** list.
- Each list holds its **own independent** part-type selection (`tasksPart`, `recordsPart`), so
  filtering one does not surprise-filter the other.
- Tasks filter by `partCategory(t.partNumber)`; records filter by `partCategory(r.partNumber)`.

## 5. Edit a filed record

**View (`GoodsInView.tsx`):**
- The reopen affordance passes the **matching `GoodsInRecord`** (found by `PO + part`, active
  rows only) into `GoodsInForm`, not just the task.

**Form (`GoodsInForm.tsx`):**
- New optional prop `record?: GoodsInRecord`. When present:
  - Initial state pre-fills Supplier Product Code / Batch-Lot / BBD from the record.
  - Title reflects edit mode (e.g. "Edit G-In form — QA13-CF01").
  - The record's `recordId` (and, for the legacy row, its `timestamp`) is carried in the form
    payload so the server updates the right row.
  - Existing `coaUrl` / `docUrls` are passed through as hidden fields and retained when no new
    file is chosen; uploading a new CofA/doc adds/replaces as today.
- Create mode (no `record`) is unchanged.

**API (`app/api/goods-in/route.ts`):**
- If the payload includes a `recordId` (edit mode): build the updated `GoodsInRecord`
  (preserving the original `timestamp` and `recordId`, merging retained attachment URLs), then
  call `updateGoodsInRecord(recordId, row)` instead of `appendGoodsInRecord`.
- Otherwise: append as today (new record gets a fresh `recordId`).
- Password gate unchanged.

**Sheets (`lib/sheets.ts`):**
- `updateGoodsInRecord(id, row)`: read the `Goods In` values, find the row whose Record ID (col R)
  matches `id` (fallback: `PO+part+timestamp` for the legacy row), `values.update` that single row
  range. Ensures the header is present/extended first (reuse the existing upsert logic).

## 6. Delete = Void

**View:** each filed record row gets a **Delete** action → `window.confirm` → POST to the void
endpoint → `router.refresh()`.

**API (`app/api/goods-in/void/route.ts`, new):** password-gated POST `{ recordId }` →
`voidGoodsInRecord(recordId)`.

**Sheets:** `voidGoodsInRecord(id)`: locate the row (as in §5) and set its **Status cell (col Q)**
to `"Void"` (single-cell `values.update`; nothing erased).

**Read-back (`lib/goods-in.ts` `parseGoodsInRecords`):** drop rows whose Status is `"Void"`.
Consequences that fall out for free:
- The record disappears from "Filed Goods In forms".
- `buildGoodsInTasks` derives filed-status from record existence, so the PO line leaves
  `bookedKeys` and **reappears as an awaiting "G-In form →" task**.
- Re-filing writes a fresh active record (new Record ID); the voided row stays as audit history.

## 7. Testing

- **Pure helpers** via the repo's offline transpile-against-live-data pattern (no test runner):
  `partCategory` boundaries (1/2/3/4/other/blank/non-numeric); `parseGoodsInRecords` excludes
  `Void`; edit round-trip preserves timestamp/recordId and retained attachments.
- **Row-targeting (update/void)** verified against a **throwaway** sheet row written for the test
  — never the user's one real `PO2600151 / 20000022` record.
- **Browser preview:** filter chips narrow both lists; reopen pre-fills; edit updates in place
  (no duplicate row); delete voids → PO returns to awaiting; re-file creates a clean record.
- Deploy = `git push origin main` (Vercel auto-build) after preview verification.

## 8. Risks / notes

- **Cache lag:** `/goods-in` uses `revalidate = 60` on top of the 120s `cachedValues` layer, so an
  edit/void can take up to ~2 min to reflect in the list (unchanged behaviour; `router.refresh()`
  helps but the underlying reads are cached). Acceptable for v1; note only.
- **Header extension** to 18 cols is non-destructive but touches the live tab — first
  update/void (or first new-record append) will relabel/extend the header, same safe path already
  proven by `appendProductionReport`/`appendGoodsInRecord`.
- Legacy row without a Record ID relies on the `PO+part+timestamp` fallback; after it is edited or
  re-filed once it gains a proper id.
