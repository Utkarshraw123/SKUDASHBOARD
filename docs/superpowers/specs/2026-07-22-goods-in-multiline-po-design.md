# Goods In — Multi-line PO ("file the whole PO") — Design

> Date: 2026-07-22 · Feature area: `/goods-in`
> Builds on the edit/void/filters work (`2026-07-22-goods-in-edit-void-filters-design.md`,
> CONTEXT.md §6i). Approved decisions captured from brainstorming.

## 1. Problem

A single PO (e.g. `PO2600151`) carries many part lines. Today the Goods In tasks list shows
**one row per PO+part line**, so that PO appears as ~26 separate rows and compliance would file
26 separate QA13-CF01 forms. The user wants: for a multi-line PO, **one Goods In form listing all
its products, auto-populated**, where compliance fills **Supplier Product Code, Batch/Lot, BBD**
per product, files them together, and gets **one combined Word form**.

## 2. Key insight / why this is low-risk

The persisted model is already **one record row per PO+part** (`Goods In` tab, 18 cols incl.
Record ID + Status). This feature is a **bulk-entry UI over that same per-line model** — Record ID,
edit-in-place, Void, filed-status, and the `revalidateTag("sheets")` cache-bust are all reused
unchanged. No sheet-schema change.

## 3. Decisions (from brainstorming)

1. **Tasks list groups into one row per PO.**
2. **Partial deliveries allowed** — per-line; only lines marked received are saved, the rest stay awaiting; the PO row shows "X of N filed".
3. **One combined Word doc** per PO — a products **table** (row per filed line) + the QA13-CF01 QC/sign-off sections once.
4. **Keep both forms** — a single-line PO opens the existing simple modal; a multi-line PO opens the new grouped form. Routed by line count.
5. **Only 1/2/3/4 codes** — the Goods In tasks list ignores any line whose `partCategory` is `"other"` (freight/service/`ZZ…`/5-/7-codes). The **"Other" filter chip is removed** from Goods In (chips become All · Bulk · RMs · Finished Goods · Ancillaries).

## 4. Data / logic (`lib/goods-in.ts`)

- **Stock-only filter.** A shared predicate `isStockPart(partNumber) = partCategory(partNumber) !== "other"`. Applied when building tasks (both single and grouped) so only 1/2/3/4 lines appear.
- **New grouping builder** `buildGoodsInPoTasks(pos, records, today?)`:
  - Filters open POs to stock lines, groups by `po`.
  - Produces `GoodsInPoTask { po, supplier, lines: GoodsInLine[], totalCount, filedCount, status, earliestDueISO, urgency }`.
  - `GoodsInLine { partNumber, description, quantity, dueDate, partType, record: GoodsInRecord | null }` — `record` is the existing non-Void record for that PO+part (from `records`), else null (so the form can prefill).
  - `status`: `awaiting` (filedCount 0) / `partial` (0<filedCount<total) / `filed` (filedCount===total). `urgency` from the earliest due date among **unfiled** lines (reuse existing urgency buckets).
  - Sort: awaiting/partial before filed; then by urgency; then soonest due.
- The existing per-line `buildGoodsInTasks` stays (used to derive line-level records and for the single-line modal path), but its output is filtered to stock lines too.
- `summarise` gains PO-level counts (POs awaiting / partial / filed / due-today / overdue) or the view derives them from the grouped tasks — implementation detail, keep KPIs meaningful at the PO level.

## 5. Tasks list (`components/GoodsInView.tsx`)

- Render **one row per `GoodsInPoTask`**: PO · Supplier · **N items** · **"X of N filed"** badge · earliest-due + urgency pill · action button.
- Action routes by line count:
  - `totalCount === 1` → open the existing **`GoodsInForm`** (single modal) for that line (current behaviour).
  - `totalCount > 1` → open the new **`GoodsInPoForm`** (grouped) for the PO.
- Part-code chips: **remove "Other"** (a `GOODS_IN_PART_CHIPS` = `PART_CATEGORY_CHIPS` without the `other` entry). A PO row shows under a category filter if **any** of its lines match.
- Keep the existing status chips (Awaiting / Filed / All); add **Partial** to the status filter set (awaiting/partial/filed/all).
- The tasks-table row key uses the PO (`t.po`) — unique per group, so the earlier duplicate-key issue does not recur.

## 6. Grouped form (`components/GoodsInPoForm.tsx`, new)

