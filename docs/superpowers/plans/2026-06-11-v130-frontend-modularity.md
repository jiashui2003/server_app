# ServerLens 13.0 Frontend Modularity & Test Coverage Plan

- [x] Upgrade package metadata to `13.0.0`.
- [x] Extract DOM-free logic from `public/app.js` into native ESM under `public/js/`:
  - [x] `public/js/format.js` — escapeHtml, formatTime, formatDate, signed, pressureClass, clampPercent, labelForStatus.
  - [x] `public/js/commands.js` — filterCommands, clampActiveIndex, wrapActiveIndex.
  - [x] `public/js/page-model.js` — viewTitles, pageExperienceModel, moduleLabels.
- [x] Import the modules into `public/app.js` and remove the inlined duplicates (behavior unchanged, no build step).
- [x] Add `tests/frontend-units.test.js` importing the pure modules directly.
- [x] Update `scripts/build-check.js` and `tests/ui-contract.test.js` to scan `public/app.js` plus every `public/js/**` module as one aggregate so contract tokens stay verified.
- [x] Run source tests, build, runtime smoke, UI evidence, and delivery validation.

## Notes

This version deliberately avoids a full view-by-view rewrite of `app.js` (high regression risk without a browser harness). It extracts only genuinely pure, DOM-free logic that can be unit-tested in `node:test`, which is the highest-value, lowest-risk slice of modularity. Larger structural splits remain possible in a later iteration once a browser-level UI test harness exists.

## Verification

- `npm.cmd test`: full unit + contract + frontend-unit suite green.
- `npm.cmd run build`: aggregate scanner finds all contract tokens.
- `npm.cmd run runtime:smoke`: UI shell contracts intact (static-fallback on this host).
- `npm.cmd run ui:evidence`: real render confirms the ESM modules load in a browser.
- `npm.cmd run delivery:validate`: `ready`, 0 fail, handoff `dist/handoff/ServerLens-13.0.0`.
