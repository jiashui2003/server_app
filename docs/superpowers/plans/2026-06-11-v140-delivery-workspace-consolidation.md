# ServerLens 14.0 Delivery Workspace Consolidation Plan

- [x] Upgrade package metadata to `14.0.0`.
- [x] Fold the separate Inspection / Strategy / Release views into one tabbed `delivery-view`.
- [x] Collapse three sidebar nav entries (Inspection, Strategy, Release) into one "Delivery" entry.
- [x] Add Inspect / Validate / Handoff tab bar; keep every panel's DOM ids, render functions, and `/api/delivery/*` data sources unchanged.
- [x] Route old view names (`inspection` / `strategy` / `release`) through `setView` to the delivery view + matching tab so existing commands, page-experience actions, and release cards keep working.
- [x] Keep the Interaction Studio / Experience Deck / Scenario Board / Action Dock / Focus Peek surfaces unchanged (conservative scope chosen by the user).
- [x] Update gate scripts (`build-check.js`, `ui-contract.test.js`, `runtime-smoke.js`, `ui-visual-evidence.js`) to navigate via the Delivery nav entry and delivery tabs.
- [x] Run source tests, build, runtime smoke, UI evidence, and delivery validation.

## Scope decision

The user chose the conservative consolidation: only the three delivery-capability surfaces (Inspection, Release, Strategy) are merged into one tabbed Delivery Workspace. The demonstration surfaces (Interaction Studio, Experience Deck, Scenario Board, Action Dock, Focus Peek) are left in place for this version. Panel ids and render functions are preserved so the change is navigation/IA only, not a rewrite of the workspace internals.

## Gate-assertion note

The plan originally proposed reducing the build-check token assertions. After review they are kept: the token scan is the primary regression guard for a no-bundler frontend and the only desktop session available runs `runtime:smoke` in static-fallback mode, so the static token coverage remains valuable. The assertions were updated (not weakened) to match the consolidated structure. The `page-readiness` model still lists the three delivery surfaces as distinct pages; they are now reached via tabs rather than separate nav entries.
