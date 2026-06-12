# ServerLens 12.0 Honest Metric History Plan

- [x] Upgrade package metadata to `12.0.0`.
- [x] Add an append-only `snapshot_history` table and in-memory history map keyed by serverId.
- [x] `saveSnapshot` updates the latest snapshot and appends real history; add `listSnapshotHistory(serverId, limit)`.
- [x] Load snapshot history on startup; prune it in `runRetentionMaintenance` (keep latest + within window).
- [x] Remove the `Math.sin()` fabricated `buildTrends`; compute trends from real snapshot history.
- [x] Flag `insufficient-history` honestly when fewer than 3 snapshots exist; never synthesize points.
- [x] Thread history into `analyzeSnapshot` from the analyze route and demo seeding.
- [x] Frontend `renderPerformancePanel` and `renderTimeline` read real series; show "collect more" placeholder instead of fake curves.
- [x] Add `tests/snapshot-history.test.js`; update trend-shape and version-target assertions.
- [x] Update DESIGN.md, README.md, ARCHITECTURE.md for honest metric history.
- [ ] Run source tests, build, runtime smoke, UI evidence, and delivery validation.
- [ ] Sync the final 12.0 package and validate the releasable mirror.
