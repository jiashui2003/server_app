# ServerLens 6.0 iOS + shadcn/Konsta Redesign Roadmap

## Goal

Replace the prior product workbench with a quieter iOS-style operations surface based on shadcn control discipline and Konsta iOS touch rhythm.

## Reference Basis

- shadcn/ui local repository: `references/github-v60/shadcn-ui`
- Konsta local repository: `references/github-v60/konsta`
- Reference summary: `docs/reference-notes.md`

## Delivery Contract

- Version target: `6.0.0`
- Handoff target: `dist/handoff/ServerLens-6.0.0`
- UI contracts: `v6-ios-shell`, `ios-toolbar`, `ios-badge`, `ios-panel`, `ios-list`, `ios-meter`, `ios-field`, `ios-input`, `ios-select`, `ios-switch`, `ios-button`, `ios-segment`, and `ios-sheet`
- Interaction contract: explicit actions only; iOS pressed states, grouped lists, and sheets do not execute hidden server operations.

## Acceptance

- `package.json` version is `6.0.0`.
- `references/github-v60/shadcn-ui` and `references/github-v60/konsta` exist locally.
- `docs/reference-notes.md` documents shadcn/ui and Konsta as the current 6.0 references.
- `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run delivery:validate` pass.
- `D:\vibe-server-status-app\dist\handoff\ServerLens-6.0.0\app\ServerLens.exe` exists after sync and validation.
