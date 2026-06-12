# ServerLens 6.0 iOS + shadcn/Konsta Redesign Fast-Forward Note

## References

- shadcn/ui local repository: `references/github-v60/shadcn-ui`
- Konsta local repository: `references/github-v60/konsta`

## Changes

- Upgraded package version to `6.0.0`.
- Replaced `DESIGN.md` with the ServerLens 6.0 iOS product surface context.
- Added `v6-ios-shell`, `ios-toolbar`, `ios-badge`, `ios-panel`, `ios-list`, `ios-meter`, `ios-field`, `ios-input`, `ios-select`, `ios-switch`, `ios-button`, `ios-segment`, and `ios-sheet` contracts.
- Reduced visible helper copy in the app shell and section headers.
- Updated delivery evidence and readiness checks to require the 6.0 visual system and current references.
- Updated sync script to copy only v60 CodeStable records and `references/github-v60/shadcn-ui`, `references/github-v60/konsta`.

## Verification

- Source `npm.cmd test`: 54 pass, 0 fail.
- Source `npm.cmd run build`: passed.
- Source `npm.cmd run delivery:validate`: `ready`, 6 pass, 0 warn, 0 fail, handoff `dist\handoff\ServerLens-6.0.0`.
- D-drive `npm.cmd run delivery:validate`: `ready`, 6 pass, 0 warn, 0 fail, handoff `D:\vibe-server-status-app\dist\handoff\ServerLens-6.0.0`.
- D-drive handoff executable: `D:\vibe-server-status-app\dist\handoff\ServerLens-6.0.0\app\ServerLens.exe`.
