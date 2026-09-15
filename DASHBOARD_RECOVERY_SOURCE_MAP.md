# KHOD Dashboard Recovery Source Map

This file exists so recovery work does not depend on memory.

## Goal

Recover the KHOD dashboard to the latest known-good behavior without blindly copying Taager logic into KHOD.

KHOD and Taager share a codebase shape, but they are different businesses. Taager can be used as an engineering reference. KHOD business behavior must stay KHOD.

## Source Priority

1. Old working KHOD logic source

   Path:
   `F:\code\khod-bot2\khod-order-bot`

   Meaning:
   This is the old working KHOD project. It is not the dashboard design target, but it is the source of truth for KHOD business identity and old working flows.

   Use for:
   - KHOD account identity and fields.
   - KHOD Supabase/admin/license semantics.
   - KHOD runner/upload flow.
   - KHOD parser/dedupe/enrichment behavior.
   - Static upload / workbook assumptions.
   - Prepaid detection and old working KHOD data interpretation.

   Do not use for:
   - New dashboard layout/design.
   - New dashboard CSS/responsive behavior.
   - New dashboard section architecture.
   - New marketing/performance/lazy hydration patterns.

2. Packaged KHOD app baseline

   Path:
   `F:\code\khod-bot2\khod-from-taager\.codex-tmp\asar-recovery-20260625`

   Meaning:
   This is the clean extracted `app.asar` baseline. It is older, but it is real migrated KHOD dashboard and is safer than the mixed current workspace.

   Use for:
   - Restoring missing KHOD dashboard files.
   - Checking KHOD migration-era names, statuses, sections, and data flow.
   - Safe baseline when current files are suspicious.

   Do not assume:
   - It contains the last 3-7 days of fixes.
   - It contains newer GMV, Order Sources, performance, Section 3, or attribution work.

3. Codex thread history and pasted/exported chats

   Meaning:
   These are the patch map for work done after the packaged app.

   Use for:
   - Later Section 3 query flag/loading fixes.
   - Product/campaign attribution fixes.
   - Section 8 KPI/card/name changes.
   - GMV Target section and Section 8 GMV preview.
   - Order Sources section.
   - Performance/lazy dashboard work.
   - CSS/sidebar/label fixes.

   Rule:
   If a thread is not visible to this Codex instance, Abdel can paste/export it. The pasted text is valid recovery evidence.

4. Current workspace

   Path:
   `F:\code\khod-bot2\khod-from-taager`

   Meaning:
   This is the working target, but it is mixed. Some files are recovered KHOD, some are newer fixes, and some may be copied from the Taager clone.

   Use for:
   - Current failing tests.
   - Orphaned files that reveal missing sections.
   - Existing newer code that can be validated against tests.

   Do not use as blind truth.

5. Taager clone / donor reference

   Path:
   `F:\code\khod-bot2\khod-order-bot\taager clone from khod whaat`

   Meaning:
   Taager is a donor/reference for proven dashboard architecture, speed patterns, UI ideas, and some later feature work.

   Use for:
   - Performance patterns.
   - Lazy section hydration.
   - Section 3 loading/query UX patterns.
   - GMV UI/design reference.
   - Order Sources UI/design reference.
   - CSS/layout patterns.

   Never use for:
   - KHOD parser rules.
   - KHOD status semantics.
   - KHOD order identity.
   - KHOD NDR/DR formulas.
   - KHOD delivered sales/AOV formulas.
   - KHOD commission/marketer profit meaning.
   - KHOD branding/labels without adaptation.

## Non-Negotiable KHOD Business Rules

- When dashboard behavior conflicts with old working KHOD business logic, old working KHOD wins for KHOD data semantics.
- When dashboard layout/design/performance conflicts with old KHOD, the newer Taager-derived dashboard architecture can be kept only if KHOD business logic is preserved.
- KHOD statuses come from `dashboard-khod-logic-core.js` / KHOD status rules.
- Failed and Canceled stay separate.
- Real/missed/source labels must not become lifecycle statuses.
- Delivered sales must use KHOD order value fields and delivered-only rows.
- Marketer commission/profit must use KHOD-compatible fields.
- Delivered AOV is delivered sales divided by delivered orders.
- NDR must follow KHOD selected Actual/Expected/Last Updated behavior.
- Dashboard date/account/currency selections must stay consistent across sections.

## Known Current Problems

- `dashboard.js` currently matches the Taager clone/pre-restore file and must be audited by behavior.
- `gmvTarget` exists in `app.js`, but is not wired in `dashboard-shell.js`.
- `section-gmv-target.js` exists, but the sidebar route is missing.
- `section-order-sources.js` exists, but is not wired in `app.js` or `dashboard-shell.js`.
- `dashboard.js` expects `result.orderSources`, but the aggregator does not currently appear to build `orderSources`.
- Section 8 appears older/mixed and is missing later KPI/name/GMV preview work.
- Section 3 and product attribution have known deeper verification failures.

## Recovery Checklist

Work in small groups. Do not overwrite the whole dashboard folder.

1. Freeze/back up current workspace state.
2. Build a dashboard inventory:
   - app feature bundles
   - shell sidebar items
   - section render functions
   - locale nav labels
   - CSS bundles
   - aggregator output keys
3. Restore shell/sidebar wiring:
   - GMV Target
   - Order Sources
   - KHOD AI route alias
4. Restore data producers:
   - `orderSources` aggregation using KHOD rules
   - GMV target snapshot using KHOD delivered sales, delivered AOV, NDR, and date range
5. Restore later correctness patches:
   - cumulative Confirmed behavior
   - Section 3 backend query flags/loading behavior
   - product/campaign attribution fixes
   - Section 8 KPI/card wording
6. Restore visual/design patches:
   - sidebar labels/names
   - Section 8 GMV preview
   - GMV milestone progress
   - Order Sources diagnostic panel
   - responsive CSS fixes
7. Run verification:
   - `node scripts\check-js-syntax.js`
   - `node scripts\validate-dashboard.js`
   - `node scripts\verify-dashboard-query-service.js`
   - `node scripts\verify-dashboard-query-khod-flags.js`
   - `node scripts\verify-dashboard-rollout.js`
   - dashboard visual QA when ready

## Rule For Every File

Before accepting a file, answer:

1. Is this file pure UI/infrastructure, or does it define business logic?
2. If business logic, does it follow KHOD rules?
3. If copied from Taager, what was adapted?
4. Which test or thread proves the behavior?
5. Does it wire through app manifest, shell, locale, CSS, and aggregator data?

If the answer is unclear, do not trust the file yet.
