# KHOD Dashboard Recovery Plan

This is the handoff plan for any Codex continuing recovery work.

The current workspace is not fully trusted. It is a mixed state after files were deleted/overwritten and then partially restored from the packaged app.

Read this together with:

- `DASHBOARD_RECOVERY_SOURCE_MAP.md`
- `MIGRATION_NOTES.txt`

## Current Situation

Workspace:
`F:\code\khod-bot2\khod-from-taager`

Old working KHOD:
`F:\code\khod-bot2\khod-order-bot`

Taager donor/reference:
`F:\code\khod-bot2\khod-order-bot\taager clone from khod whaat`

Recovered packaged KHOD baseline:
`F:\code\khod-bot2\khod-from-taager\.codex-tmp\asar-recovery-20260625`

Damaged pre-restore backup:
`F:\code\khod-bot2\khod-from-taager\.codex-tmp\current-before-asar-restore-20260704-013956`

## Source Rules

Use old working KHOD for KHOD business truth:

- KHOD identity/account fields
- KHOD parser and enrichment logic
- KHOD status meaning
- static upload and prepaid detection
- runner/upload semantics

Use packaged app for migrated dashboard baseline:

- dashboard files that existed before the last several days of fixes
- KHOD migrated dashboard semantics
- missing files such as `dashboard-khod-logic-core.js`

Use Codex threads/pasted chats for recent fixes:

- Section 3 query flags/loading
- cumulative Confirmed fixes
- Section 8 KPI/GMV preview changes
- GMV section
- Order Sources section
- product attribution
- performance/lazy dashboard changes

Use Taager clone only as donor/reference:

- UI layout/design ideas
- performance/lazy patterns
- GMV/Order Sources visual reference
- CSS structure

Never blindly copy Taager business logic into KHOD.

## Known Current Failures / Missing Pieces

1. NDR topbar mode is incomplete.
   - Migration notes say Phase 4.5 restored a third mode: Last Updated.
   - Current dashboard only has Actual NDR and Expected NDR / Closed Cycle.
   - Current code normalizes `updatedAt` back to `actual`, which erases the old KHOD-style mode.

2. GMV Target is partly orphaned.
   - `app.js` has `dashboardGmvTarget`.
   - `section-gmv-target.js` exists.
   - `dashboard-shell.js` does not show `gmvTarget` in sidebar and does not map it to `renderSectionGmvTarget`.
   - Section 8 appears to be missing the later GMV preview/progress work.

3. Order Sources is orphaned.
   - `section-order-sources.js` exists.
   - `dashboard-order-sources.css` exists.
   - `dashboard.js` expects `result.orderSources`.
   - `app.js` does not define a feature bundle for it.
   - `dashboard-shell.js` does not show it in sidebar and does not map it to `renderSectionOrderSources`.
   - Aggregator does not currently appear to build `orderSources`.

4. Section 8 is likely old/mixed.
   - User remembers wrong KPI/card names.
   - Later threads mention Section 8 KPI/card/GMV progress changes.
   - Current Section 8 should be audited against migration notes and visible/pasted threads.

5. Section 3 and product attribution are still not fully recovered.
   - `node scripts\verify-dashboard-query-khod-flags.js` failed because Section 3 backend orders must start disabled until KHOD query flags load.
   - `node scripts\verify-dashboard-query-service.js` failed on single-SKU vs bundle-SKU attribution.

6. The dashboard tree is mixed.
   - Many files match recovered asar.
   - Some match the Taager clone/pre-restore backup.
   - Matching Taager is not automatically bad for UI helpers, but any business logic must be checked.

## First Work Batch: Topbar NDR Mode

Status: completed on 2026-07-04 in current workspace.

Start here because it is visible, central, and documented in migration notes.

Goal:
Restore three NDR modes:

1. Actual NDR
   - current selected dashboard period
   - created-date based behavior

2. Expected NDR / Closed Cycle
   - expected NDR range / historical cohort behavior

3. Last Updated
   - old KHOD-style delivered-count mode
   - delivered outcome rows map to `lastUpdatedAt` / `updatedAt`
   - Actual keeps current created-date behavior
   - Expected keeps historical cohort behavior

Files likely involved:

