# ServerLens 16.0 — Ecosystem Real-Time Visualization (subtraction + real data)

## Context

Earlier versions left an Interaction Studio cluster whose Experience Deck (motion
intensity / card density / presentation toggle) and Scenario Board (five cards
overlapping Command Center) were decorative or duplicate — and `renderLiveMonitor`
still used a `Math.sin()` `performanceBars` sweep, the last fabricated
visualization missed by 12.0's trend cleanup. There was also no cross-server
fleet view; every visualization was single-server.

16.0 removes the decorative/duplicate parts and reshapes the freed space into a
real, telemetry-driven **Ecosystem** dashboard, continuing the v11→v14 theme of
replacing fake/duplicate surfaces with real ones.

## What changed

### Backend
- Reused the pure aggregator `src/shared/ecosystem-overview.js`
  (`buildEcosystemOverview`) + `analysis-engine.js` `inferServiceRole` export.
- Added `GET /api/ecosystem/overview` in `src/server/app.js`
  (`buildEcosystemForStore`): reads `listServers()` + `listSnapshotHistory(id)`,
  returns aggregated JSON. Pure read — no collection, no outbound calls, no
  secrets (the function guarantees this).

### Frontend
- Sidebar `Studio` → `Ecosystem` (`data-view="ecosystem"`); `#interaction-view`
  → `#ecosystem-view` with six panels: `#eco-resource`, `#eco-services`,
  `#eco-containers`, `#eco-exposure`, `#eco-risk`, `#eco-freshness`.
- `renderEcosystem(overview)` renders the six dimensions; `refresh()` pulls the
  endpoint into `state.ecosystem` so it auto-refreshes on the existing poll loop.
  `insufficient-history` shows an explicit placeholder — no fake lines (12.0
  honesty contract).
- Removed `renderExperienceDeck`, `renderScenarioBoard`, and their state, events,
  constants, and `1-5` shortcuts.
- Retained (operator value): Action Dock, Focus Peek, Command Center, and the
  tactile navigation rail (folded into the Ecosystem view top as quick-nav).
- Fixed the fabricated sweep: `renderLiveMonitor` now uses the real fleet trend;
  `performanceBars`/`monitorTick` deleted.

### Gates
- Synced `scripts/build-check.js`, `tests/ui-contract.test.js`,
  `scripts/runtime-smoke.js`, `scripts/ui-visual-evidence.js`: removed
  Experience Deck / Scenario Board tokens, ids, clicks, assertions; added the
  Ecosystem view contracts (six panel ids, `/api/ecosystem/overview`,
  `renderEcosystem`, `state.ecosystem`). `ui-visual-evidence` page loop
  `interaction` → `ecosystem`.

### Tests
- `tests/ecosystem-overview.test.js`: multi-server aggregation, honest
  `insufficient-history`, no-secrets, empty-fleet safety.
- `tests/api.test.js`: `/api/ecosystem/overview` route (200 + structure).

### Version & docs
- 16.0.0 across package.json, desktop-package test, commercial-readiness
  versionTarget, delivery-evidence versionTarget, index.html version chips,
  DESIGN.md title. README Ecosystem usage bullet + Version History row.
  ARCHITECTURE ecosystem constraint (pure aggregation / no collection / no
  secrets).

## Decisions (user-confirmed)
- Tactile navigation cards: **kept**, folded into the Ecosystem view top.
- Action Dock + Focus Peek: **kept** (real operator entry points, not decoration).
- Removed only Experience Deck (motion/density/presentation toy) and Scenario
  Board (duplicate of Command Center).

## Verification
- `npm.cmd test` — ecosystem pure-function + route tests pass.
- `npm.cmd run build` — aggregate token scan passes.
- `npm.cmd run delivery:validate` — must be `ready` 6/0, with `ui:evidence`
  rendering the Ecosystem view in a real browser and capturing two screenshots
  as the regression backstop after removing UI and wiring the new data flow.
