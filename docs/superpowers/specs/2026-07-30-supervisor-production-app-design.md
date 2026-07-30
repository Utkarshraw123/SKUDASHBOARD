# Supervisor Production App — Design Spec

> Date: 2026-07-30 · Status: **Approved design, pre-implementation**
> Replaces manual spreadsheet entry for internal production with a secure,
> mobile-first logging app backed by a real database.

---

## 1. Context & problem

Internal Production data (the per-run production log and, on paper, a GMP startup
checklist) is entered manually into Google Sheets:

- **Production log** — the `INPUT` tab of the *production tracker*
  (`1NnS9fg1mFxnWljbjUUXG9701mUPbvrVyiZ2Lbo2Hplw`). One row per
  employee × machine × shift × day. It is **manual and inaccurate** — most
  visibly, the *same machine run's output is copied onto every operator's row*,
  inflating totals (e.g. Iron Plus Jar / "Boxing" showing 4,494 units against
  both Anna and Rishi as separate rows).
- **Startup checks** — the controlled GMP document **SU04 Warehouse Start Up
  Checks V1** (`1Lui6amAqUlnjd2T6e-fbPNgya-et9ltwJPRlIlT6rL8`), currently on
  paper. Start-of-Day and End-of-Day confirmation of 15 items with sign +
  cross-check.

Supervisors should log both from their phones. The data must be **accurate,
attributable (who entered what), and secure**, and it must flow into the existing
manager dashboard **instead of** the spreadsheet.

This is an explicit mandate to **redesign how data is captured** — not to mirror
the messy `INPUT` sheet.

## 2. Goals / non-goals

**Goals**
- A mobile-first, installable app (PWA) for supervisors: log in → Start-of-Day
  SU04 checklist → log machine runs through the shift → End-of-Day SU04 checklist.
- Accurate capture: output counted **once per run**, attributed to **one operator**;
  efficiency computed **server-side**.
- Secure login (username + password) with **per-entry attribution** and a full
  **audit trail**; supervisors can correct their own errors without losing history.
- The manager dashboard's Internal Production tabs read this data from the DB
  instead of the `INPUT` sheet, including per-operator appraisal analytics and an
  SU04 compliance view.

**Non-goals (this build)**
- Migrating Yield / Production Reports off their existing sheet (`Reports` tab) —
  out of scope; unchanged.
- Offline support — the floor is **always online**; save-on-entry, no sync layer.
- Native app / app stores.
- Deriving planned targets from machine standard rates (future upgrade — see §11).
- Any coupling to the practitioner-portal project (explicitly separate — see §12).

## 3. Users & roles