- `src/renderer/pages/dashboard/dashboard-filter-bus.js`
- `src/renderer/pages/dashboard/dashboard-shell.js`
- `src/renderer/pages/dashboard/dashboard-aggregator.js`
- `src/renderer/pages/dashboard/locales/en/dashboard-locale.js`
- `src/renderer/pages/dashboard/locales/ar/dashboard-locale.js`
- `scripts/validate-dashboard.js` or a new focused verifier if needed

Search anchors:

- `DELIVERED_DATE_MODES`
- `normalizeDeliveredDateMode`
- `deliveredDateOptions`
- `deliveredDate.updatedAt`
- `deliveredDate.createdAt`
- `isDeliveredRowInPeriod`
- `deliveredDashboardDate`
- `rowDashboardDate`
- `filterOutcomeOrders`

Expected implementation shape:

- Add a stable mode value, likely `lastUpdated`.
- Keep legacy `updatedAt` storage/value mapped to `lastUpdated`, not `actual`.
- Topbar should show three options:
  - Actual NDR
  - Expected NDR / Closed Cycle
  - Last Updated
- Aggregator must distinguish:
  - `actual`: created-date based actual behavior
  - `expected`: expected/closed-cycle cohort behavior
  - `lastUpdated`: delivered rows use `lastUpdatedAt || updatedAt`

Verification:

- `node scripts\check-js-syntax.js`
- `node scripts\validate-dashboard.js`
- Add/adjust a static assertion so the selector includes Last Updated and `updatedAt` is not collapsed to `actual`.

Implementation completed:

- `dashboard-filter-bus.js`
  - Added `LAST_UPDATED: 'lastUpdated'`.
  - Legacy stored value `updatedAt` now normalizes to `lastUpdated`, not `actual`.
- `dashboard-shell.js`
  - Added the third topbar NDR option with value `lastUpdated`.
  - Dashboard scope key now preserves the selected delivered date mode instead of collapsing to actual/expected only.
- `dashboard-aggregator.js`
  - Added `lastUpdatedDashboardDate`.
  - `lastUpdated` mode uses `lastUpdatedAt || updatedAt || lastUpdated || updateDate` for delivered outcome rows, with created date fallback.
  - Actual keeps created-date behavior.
  - Expected keeps cohort behavior.
- Locale files
  - Added `deliveredDate.lastUpdated` in English and Arabic.
- `scripts/validate-dashboard.js`
  - Added assertions so `lastUpdated` mode and labels cannot silently disappear again.

Verification completed:

- `node scripts\check-js-syntax.js` passed: 115 JavaScript files.
- `node scripts\validate-dashboard.js` passed: 93/93.
- `node scripts\verify-dashboard-rollout.js` passed.

Still failing, unrelated to this NDR batch:

- `node scripts\verify-dashboard-query-khod-flags.js`
  - Fails: Section 3 backend orders must stay disabled until KHOD query flags explicitly enable them.
- `node scripts\verify-dashboard-query-service.js`
  - Fails: single-SKU campaigns are blocked by bundle rows that also contain the SKU.

Next recommended batch:

- Continue with Section 3 query flag/loading behavior, then product/campaign attribution.

## Second Work Batch: Sidebar / Section Wiring

Goal:
Make every existing dashboard section reachable and loaded by feature bundles.

Files:

- `src/renderer/app.js`
- `src/renderer/pages/dashboard/dashboard-shell.js`
- dashboard locale files
- relevant CSS feature bundle map

Fix:

- Add `gmvTarget` to `NAV_ITEMS`.
- Add `gmvTarget: 'renderSectionGmvTarget'` to `SECTION_FN`.
- Add `gmvTarget` to cacheable sections if appropriate.
- Add `orderSources` feature bundle in `app.js`.
- Add `orderSources` to `DASHBOARD_SECTION_FEATURES`.
- Add `orderSources` to `NAV_ITEMS`.
- Add `orderSources: 'renderSectionOrderSources'`.
- Add CSS bundle for `dashboard-order-sources.css`.
- Add English/Arabic nav labels.

Verification:

- Manifest missing-file check.
- `node scripts\check-js-syntax.js`
- `node scripts\validate-dashboard.js`

## Third Work Batch: Order Sources Data