- Header: PO number, Supplier, item count.
- **Products table**, one row per line, auto-populated from the PO line: **Part / Description / Qty read-only**; three inputs **Supplier Product Code / Batch-Lot / BBD**; a **"Received" checkbox** per row.
  - The Received box **auto-ticks when a Batch/Lot value is entered** (the key compliance field); can be toggled manually.
  - Lines that already have a record come **pre-filled and ticked** (edit).
- **"Select all received"** header toggle for a fully-arrived PO.
- One **password** field; optional **CofA + documents** for the delivery (PO-level, see §8).
- Buttons: **Preview Word form** (generates the combined doc from current ticked rows) and **Save & download form**.
- On save: only ticked rows are submitted. Success panel mirrors the single form (auto-downloads the combined Word doc, links to Filed list).

## 7. Save API (`app/api/goods-in/po/route.ts`, new)

- Multipart `POST`: fields `po`, `password`, `lines` (JSON string = array of `{ partNumber, description, quantity, supplier, supplierProductCode, batchLot, bbd, recordId?, timestamp? }` for **ticked** lines only), optional `coa` + `docs` files.
- Password gate identical to the other write routes.
- Upload attachments once (Vercel Blob, guarded by `BLOB_READ_WRITE_TOKEN`, same graceful-degrade warning). The resulting `coaUrl`/`docUrls` are applied to **every** line record saved in this submission.
- For **each** ticked line: build a `GoodsInRecord` and, exactly as the single route does, **update in place** when the line already has a record (`recordId` present, or fallback key for a legacy blank-id line), else **append** with a generated Record ID. Reuse the existing helpers (`updateGoodsInRecord` / `appendGoodsInRecord` / `recordToRow`).
- After the loop: **`revalidateTag("sheets")`** once, return `{ ok, records, warnings }`.
- The blob-upload block is factored into a small shared helper so it isn't duplicated between this route and the single-line route (light refactor of `app/api/goods-in/route.ts`).

## 8. Attachments

One CofA + documents set **per delivery** (not per product line), applied to all lines saved in that
submission. Unchanged dependency on Vercel Blob: without `BLOB_READ_WRITE_TOKEN` the records still
save and files are skipped with the existing warning.

## 9. Combined Word doc (`lib/goods-in-doc.ts` + doc route)

- New `buildGoodsInPoDoc({ po, supplier, lines })` → a single QA13-CF01 for the PO:
  - Header block (PO, Supplier, date placeholder) as today.
  - A **products table**: columns Part · Description · Qty · Supplier Product Code · Batch/Lot · BBD, one row per filed line.
  - The QA13-CF01 **inbound checks / Vehicle / Pallet / Certification checklists and SIGN / COMPLIANCE SIGN** sections **once** (unchanged content), for the warehouse to complete by hand.
- New doc endpoint `POST /api/goods-in/doc/po` (JSON `{ po, supplier, lines }`) streams the `.docx`. Filename `GoodsIn-<po>-all.docx`.
- The existing single-line `buildGoodsInDoc` / `/api/goods-in/doc` stay for single-line records.

## 10. Filed records list (`GoodsInView.tsx`)

- Group filed records **by PO** (expandable to per-line rows), with a single **"Word (all)"** download per PO (calls `/api/goods-in/doc/po` with that PO's filed lines). Per-line Delete (Void) and single-line "Word" remain available inside the group.
- Keeps the PO-centric mental model end to end.

## 11. Out of scope

- Per-line CofA (one per delivery instead).
- Received-qty differing from the PO qty (qty stays read-only/auto).
- Any change to the `Goods In` sheet schema (still one row per PO+part).
- The two carried-over minors from the prior feature (void 500-vs-404; update/void header re-label) — untouched here.

## 12. Testing

- **Pure** (offline transpile-against-live-data pattern): `isStockPart` / stock filtering; `buildGoodsInPoTasks` grouping, filedCount/status/urgency, prefill record wiring; combined-doc line mapping.
- **Live, throwaway PO only** (never `PO2600151`): batch save creating multiple line records + partial (some ticked) + edit (re-save updates in place, no dup) + `revalidateTag` freshness, then hard-clean.
- **Browser:** grouped rows show "X of N"; multi-line PO opens the grouped form with all lines auto-populated; ticking a subset saves only those; combined Word doc renders as a valid QA13-CF01 with the products table; single-line PO still opens the simple modal; "Other" chip gone and non-stock lines absent.
- Verify in preview, then `git push` to deploy (production auto-deploys).
