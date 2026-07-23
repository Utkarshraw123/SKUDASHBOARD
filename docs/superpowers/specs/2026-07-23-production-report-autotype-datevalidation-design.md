# Production Report — Auto Product Type + Date Validation — Design

> Date: 2026-07-23 · Feature area: `/planning/report` (Production Report form)
> Approved in brainstorming.

## 1. Problem

On the Production Report form, after selecting a work order the supervisor must manually
pick the **Product Type** (Jars / Refills / Daily Essentials / Powders) from a dropdown, even
though the finished-good (FG) description already says which it is. Also, the **BBD date**
fields accept any free text, so typos / bad formats can reach the sheet.

## 2. Decisions (from brainstorming)

1. **Derive Product Type from the FG description** (no new sheet). Auto-select on work-order
   selection; keep the dropdown editable; leave blank when the description gives no signal.
2. **Validate the BBD date fields** as typed `DD/MM/YYYY`: blank allowed, but a non-empty value
   must be a real date; invalid → inline error + submit blocked. Keep the `DD/MM/YYYY` format
   (don't switch to a native picker).

## 3. Product-type derivation

New pure helper in `lib/production-report.ts`:

```
deriveProductType(description: string): ProductType | ""
```

Lower-cases the description and checks, IN THIS ORDER (specific before generic):
- contains `"daily essential"` → `"daily_essentials"`
- contains `"powder"` → `"powders"`
- contains `"refill"` → `"refills"`
- contains `"jar"` → `"jars"`
- else → `""`

Order rationale (from live data, 143 FGs): Jar 74, Refill 38, "Daily Essential" 6, Powder 3.
"Daily Essential" is a distinct product line (must win over an incidental word); a "Powder
Pouch" is a powder; the ~20 FGs with no format word (gummies, boxed capsules, tablets) return
`""` for a manual choice. The check must NOT false-match "Daily **Multi** Nutrient … Jar" (that
is a Jar) — hence the literal `"daily essential"` substring.

**Wiring:** in `ProductionReportForm.selectWO(o)`, set `productType` to
`deriveProductType(o.description)`. The `<select>` remains fully editable (user can override; the
`""` result shows the existing "Select type…" placeholder). Derivation happens **only on
work-order select**, so a manual type choice is never overwritten by later edits.

## 4. Date validation

New pure helper in `lib/production-report.ts`:

```
isValidDMY(s: string): boolean
```

- Trim; **empty string → valid** (BBD is not required).
- Non-empty must match `D/M/YYYY` or `DD/MM/YYYY` (1–2 digit day & month, 4-digit year) AND be a
  real calendar date (round-trips through `new Date(y, m-1, d)`), rejecting `32/13/2026`,
  `2026-01-01`, `abc`, `31/02/2026`, etc.

**Applied to:** `batches[i].bbd` (Product BBD) and `bulks[i].bbd` (Bulk BBD). The Batch fields and
Bulk Batch ("read off the drum") are NOT dates and stay untouched.

**UI (`ProductionReportForm.tsx`):**
- Each BBD input gets a red border + a small inline hint ("Use DD/MM/YYYY") when its value is
  non-empty and `!isValidDMY(value)`. Live as the user types.
- A derived `datesValid = batches.every(b => isValidDMY(b.bbd)) && bulks.every(b => isValidDMY(b.bbd))`.
- On submit, if `!datesValid`, set the existing error result ("Please fix the highlighted BBD
  dates — use DD/MM/YYYY.") and do NOT post. (The submit button may also be disabled when
  `!datesValid`.)

## 5. Files

- `lib/production-report.ts` — add `deriveProductType` + `isValidDMY` (pure, unit-tested). No
  change to existing types or `computeWastage`/`reportToRows`.
- `components/ProductionReportForm.tsx` — call `deriveProductType` in `selectWO`; add the
  BBD-validation UI (red border + hint) and the submit guard. No change to the POST payload shape
  (Product Type still sent exactly as today; it's just pre-selected).

## 6. Out of scope

- Making BBD required (blank stays allowed).
- Re-deriving Product Type when the Description field is manually edited (derive on WO-select only).
- Any sheet/API/schema change; native date picker; validating non-date fields.

## 7. Testing

- **Pure (offline transpile-against-Node):** `deriveProductType` for jar/refill/powder/daily-
  essential/none + the "Daily Multi … Jar" non-false-match + ordering (a description containing
  both "powder" and "jar" resolves to powders per order); `isValidDMY` for valid, empty,
  wrong-format, impossible-date, and non-DMY strings.
- **Browser:** select a "… Jar" WO → Product Type auto-set to Jars; a "… Refill" WO → Refills; a
  no-format WO → blank. Type `32/13/2026` in a BBD → red hint + submit blocked; fix it → submit
  enabled. Prefilled planning BBD validates clean.
- Verify in preview, then `git push` to deploy.