Goal:
Make `section-order-sources.js` receive real KHOD data from aggregator.

Business rules:

- Source is the KHOD/order source field. Preserve raw source names; do not friendly-rename.
- Blank source becomes Unknown source only for display.
- Use KHOD lifecycle statuses.
- Failed and Canceled separate.
- Deduplicate by KHOD order identity so multi-product rows do not double-count orders.
- Same selected period/account/currency/NDR mode as the rest of dashboard.

Files:

- `src/renderer/pages/dashboard/dashboard-aggregator.js`
- `src/renderer/pages/dashboard/dashboard.js`
- `src/renderer/pages/dashboard/sections/section-order-sources.js`
- locales

Thread evidence:
Visible thread title: `Add order sources section`.

Verification:

- Add or run static checks for `orderSources`.
- `node scripts\check-js-syntax.js`
- `node scripts\validate-dashboard.js`

## Fourth Work Batch: GMV Target and Section 8 Preview

Goal:
Restore the GMV section and Section 8 preview/progress behavior.

Files:

- `src/renderer/pages/dashboard/sections/section-gmv-target.js`
- `src/renderer/pages/dashboard/dashboard-gmv-target.css`
- `src/renderer/pages/dashboard/sections/section8-master.js`
- `src/renderer/pages/dashboard/dashboard-shell.js`
- `src/renderer/app.js`

Thread evidence:
Visible thread title: `Design GMV target calculator`.

KHOD data contract:

- Current GMV = KHOD total delivered sales.
- Delivered AOV = KHOD delivered sales / delivered orders.
- NDR = KHOD NDR for current selected mode.
- Formula:
  Daily orders needed = ((Target GMV - Current delivered sales) / Delivered AOV / NDR) / Days left

Verification:

- `node scripts\check-js-syntax.js`
- `node scripts\validate-dashboard.js`
- Visual QA later.

## Fifth Work Batch: Recent Correctness Patches

Recover later fixes that happened after the packaged app.

Known patches:

1. Cumulative Confirmed behavior
   - Visible thread title: `Fix confirmed orders count`
   - Files included:
     - `src/main/dashboard-query-service.js`
     - `src/renderer/pages/dashboard/dashboard-aggregator.js`
     - `src/renderer/pages/dashboard/sections/section1-overview.js`
     - `src/renderer/pages/dashboard/sections/section2-pipeline.js`
     - `src/renderer/pages/dashboard/sections/section3-orders.js`
     - `src/renderer/pages/dashboard/sections/section8-master.js`
     - `scripts/verify-dashboard-query-service.js`

2. Section 3 query flag/loading behavior
   - Migration notes Phase 4.6.
   - Backend Orders starts disabled and only enables after `get-dashboard-query-flags` returns `flags.orders`.

3. Product/campaign attribution
   - Current `verify-dashboard-query-service.js` fails on single-SKU vs bundle-SKU attribution.
   - Compare current file with backup/clone/thread evidence, but adapt to KHOD.

Verification:

- `node scripts\verify-dashboard-query-service.js`
- `node scripts\verify-dashboard-query-khod-flags.js`
- `node scripts\verify-dashboard-rollout.js`

## Sixth Work Batch: Dashboard Preloader / Flicker Recovery

Goal:
Recover the newer polished dashboard preloader and the anti-flicker behavior.

Important:
This is UI/infrastructure, not KHOD business logic. It is acceptable to use the Taager donor implementation as a design/performance reference, but text must say KHOD/KHOD WHAAT and dashboard state must remain KHOD.

Evidence found:

- Current KHOD workspace has an older `window.KhodPreloader` implementation in `src/renderer/app.js`.
- Taager donor has a newer preloader implementation with richer translation keys:
  - `preloader.dashboard.stage.engine.label`
  - `preloader.dashboard.stage.snapshot.label`
  - `preloader.dashboard.stage.accounts.label`
  - `preloader.dashboard.stage.metrics.label`
  - `preloader.dashboard.stage.modules.label`
  - `preloader.dashboard.stage.marketing.label`
  - `preloader.dashboard.stage.rendering.label`
  - `preloader.dashboard.activity.*`
