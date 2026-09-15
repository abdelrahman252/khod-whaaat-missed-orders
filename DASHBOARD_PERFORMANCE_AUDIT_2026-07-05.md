# KHOD Dashboard Performance Audit — 2026-07-05

## Scope and donor

- Target: `F:\code\khod-bot2\khod-from-taager`
- Taager donor: `F:\code\khod-bot2\khod-order-bot\taager clone from khod whaat`
- KHOD status, order identity, commission, DR/NDR, COD, and Section 8 rules remained authoritative.

## Existing architecture confirmed

- The dashboard route already avoids the generic loader handoff.
- Warm reopen already skips aggregation and runs marketing sync only.
- Main/preload already expose object, JSON, and gzip snapshot APIs with revision checks and transport cache timings.
- Dashboard-level aggregation requests were already shared by scope.
- Section pane caching, cleanup lifecycle hooks, lazy hydrated bundles, and query shadow mode already existed.

## Implemented

- Aggregator snapshot priority: gzip -> JSON -> object.
- Shared in-flight snapshot request deduplication.
- Stale aggregation request cancellation.
- Aggregation timings for snapshot IPC/transfer/decompression/parse, row scoping, reporting-row preparation, and snapshot processing.
- Snapshot transport metadata on the aggregation result.
- Query timeout handling and incomplete-scope fallback to legacy dashboard data.
- Shell render-phase timings for render body, query observation, section change, i18n, UI enhancement, and theme fix.
- First-render and same-section-refresh entrance suppression.
- In-place reporting-row enrichment and allocation-free account row collection.
- Account option counts now consolidate order rows once, then apply the selected period.
- Static architecture checks cover the restored performance contracts.

## Runtime results

### 20-order smoke

- PASS
- Initial mount: 2,041 ms
- Aggregation: 350 ms
- Snapshot transport: gzip binary

### 5K fixture

- PASS (all existing thresholds)
- Initial mount: 2,835 ms
- Aggregation: 1,382 ms
- Process snapshot rows: 855 ms
- Orders visible: 83 ms
- Products visible: 246 ms
- Cities visible: 423 ms

### 15K fixture

- Section rendering and interaction checks pass.
- Initial mount improved from 7,961 ms before the allocation changes to 6,069 ms.
- Aggregation: 4,701 ms; existing threshold is 2,500 ms.
- Process snapshot rows: 3,010 ms.
- Orders visible: 118 ms; Products: 303 ms; Cities: 530 ms.

The donor's recursive lazy Cities/Products model pattern was tested but not retained. KHOD's initial Master section immediately consumes those models, causing a second full aggregation pass and worsening true cold-open time even though the isolated aggregation metric appeared smaller.

## Verification

Passing:

- `node scripts\check-js-syntax.js`
- `node scripts\validate-dashboard.js`
- `node scripts\verify-performance-architecture.js`
- `node scripts\qa-dashboard-performance-static.js`
- `node scripts\verify-dashboard-speed-followup.js`
- `node scripts\verify-dashboard-query-service.js`
- `node scripts\verify-dashboard-query-khod-flags.js`
- 20-order and 5K Electron performance harnesses

Known test debt observed during the audit:

- `verify-dashboard-net-orders.js` still scans the lightweight Calculator wrapper for a symbol now located in the hydrated implementation.
- `verify-dashboard-confirmation-logic.js` has a stale May raw-order fixture expectation.

## Remaining bottleneck

The 15K path is computation-bound in `processSnapshotRows`, not transport- or section-render-bound. A further reduction requires splitting the Master section's heavy detail cards from its first usable KPI paint, or building shared city/product indices once in the main process. Copying Taager formulas or adding another renderer-wide recursive pass is not recommended.