| Role | Can |
|---|---|
| **supervisor** | Log in to the PWA; complete SU04 start/end checks; create/edit/void runs; cross-check (a *different* supervisor's checklist). |
| **manager** | View the dashboard (read-only over the production DB). No app entry. |
| **admin** | Everything a manager can, plus manage `users`, `operators`, `machines`, and the SU04 `checklist_items`/template via a small admin screen. |

Operators (the people who run machines) are **not** login users — they are a
managed list selected on each run.

## 4. Architecture & data flow

One app, two faces, inside the existing `wild-dash` Next.js repo — **no second
codebase**.

- **Supervisor PWA** — a new mobile-first area (route prefix `/floor`). The only
  part behind login. Installable ("Add to Home Screen"), full-screen, remembers
  login.
- **Manager dashboard** — the current dashboard; its Internal Production tabs now
  read the DB.

```
Supervisor phone (PWA /floor)
      │  username + password  (bcrypt, httpOnly session cookie)
      ▼
Next.js API routes  ──►  Turso DB (standalone)  ◄──  Dashboard pages (server read)
  validate · compute efficiency · stamp logged_by + time · audit every change
```

- **New standalone Turso (libSQL) database**, created solely for this project.
  Server-side client only. Env vars in *this* project only:
  `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
- **Server is the source of trust:** the phone submits raw numbers; the server
  validates, computes efficiency (never trusts a client %), and stamps
  `logged_by` + timestamp. The client cannot fake attribution.
- **SKUs stay sourced from `ALL SKU DASHBOARD`** (existing `fetchSkus`) for the
  product picker, so the SKU list stays in sync with the rest of the dashboard;
  the chosen description is snapshotted onto the run.
- **Machines & operators** are managed lists in the DB (seeded once, editable).
- **The `INPUT` sheet is retired for entry.** Historical sheet data may be left
  as pre-app history or one-time imported later (not required for this build).
- Everything else on the dashboard stays on Google Sheets — this is an isolated
  addition.

## 5. Data model (Turso / libSQL — SQLite)

Identifiers are integer primary keys unless noted. Timestamps are ISO-8601 UTC.

### Identity & configuration

**`users`** — login accounts
`id · username (unique) · password_hash · name · role (supervisor|manager|admin) · active · created_at`

**`operators`** — machine operators (not logins)
`id · name · active · created_at`

**`machines`**
`id · name · active · created_at`

**`checklist_templates`** — versioned SU04 document
`id · code (e.g. "SU04") · version (e.g. "V1") · title · active · created_at`

**`checklist_items`** — the checks belonging to a template version
`id · template_id · sort_order · category · label · critical (bool) · active`
Seeded from SU04 V1 (see §7).

### Operational data

**`readiness_days`** — one per production day (the SU04 instance)
```
id · date (unique) · template_id
start_completed_by (user)   · start_completed_at   · start_cross_check_by (user)
end_completed_by (user)     · end_completed_at     · end_cross_check_by (user)
status (open | started | closed)
```
- Start phase completed by the Shift-1 supervisor (~6am), gates production.
- End phase completed by the Shift-2 supervisor (~10pm).

**`readiness_checks`** — one row per item per phase per day
```
id · readiness_day_id · item_id · phase (start | end)
result (confirm | deny) · comment · checked_by (user) · checked_at
```
- `deny` requires a non-empty `comment` (enforced server-side).

**`runs`** — the core production record
```
id · date · shift · machine_id · operator_id
product_sku · product_desc (snapshot)
planned_qty · actual_qty · start_time · end_time · downtime_min · comments
logged_by (user) · created_at · updated_at
void (bool) · void_reason · voided_by (user) · voided_at
```
- Output lives **here, once**, owned by **one** operator.
- Efficiency is **derived** (`actual_qty / planned_qty`), not stored; throughput
  (`actual_qty / effective run hours`) derived from times/downtime.

### Accountability

**`audit_log`** — every mutation
`id · entity (run|readiness_check|readiness_day|user|...) · entity_id · action (create|update|void) · field · old_value · new_value · changed_by (user) · changed_at`

**`sessions`** (or equivalent) — server-side session records for the httpOnly
cookie; supports "resume in progress".

## 6. Supervisor mobile flow (`/floor`)

Mobile-first, large touch targets, minimal typing.

1. **Log in** — username + password → secure session.
2. **Day home** — today's date + SU04 status. If Start-of-Day is not done, prompt
   the Start checklist; if done, show **Log runs**. End-of-Day check available at
   shift close.
3. **SU04 checklist (Start / End phase)** — items grouped by category, each a
   large row: **Confirm / Deny**, optional time (auto-captured), and a comment
   (**required on Deny**). Progress indicator ("12/15"). Critical items marked.
   Completing the phase captures the signer (logged-in user) and requires a
   **cross-check by a different user**. Completing **Start** unlocks run logging.
4. **Log runs** — running list of the day/shift's runs at top; big **"＋ New run"**
   walks **shift → machine → operator → product (searchable SKU) → planned target
   → actual output → start/end time → downtime → comments → Save**. Saved runs
   appear instantly, tappable to **edit** (trailed). Efficiency shown after save.
5. **Shift / day summary** — totals (units, avg efficiency, downtime, per-operator
   breakdown); **End shift / End of Day** triggers the End SU04 phase and closes
   the day.

**Resume:** an in-progress checklist or shift resumes after a phone lock/drop —
nothing lost.

## 7. SU04 checklist content (seed data, template V1)

15 items, categorised; each confirmed at **Start of Day** and **End of Day**;
comment required on any Deny; signed + cross-checked.

- **Environment** — Area is clear from debris · Ventilation units are working ·
  No signs of pest activity · The yard is clear from debris · Waste bins are empty
- **Product** — No finished goods left out of boxes on pallets · No concern of
  over-hanging pallets on racking · Pallets are clean to an acceptable level
- **Site Security** — Shutter doors are locked on arrival and when leaving · Fire
  exit door is functional and shut · Product/pallets are not left outside
- **Equipment** — Scales are working and in good condition · Safety knives are
  sharp and free from damage
- **Personnel** — Correct PPE is being worn

Template is **versioned** (`SU04 V1`); revisions create a new version so historical
`readiness_days` still reference the version they were signed against.

## 8. Dashboard reflection (manager side)

Internal Production tabs read the DB instead of the `INPUT` sheet:

- **Performance / Appraisals** — per-**operator** and per-**machine** views over
  any date range: output, server-computed efficiency, throughput (units/hr),
  downtime, days/shifts worked. Filter to one operator for their review-period
  numbers; CSV export.
- **Runs register** — one row per machine run (date, shift, machine, operator,
  product, planned, actual, efficiency, downtime, logged_by, timestamps). Void
  runs excluded from totals, visible with a flag. Searchable, exportable.
- **SU04 compliance** — each day's Start/End records: who signed + cross-checked,
  times, and any **Deny surfaced as an amber flag** with its comment; incomplete
  or missing checks show as gaps. Drill into a day's full checklist; export for
  audit.
- **Yield / Reports** — unchanged (still read the `Reports` sheet).

Dashboard is server-rendered and **read-only** over the DB — only supervisors
create data, through the app.

## 9. Auth, accountability & error handling

- **Auth:** username + password, **bcrypt** hashing (plaintext never stored or
  logged); httpOnly secure session cookie; role gates (`supervisor`/`manager`/`admin`).
- **Editing:** supervisors may create/edit/void runs and correct checklist
  entries. Every create/edit is stamped (who + when); the **`audit_log`** records
  field-level old→new. **Deletes are soft** (`void` with reason) — production and
  GMP records stay auditable. Default edit scope: any supervisor may correct any
  run (fully trailed); managers/admins may edit anything. (Tightenable to
  own-entries-only later.)
- **Cross-check integrity:** enforced to be a *different* user than the completer.
- **Validation (server):** required fields; `actual_qty, planned_qty ≥ 0`;
  `end_time ≥ start_time`; `downtime_min ≥ 0`; Deny requires a comment; cross-check
  differs. Friendly inline errors on the phone; no silent failures; idempotent
  saves.

## 10. Testing

- **Pure logic** unit-tested offline via the repo's transpile-and-run pattern:
  efficiency, throughput, checklist completeness + Deny/critical flagging, audit
  diffing, run totals excluding voids.
- **API routes:** validation + auth guard tests (rejects unauthenticated,
  enforces Deny-comment and cross-check-differs).
- **Browser verification** of the full supervisor flow on a mobile viewport before
  completion; dashboard views verified against seeded DB data.

## 11. Future upgrades (explicitly out of scope now)

- Objective targets: standard **run-rate per machine × product** → derived planned
  qty and tamper-proof efficiency.
- One-time import of historical `INPUT` sheet data into `runs`.
- Migrating Yield / Production Reports off the `Reports` sheet to the DB.
- Additional checklist templates per area/line (the model already supports
  multiple templates/versions).

## 12. Separation from other projects

This system is **entirely independent** of the practitioner-portal project:
its own Turso database, its own credentials/env vars, its own code within the
`wild-dash` repo. No shared database, code, or configuration.

## 13. Open items

- None blocking. Defaults chosen where the user deferred: checklist **once per day**
  (Start by Shift-1 supervisor ~6am, End by Shift-2 supervisor ~10pm); checklist
  gate **records + flags** Denies (does not hard-block); edit scope **any
  supervisor, trailed**. Each is easily adjustable.