- Visible thread title: `Fix dashboard preloader delay`
  - Work touched KPI loading state polish in:
    - `src/renderer/pages/dashboard/dashboard-shared.js`
    - `src/renderer/pages/dashboard/sections/section1-overview.js`
    - `src/renderer/pages/dashboard/sections/section8-master.js`
- Visible thread title: `Fix dashboard flicker`
  - Found post-load flicker came from Section 8 rerendering after marketing/ROI listeners.
  - Donor patch debounced Section 8 listener-triggered refreshes and marked refresh renders so animations/count-up do not replay.

Likely source files:

- `src/renderer/app.js`
- `src/renderer/index.html` or the HTML file containing `#preloader` / `#dashboard-live-preloader`
- `src/renderer/styles/main.css`
- `src/renderer/pages/dashboard/dashboard-shared.js`
- `src/renderer/pages/dashboard/sections/section1-overview.js`
- `src/renderer/pages/dashboard/sections/section8-master.js`
- maybe dashboard CSS files for loader styling

Donor reference:

`F:\code\khod-bot2\khod-order-bot\taager clone from khod whaat`

Search anchors:

- `preloader.dashboard.stage.engine.label`
- `DashboardPreloader`
- `KhodPreloader`
- `dashboard-live-preloader`
- `beginUiStabilization`
- `route-curtain`
- `dashboard-section8 listener:marketing-rerender`
- `dash-section-refreshing`
- `Syncing spend`
- `marketing value state`

Implementation rules:

- Port the newer visual/stage preloader design from donor.
- Adapt all visible strings to KHOD/KHOD WHAAT.
- Keep dashboard stage ordering compatible with KHOD:
  - engine
  - snapshot
  - accounts
  - metrics
  - modules/views
  - marketing
  - rendering
- Restore/keep anti-flicker behavior:
  - preloader dismiss should stabilize UI instead of causing black-screen or layout flash.
  - Section 8 marketing/ROI listener refreshes should debounce into one quiet refresh.
  - KPI animations/count-up should not replay on quiet refresh.
- Do not change KHOD calculations.

Verification:

- `node scripts\check-js-syntax.js`
- `node scripts\validate-dashboard.js`
- If available: visual/dashboard QA with screenshots.
- Manual check: open dashboard and confirm preloader design appears before dashboard, then no post-load flash/repeated Section 8 rerender.

## Seventh Work Batch: Performance/Lazy Migration

Only after correctness/wiring is back.

Thread/pasted evidence:
Performance migration edited:

- `src/main/main.js`
- `src/renderer/pages/dashboard/dashboard-aggregator.js`
- `src/renderer/pages/dashboard/dashboard.js`
- `src/renderer/pages/dashboard/sections/section3-orders.js`
- `src/renderer/pages/dashboard/sections/section5-products.js`
- `src/renderer/pages/dashboard/dashboard-query-runtime.js`
- `src/renderer/pages/dashboard/sections/section-cities.js`
- `scripts/perf/qa-dashboard-perf-load.js`
- later `scripts/validate-dashboard.js`

Important:
Do not break KHOD business logic while restoring lazy/performance patterns.

## Suggested Working Discipline

For each batch:

1. Read migration notes/thread evidence for that batch.
2. Compare current vs asar vs Taager donor vs old KHOD where relevant.
3. Patch only the minimal files for that batch.
4. Run the smallest useful tests.
5. Update this plan with status.

Do not attempt a whole-dashboard rewrite.

## Status

- Source map created.
- Recovery plan created.
- First recommended task: Topbar NDR mode / Last Updated.

## Recovery Log: 2026-07-04 Batch 2

Checkpoint before this batch:

- `F:\code\khod-bot2\khod-from-taager\.codex-tmp\recovery-checkpoint-20260704-022254`

Completed:

- Section 3 query flag gate restored.
  - `src/renderer/pages/dashboard/sections/section3-orders.js`
  - Backend orders now start disabled.
  - Backend order querying enables only after `DashboardQueryRuntime.flags().orders` is true.

- Product/campaign attribution restored for single-SKU vs bundle-SKU matching.
  - `src/renderer/pages/dashboard/dashboard-product-attribution-core.js`
  - Upgraded attribution logic to version 3 behavior.
  - Preserved both `window.KhodProductAttribution` and `window.TaagerProductAttribution` exports for compatibility.

- GMV Target and Order Sources are wired into the dashboard shell and app feature loader.
  - `src/renderer/app.js`
  - `src/renderer/pages/dashboard/dashboard-shell.js`
  - `src/renderer/pages/dashboard/locales/en/dashboard-locale.js`
  - `src/renderer/pages/dashboard/locales/ar/dashboard-locale.js`
  - Added `dashboardOrderSources` script/style bundles.
  - Added `orderSources` and `gmvTarget` sidebar routes.

- GMV target shared state restored.
  - `src/renderer/pages/dashboard/dashboard-shared.js`
  - Restored `window.DashboardGmvTargetState`.
  - Storage key adapted to KHOD: `khod_gmv_target_v1`.

- Order Sources data producer restored.
  - `src/renderer/pages/dashboard/dashboard-aggregator.js`
  - Adds `buildOrderSourceBreakdown`.
  - Emits `data.orderSources` and `data.roi.orderSources`.
  - Uses KHOD status helpers and KHOD source candidates first:
    `orderReceivedBy`, `receivedBy`, `rawOrderSource`, `orderSource`, Arabic source columns.

- Section 8 restored to the newer recovered version.
  - `src/renderer/pages/dashboard/sections/section8-master.js`
  - Restores GMV preview/progress card.
  - Restores Total / Net Orders KPI wording.
  - Restores marketing loading/unavailable states.
  - Restores debounced Section 8 refresh behavior for ROI/marketing/GMV updates.
  - Cleaned visible `Taager Profit After Tax` labels to `Profit After Tax`.

## Recovery Log: 2026-07-04 Batch 7 - Dashboard Speed Audit / Partial Fix

User question:

- Are Section 3, Section 7, COD collection, preloader, anti-flicker, and dashboard speed fully back?

Honest status:

- Not fully proven yet.
- Several speed protections are restored and focused checks pass.
- Full Electron dashboard performance QA still fails, so do not claim the dashboard is fully as fast as the recovered Taager/KHOD performance branch.

Completed in this batch:

- Restored six-pane dashboard cache expectation.
  - `src/renderer/pages/dashboard/dashboard-shell.js`
  - `scripts/verify-dashboard-speed-followup.js`

- Restored dashboard-ready pane marker required by the performance harness.
  - `src/renderer/pages/dashboard/dashboard-shell.js`
  - Sets `pane.dataset.dashboardReady = sectionId` after section render.

- Restored non-blocking Cities first paint.
  - `src/renderer/pages/dashboard/sections/section-cities.js`
  - Cities now renders the existing KHOD snapshot immediately and refreshes query-backed city data in the background.
  - This fixes the earlier behavior where the city search input could be blocked behind a slow query snapshot.

- Restored leading-edge Section 3 search feedback.
  - `src/renderer/pages/dashboard/sections/section3-orders.js`
  - Search input now updates state immediately and clears visible rows while backend/local filtering catches up.

- Optimized Campaign Overview query service.
  - `src/main/dashboard-query-service.js`
  - `src/renderer/pages/dashboard/dashboard-campaign-query-core.js`
  - Carries product net order keys into campaign intelligence so matched unique orders can be counted without a second full order-row scan.

- Added COD to fixture performance coverage.
  - `scripts/perf/qa-dashboard-perf-load.js`
  - COD cold render now uses `.s4-cod-overview-card` as the ready selector.

Focused checks passing:

- `node scripts/check-js-syntax.js`
  - PASS: 115 JavaScript files.
- `npm.cmd run verify:dashboard-speed`
  - PASS: 8 checks.
- `node scripts/verify-dashboard-query-service.js`
  - PASS when run serially.
- `node scripts/verify-dashboard-query-khod-flags.js`
  - PASS when run serially.
- COD focused fixture check:
  - `node scripts/perf/qa-dashboard-perf-load.js --fixture=perf-fixture-5k.json --sections=cod --skipStability=true`
  - COD cold render function: 28ms.
  - COD visible wall-clock: 1126ms.
  - COD ready selector: PASS.
  - Overall run FAILS only because startup aggregation/shell mount exceed thresholds.

Important performance findings:

- 5K COD targeted report:
  - `.codex-tmp/perf-reports/perf-report-1783167180691.json`
  - Aggregation: 3933ms, limit 2500ms.
  - Shell mount: 693ms, limit 500ms.
  - COD render itself is fast; startup aggregation is the remaining bottleneck.

- 20-order Cities focused report:
  - `.codex-tmp/perf-reports/perf-report-1783167799047.json`
  - Cities cold render: 189ms.
  - Cities search: 7.4ms.
  - PASS.

Current full QA blockers:

- `npm.cmd run qa:dashboard:perf` still FAILS.
- Latest failure:
  - Cities ready selector `#sc-fb-search` timed out during full QA after Products.
  - Focused Cities fixture passes, so this is likely specific to the full QA route/fixture/shadow-flow interaction.
- Previous failure before Section 3 patch:
  - Orders search left rows visible and exceeded 200ms.
  - Section 3 was patched afterward; focused checks pass, but full QA did not reach Orders again because Cities timed out first.

Product shadow mismatch still present:

- Full QA logs:
  - `[DashboardQuery][shadow] rollout mismatch`
  - Section: products
  - Mismatches:
    - `summary.deliveredOrders`: legacy `264`, query `12`
    - `row.drBaseOrders` for `roi-04`: legacy `12`, query `24`
- This does not currently fail the QA command directly, but it is a real parity warning and must be resolved before enabling Products query path confidently.

Recovered source to use next:

- Lazy-heavy dashboard aggregation exists in:
  - `.codex-tmp/current-before-asar-restore-20260704-013956/dashboard/dashboard-aggregator.js`
- Useful markers in that file:
  - `buildHeavyStatsInMainLoop`
  - `buildCityStatsInMainLoop`
  - `buildProductStatsInMainLoop`
  - `ensureCitiesModel()`
  - `ensureProductsModel()`
  - `ensureCampaignProductStats()`
  - `process:heavy-models-lazy`
  - `process:cities-model-lazy`
  - `process:products-model-lazy`
- Do not copy the whole file blindly; port only the lazy aggregation pattern into the current KHOD aggregator so KHOD business logic and Section 8 recovery stay intact.

Next recommended steps:

1. Reproduce the full-QA Cities timeout in isolation after Products, preferably by adding a temporary diagnostic or using the full QA fixture path.
2. Fix Products shadow parity before trusting backend Products query in production.
3. Port the lazy aggregation pattern from `.codex-tmp/current-before-asar-restore-20260704-013956/dashboard/dashboard-aggregator.js` into current `src/renderer/pages/dashboard/dashboard-aggregator.js`.
4. Rerun:
   - `node scripts/check-js-syntax.js`
   - `npm.cmd run verify:dashboard-speed`
   - `node scripts/verify-dashboard-query-service.js`
   - `node scripts/verify-dashboard-query-khod-flags.js`
   - `node scripts/perf/qa-dashboard-perf-load.js --fixture=perf-fixture-5k.json --sections=orders,cod,products,cities,calculator --skipStability=true`
   - `npm.cmd run qa:dashboard:perf`

- Dashboard shared KPI loading polish restored.
  - `src/renderer/pages/dashboard/dashboard-shared.js`
  - Restores `dashboardMarketingLoadingHtml`.
  - Restores `dashboardMarketingUnavailableHtml`.
  - Restores `kpiCard` and `s8KpiCard` handling for `loading` and `unavailable`.

Verification completed in this batch:

- `node scripts\check-js-syntax.js` passed: 115 JavaScript files.
- `node scripts\validate-dashboard.js` passed: 93/93.
- `node scripts\verify-dashboard-query-service.js` passed earlier after attribution restoration.
- `node scripts\verify-dashboard-query-khod-flags.js` passed earlier after Section 3 flag restoration.

Current verification note:

- The query-service timing gate is tight and can fail when the machine is busy.
- It was re-run after measuring campaign overview locally and passed.
- Do not weaken the verifier. If it fails again, re-run once on an idle machine before treating it as a business regression.

Recommended next checks:

- Launch the app and visually inspect:
  - dashboard no longer fails to load,
  - sidebar shows Order Sources and GMV Target,
  - Section 8 shows GMV target preview,
  - marketing KPIs show loading/unavailable states without layout flicker,
  - no visible Taager branding remains in KHOD-facing dashboard text.

## Recovery Log: 2026-07-04 Batch 3

Evidence:

- Another Codex session reported it continued recovery work for:
  - dashboard-only staged preloader,
  - background marketing sync,
  - marketing cache/rate/error handling,
  - GMV planner wiring/icons/localization,
  - Best NDR toolbar,
  - calculator selector and product comparison,
  - static-account live-update protection,
  - obsolete product-name editor removal.

Current inspection:

- `src/renderer/app.js` now contains staged dashboard preloader translation keys and `window.KhodPreloader` stage definitions.
- `src/renderer/pages/dashboard/dashboard-shell.js`, `dashboard-styles.css`, `dashboard.js`, `dashboard-aggregator.js`, `dashboard-filter-bus.js`, `section-marketing-connections.js`, `section7-calculator.js`, `section5-products.js`, `dashboard-best-ndr-cycle.js`, `dashboard-calculator.css`, and GMV/locale files appear to include the later work described by the other Codex.

Verification completed after Batch 3:

- `node scripts\check-js-syntax.js` passed: 115 JavaScript files.
- `node scripts\validate-dashboard.js` passed: 93/93.
- `node scripts\verify-dashboard-rollout.js` passed.
- `node scripts\verify-dashboard-net-orders.js` passed.
- `node scripts\verify-dashboard-query-service.js` passed.
- `node scripts\verify-dashboard-query-khod-flags.js` passed.

Remaining work:

- Visual QA is still required in the running Electron app.
- Because this workspace is not a git repository, use the recovery logs and file timestamps/checkpoints instead of `git diff`.

## Recovery Log: 2026-07-04 Batch 4

Question being answered:

- Are Section 3, Section 5, all dashboard sections, speed, preloader, and anti-flicker behavior fully back?

Completed:

- Restored the remaining dashboard pane anti-flicker/performance guardrails.
  - `src/renderer/pages/dashboard/dashboard-shell.js`
  - Raised `DASHBOARD_PANE_CACHE_LIMIT` from `6` to `8`.
  - Added `pipeline: true` and `orders: true` to cached dashboard sections.
  - This keeps Section 2 and Section 3 panes warm while switching sections.

- Restored cleanup hooks for cached Pipeline and Orders panes.
  - `src/renderer/pages/dashboard/sections/section2-pipeline.js`
  - `src/renderer/pages/dashboard/sections/section3-orders.js`
  - Both sections now register `_dashboardSectionCleanup` to disconnect their theme observers when the shell destroys cached panes.

- Confirmed Section 8 detail cards are still built in the initial render pass.
  - `src/renderer/pages/dashboard/sections/section8-master.js`
  - The verifier now enforces the no-lazy-detail-rerender shape again.

- Removed a Products query hot-loop cost.
  - `src/main/dashboard-query-service.js`
  - Product name overrides are sanitized once per Products query instead of once per row.
  - This fixed the synthetic 15k-row Products query crossing the 300ms guard on this machine.

Verification completed after Batch 4:

- `node scripts\check-js-syntax.js` passed: 115 JavaScript files.
- `node scripts\validate-dashboard.js` passed: 93/93.
- `node scripts\verify-dashboard-rollout.js` passed.
- `node scripts\verify-dashboard-net-orders.js` passed.
- `node scripts\verify-dashboard-query-service.js` passed.
- `node scripts\verify-dashboard-query-khod-flags.js` passed when run alone.
- `npm.cmd run verify:dashboard-speed` passed: 8 checks.
- `npm.cmd run verify:gmv-target` passed: 21 checks.
- `npm.cmd run verify:best-ndr-cycle` passed: 20 checks.

Timing note:

- `verify-dashboard-query-service.js` and `verify-dashboard-query-khod-flags.js` have very tight 300ms first-query assertions.
- They can fail if multiple Node verifiers are run in parallel.
- Measured alone after the hot-loop fix:
  - Orders query: about 275ms.
  - Products query: about 174ms.
  - Campaigns query: about 44ms.
  - Campaign overview first build: about 222ms.
  - Campaign overview cached: 0ms.

Confirmation verifier note:

- `npm.cmd run verify:dashboard:confirmation` is not a clean signal yet.
- The verifier expects a root fixture named `new may orders-.xlsx` with hardcoded KHOD May counts:
  - raw orders: 1306,
  - net orders: 1163,
  - confirmed/progressed orders: 677.
- That exact KHOD fixture was not found under the current workspace or old KHOD root.
- A Taager reference copy exists at:
  - `F:\code\khod-bot2\khod-order-bot\taager clone from khod whaat\new may orders-.xlsx`
- Copying that Taager fixture into this workspace lets the verifier start, but it parses 1347 rows and fails the hardcoded KHOD count assertion.
- Treat this as a missing/wrong test fixture, not proof that dashboard confirmation logic is broken.

Remaining work:

- Visual QA is still required in the running Electron app before saying “no flicker/no visual issue/no missing section” with full confidence.
- Specific visual checks:
  - dashboard staged preloader appears,
  - dashboard transitions do not blank/flicker after load,
  - Section 3 renders and filters without backend-query flag errors,
  - Section 5 products render with correct KPI/status breakdowns,
  - Section 8 does not show the wrong Karachi/obsolete KPI,
  - GMV Target and Order Sources are visible and load,
  - marketing/ROI loading states do not cause layout jumps.

## Recovery Log: 2026-07-04 Batch 5 Correction

User correction:

- The Batch 2/4 recovery overfit to Taager donor features.
- KHOD should not expose a dashboard section called Order Sources.
- Section 8 must follow the packaged/migrated KHOD dashboard semantics, not Taager profit-after-tax cards.
- Best NDR needed visual polish.

Completed:

- Restored Section 8 from the packaged KHOD baseline:
  - `.codex-tmp\asar-recovery-20260625\src\renderer\pages\dashboard\sections\section8-master.js`
  - copied into `src\renderer\pages\dashboard\sections\section8-master.js`.

- Applied migration-note wording cleanup on top of that baseline:
  - `Net Orders` summary label changed to `Total Orders`.
  - `Commission Return` changed to `Total Revenue`.
  - `Net Commission Return` changed to `Net Profit`.
  - Section 8 now uses KHOD status ordering/wording:
    Pending, Confirmed, Under processing, Waiting, In shipping, Delivered, Failed, Canceled.

- Removed the dashboard Order Sources route:
  - `src\renderer\app.js`
  - `src\renderer\pages\dashboard\dashboard-shell.js`
  - `src\renderer\pages\dashboard\dashboard.js`
  - `src\renderer\pages\dashboard\locales\en\dashboard-locale.js`
  - `src\renderer\pages\dashboard\locales\ar\dashboard-locale.js`
  - Removed the lazy feature bundle/style mapping, sidebar item, section renderer mapping, cacheable entry, and dashboard data mapping.

- Renamed the remaining non-dashboard results label:
  - `results.order_sources` now displays as `Upload Summary` / `ملخص الرفع`.

- Cleaned visible KHOD product status wording:
  - `products.canceledOrders` and `products.funnelCanceled` now display `Canceled`, not `Canceled by you`.

- Polished Best NDR toolbar/panel CSS:
  - `src\renderer\pages\dashboard\dashboard-styles.css`
  - More compact toolbar control, clearer icon block, improved panel metrics/actions, and cleaner hover/focus visuals.

Verification completed after Batch 5:

- `node scripts\check-js-syntax.js` passed: 115 JavaScript files.
- `node scripts\validate-dashboard.js` passed: 93/93.
- `node scripts\verify-dashboard-net-orders.js` passed.
- Targeted visible scan returned no matches in app/dashboard shell/dashboard data/locales/Section 8 for:
  - `Order Sources`
  - `nav.orderSources`
  - `dashboardOrderSources`
  - `renderSectionOrderSources`
  - `Profit After Tax`
  - `Total / Net`
  - `Net Orders`
  - `Commission Return`
  - `Net Commission Return`
  - `Canceled by you`
  - `Karachi`
  - `Bending`

Important correction for future agents:

- Do not re-add Order Sources as a KHOD dashboard section unless the user explicitly asks for it.
- Do not replace KHOD Section 8 with the Taager donor version.
- If using Taager donor code for architecture, adapt visible cards/statuses/financial meaning back to KHOD migration notes first.
