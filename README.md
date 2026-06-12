# ServerLens

ServerLens is a macOS-style server status and risk analysis app for authorized infrastructure. It shows server health, runtime state, exposed services, security signals, custom analysis modules, and delivery reports.

## Run

```powershell
npm.cmd start
```

Open `http://localhost:4173`.

The local server persists data to `data\serverlens.sqlite` by default. Override the database path for staging or handoff tests with:

```powershell
$env:SERVERLENS_DB_PATH="D:\serverlens-data\serverlens.sqlite"
npm.cmd start
```

Source-mode persistence uses Node's built-in SQLite runtime, so development and command-line runs require Node `>=24.0.0`. The packaged desktop app stores its database as `serverlens.sqlite` in Electron's per-user `userData` directory.

## Local Security Hardening (11.0)

ServerLens 11.0 hardens the local runtime without breaking zero-config demo use:

- **Loopback by default.** The HTTP server binds to `127.0.0.1`, so the API is not reachable from other machines on the network. Override only when you intentionally need LAN access:

  ```powershell
  $env:SERVERLENS_BIND_HOST="0.0.0.0"
  npm.cmd start
  ```

- **Optional API token.** When `SERVERLENS_API_TOKEN` is set, write operations (`POST`/`PUT`/`PATCH`/`DELETE` on `/api/*`) require an `Authorization: Bearer <token>` header. Reads stay open for local UI rendering. Unset by default so demo mode runs with no configuration:

  ```powershell
  $env:SERVERLENS_API_TOKEN="choose-a-local-token"
  npm.cmd start
  ```

- **Optional encrypted credentials.** When `SERVERLENS_CRED_KEY` is set, sensitive SSH metadata (such as the key path) is stored as an AES-256-GCM envelope at rest instead of plaintext. Without the key the store keeps the prior plaintext-metadata behavior. The same key must be present on restart to decrypt:

  ```powershell
  $env:SERVERLENS_CRED_KEY="a-local-secret"
  npm.cmd start
  ```

- **Identifiers** use `node:crypto` (UUID / random suffixes) and a monotonic counter, so server and job ids stay unique and are never reused after retention deletes.
- **Request bodies** over 256KB are rejected with `413`, and malformed JSON returns `400`.

## Honest Metric History (12.0)

ServerLens 12.0 removes the simulated trend curves used in earlier builds and charts only real collected data:

- Each `Collect` appends a snapshot to a per-server `snapshot_history` table; the latest snapshot is still kept for quick access.
- Performance charts and the overview CPU timeline render the real collected series. Before `3` collections exist they show an explicit "trends appear after N collections" placeholder instead of a fabricated sine-wave curve.
- `report.trends` carries `status` (`ready` / `insufficient-history`), `dataPoints`, and the real per-metric arrays so the UI cannot present simulated history as real.
- Retention maintenance prunes snapshot history outside the configured window while preserving each server's latest snapshot.

## Frontend Architecture (13.0)

ServerLens 13.0 extracts the DOM-free logic out of the single `public/app.js` file into native ES modules under `public/js/`, with no build step:

- `public/js/format.js` — formatting and presentation helpers (`escapeHtml`, `formatTime`, `formatDate`, `signed`, `pressureClass`, `clampPercent`, `labelForStatus`).
- `public/js/commands.js` — pure command-palette filtering and active-index helpers.
- `public/js/page-model.js` — the page-experience data model (`viewTitles`, `pageExperienceModel`, `moduleLabels`).
- `public/app.js` imports these modules via `<script type="module">`; behavior is unchanged.
- These pure modules are unit-tested directly in `tests/frontend-units.test.js` (no browser runtime required). The build check and UI contract scan read `public/app.js` plus every module under `public/js/` as one aggregate so contract tokens stay verified after extraction.

## Delivery Workspace (14.0)

ServerLens 14.0 consolidates the three separate delivery-review views (Inspection, Strategy, Release) into a single **Delivery** workspace with three tabs, so operators find every handoff-review surface in one place instead of three sidebar entries:

- **Inspect** — the authorized inspection step flow (`/api/delivery/inspection`).
- **Validate** — the release readiness gate, review queue, reference basis, and safety ledger (`/api/delivery/readiness`).
- **Handoff** — the 10-cycle strategy iteration evidence (`/api/delivery/strategy`).
- Every panel, data source, and copy action is preserved; only the navigation and view container changed. The Interaction Studio (tactile cards, Experience Deck, Scenario Board, Action Dock, Focus Peek) is unchanged in this release.
- Existing commands and page actions that targeted the old `inspection`/`strategy`/`release` views still resolve — `setView` routes them to the Delivery workspace and selects the matching tab.

## Accessibility & Optional Delivery (15.0)

ServerLens 15.0 adds accessibility polish and two operator-gated delivery extensions that stay off by default:

- **Accessibility**: a skip link to `#main-content`, a real ARIA tab set for the Delivery workspace (`role="tablist"/"tab"/"tabpanel"` with `aria-selected`/`aria-controls`), `aria-current` on the active navigation item, `aria-live="polite"` on dynamic status surfaces (live monitor, page operation summary, freshness label), visible `:focus-visible` outlines, and an expanded `prefers-reduced-motion` rule that disables view, card, and rail animations.
- **Optional webhook notifications (planned extension, default OFF)**: Settings exposes an outbound webhook for local alerts. It is double-gated — it sends only when `localOnly` is explicitly set to false **and** the webhook is enabled with a valid `https` URL. The payload is redacted metadata (id, severity, category, title) — never raw logs, secrets, or credentials. With the defaults (`localOnly: true`), no outbound connection is ever opened. See `src/server/webhook-notifier.js`.
- **Optional signed installer (planned extension, default OFF)**: `scripts/package-desktop.js` signs `ServerLens.exe` with Windows Authenticode only when `SERVERLENS_SIGN_CERT` (and optional `SERVERLENS_SIGN_PASSWORD` / `SERVERLENS_SIGN_TIMESTAMP_URL`) are supplied. Without them, packaging falls back to the unsigned `dir` target so demo/handoff builds work with zero signing infrastructure. A signing attempt never aborts packaging.

## Test

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run runtime:smoke
```

`runtime:smoke` starts the local API and attempts to verify the rendered app through a hidden Electron window. If the host session cannot support Electron `loadURL`, the command falls back to local API, HTML, CSS, and JS contract checks and reports `mode: "static-fallback"` in its output.

## Current Capabilities

- Demo fleet with multiple servers.
- Server inventory with add/edit/archive/restore workflow, host, port, authentication type, collection mode, SSH metadata, group, parsed tags, staged connection diagnostics, and safe connection-test status.
- Connection Health Map in Servers, with ready/auth/blocked/untested counts, per-server connection nodes, TCP and SSH authentication stages, and operator next actions for key or agent fixes.
- Inventory transfer with sanitized JSON export/import for handoff migration, backup, and repeatable client setup.
- Server collection modes for demo, local, and authorized SSH agent/key telemetry. SSH collection stores username/key path metadata only and does not store passwords.
- CPU, memory, disk capacity, disk IO, iowait, ports, services, containers, firewall posture, and security-event snapshots.
- Server Detail performance panel with compact CPU, memory, disk capacity, disk IO, and network charts for immediate pressure scanning. Charts are driven by real collected snapshot history; before enough collections exist, the panel shows a "collecting" placeholder instead of a simulated curve.
- Server Detail security events panel for SSH failures, authentication failures, high-risk exposed ports, error-log pressure, and repeated remote connection evidence.
- Risk Event Timeline that groups authorized evidence from SSH failures, authentication failures, repeated remote connections, high-risk public ports, unknown listeners, and error bursts into a local security-review sequence.
- Security Source Review that summarizes collected authentication and repeated-connection sources, ports, signals, evidence, and defensive review actions without attribution or enrichment.
- Redacted Evidence Appendix that lists finding evidence, source modules, related diagnostic commands, and redaction policy for commercial report review.
- Selectable analysis modules: health, security, runtime, ecosystem, logs, network, performance.
- Analysis presets for repeated delivery workflows: Full Report, Security Review, Runtime Health, Service Ecosystem, plus Custom for manual module selection.
- Network analysis detects high-risk public ports, broad public exposure, and unknown public listener ownership from collected port data.
- Analysis run controls for target server, time range, Quick/Standard/Deep depth, plus Page, Markdown, or PDF handoff output behavior.
- Preset controls apply module, depth, and time-range combinations in one click. Manual edits to modules, time range, or depth return the run to Custom so the displayed scope stays honest.
- Evidence-backed findings with severity, recommendations, and defensive diagnostic commands, including disk IO pressure checks for elevated iowait or heavy read/write throughput.
- Report-level Remediation Checklist that turns findings into phased local actions with owner hints, evidence, diagnostic commands, and acceptance criteria for handoff review.
- Server Runbook Markdown export for the selected server, combining asset metadata, latest snapshot, latest report, topology map summary, service catalog, remediation checklist, diagnostic commands, and safety boundary notes.
- Service topology mapping from authorized snapshot data: server to services, listening ports, containers, and topology risks, with a compact local topology map in Server Detail.
- Service Catalog in Server Detail and exports, classifying observed services into roles such as web proxy, database, cache, application, remote access, and container workload with health, exposure, backing owner, risks, and operator recommendations.
- SQLite-backed local persistence for servers, snapshots, reports, analysis jobs, local alerts, and settings.
- Fleet health ranking, recent alerts, task progress, server detail, process/log views, settings, alert inbox, and report view.
- Command Center for quick keyboard/button access to navigation, server detail, telemetry collection, analysis runs, and report handoff actions.
- Server detail runtime inventory panels for containers, listening ports, and firewall status so operators can inspect exposed surfaces before acting on findings.
- Local Alert Inbox created from critical/high report findings, with evidence, recommendation, unread/acknowledged state, and restart-safe persistence.
- Local delivery settings for thresholds, report retention days, local-only alerts, alert inbox enablement, alert severity rules, and AI summary enablement.
- Local Executive Summary for reports when AI summary is enabled, generated from rule evidence without calling external AI services.
- Retention Maintenance in Settings and Command Center, with explicit cleanup of expired report, job, and alert history while preserving each server's current evidence.
- Reports Center with clickable report history, analysis scope, score/finding trends, current-vs-previous comparison, and selected-report focus state.
- Local Status Page Preview in Reports Center and `/api/status-page`, with redacted service state and unacknowledged incident summaries for handoff review.
- Markdown report export and print-ready PDF handoff flow for delivery reports, including topology map summary, risk event timeline, security source review, redacted evidence appendix, and finding-level command sections.
- Delivery Evidence manifest in Settings and `/api/delivery/evidence`, listing package path, verification commands, referenced GitHub projects, capability scope, and local safety boundary for handoff review.
- Delivery Readiness Gate in Settings and `/api/delivery/readiness`, with categorized pass/fail checks for verification commands, packaging, GitHub references, safety boundary, commercial capabilities, and product UI contract.
- UI Experience Audit in Settings, `/api/delivery/ui-audit`, and offline `delivery-evidence.json`, summarizing material, scrolling, control, responsive, and runtime-smoke UI evidence for commercial design review.
- First-run Handoff Checklist in Settings, Command Center, and `/api/delivery/checklist`, turning demo fleet, latest report, Markdown/PDF exports, server runbook, readiness, package, validation, and safety checks into actionable client review steps.
- Release Readiness Workspace for ServerLens 9.0, with Operator, Client Handoff, and Incident Review modes, readiness cards, review queue, RetroUI reference basis, and local safety ledger.
- Interaction Studio for ServerLens 9.0, with tactile cards, horizontal swipe rail, Touch Queue, Experience Deck, Action Dock bottom sheet, compact/expanded dock states, and Focus Peek context panel.
- Authorized Inspection Workspace for ServerLens 3.0, with guided Authorize, Preflight, Collect, Analyze, and Package steps, local evidence status, and copyable client-review summary.
- Strategy Iteration Workspace for ServerLens 9.0, with ten visible planning cycles, plan/execution/validation/evidence fields, concise reference basis, copyable strategy summary, and package handoff status.
- ServerLens 9.0 RetroUI Card clarity redesign, with black-border cards, hard offset shadows, flat high-contrast surfaces, compact copy, live local polling, scroll-safe views, wrapped evidence text, and explicit operator actions.
- Runtime Smoke verifier through `npm.cmd run runtime:smoke`, covering local API availability, UI shell contracts, scroll/material tokens, Readiness Gate, and Command Center readiness action; it attempts Electron rendering first and reports fallback mode when the host blocks hidden rendering.
- UI Visual Evidence through `npm.cmd run ui:evidence`, capturing desktop/mobile screenshots and basic pixel/layout checks with Playwright. It can use the installed system Chrome when Playwright's bundled Chromium is not present, then falls back to Electron rendering and installed Edge/Chrome system-browser capture, or writes a clear blocked evidence file when this host cannot render screenshots.
- Delivery Validation Ledger through `npm.cmd run delivery:validate`, running the commercial verification sequence and writing `delivery-validation.json` with command-level pass/warn/fail evidence.
- RetroUI-inspired product interface with bold cards, semantic status components, compact controls, fixed product typography, focus states, and skeleton loading states.
- Keyboard-friendly operator workflow with Ctrl/Cmd+K quick actions, stable focus states, and contained scroll surfaces for long server/report lists.

## Delivery Notes

This build intentionally avoids offensive scanning. Security analysis is based on owned telemetry such as failed logins, suspicious connection counts, exposed ports, service state, and container restarts.

Security event views show collected evidence and severity labels. They do not claim attribution or perform active countermeasures.

Risk Event Timeline is local and evidence-backed. It groups collected signals into reviewable events, but it does not perform attribution, enrichment, scanning, blocking, or remote response.

Security Source Review is also local and evidence-backed. It summarizes collected authentication failure counts and repeated remote connection records so operators can compare sources with allowlists and logs; it does not attribute activity, enrich IP addresses, block traffic, scan networks, or modify servers.

Evidence Appendix is a redacted report ledger. It includes metadata and rule evidence only, and excludes passwords, private keys, raw logs, secret values, and collected telemetry payloads.

Unknown listener detection is passive and evidence-based. It only evaluates already collected listening-port records and flags public listeners with missing, placeholder, PID-only, or temporary-looking process ownership.

Analysis presets are local scope shortcuts. They do not trigger hidden scans, network discovery, external enrichment, or AI calls; they only choose which existing ServerLens modules run for the selected server.

Finding commands are diagnostic and defensive. They are intended to help authorized operators inspect logs, services, ports, containers, disk pressure, and runtime state before making changes.

Remediation Checklist is generated locally from existing findings. It does not execute fixes, change remote hosts, approve exposure, or call external services; it gives authorized operators a review order, evidence, commands, owner hints, and acceptance criteria.

Server Runbook export is a local Markdown handoff artifact. It summarizes authorized metadata, topology map counts, and evidence for the selected server, excludes secrets, and does not execute diagnostic commands.

Disk IO analysis is passive. SSH collection uses available local telemetry commands such as `iostat` and `vmstat` when present, falls back to zero when unavailable, and never runs write benchmarks or stress tests.

Connection testing is defensive and explicit. Demo servers do not open external network connections; non-demo assets use a short TCP reachability check only for the configured host and port. SSH assets also run a BatchMode authentication probe against the configured account so operators can distinguish "port reachable" from "SSH key or agent not accepted" before collection.

Connection Health Map is a local setup aid. It summarizes ready, authentication-failed, blocked, and untested assets, then shows TCP and SSH authentication stages plus next actions such as adding a key to the local agent, switching to SSH key mode, or checking `authorized_keys`. It does not store passwords, try credential lists, scan adjacent hosts, or keep a persistent SSH session open.

Server edits reset stale connection status when endpoint or authentication metadata changes, so operators do not keep trusting a connectivity result from a previous asset definition.

Server archive is reversible and audit-preserving. Archived assets are hidden from the default operational fleet list and cannot be connection-tested, collected, or analyzed until restored, while their details, reports, and evidence remain available for review.

Inventory export/import is metadata-only. It includes server names, hosts, ports, auth mode metadata, groups, tags, and archive state; it excludes passwords, snapshots, reports, alerts, logs, and collected telemetry payloads.

SSH collection is explicit and agentless. It uses the system `ssh` command with BatchMode against the configured host, port, optional username, and optional key path. It also passively summarizes established remote connections from local `ss` output for source review. It does not save passwords, try credential lists, scan adjacent hosts, enrich IPs, or discover new targets.

Service topology and topology map summaries are derived only from collected snapshot fields such as services, listening ports, containers, and findings. They do not perform hidden network discovery.

Service Catalog is also passive. It groups already collected services, ports, containers, and findings into operational roles so users can review the service ecosystem without running discovery scans or probing adjacent hosts.

PDF export uses a print-ready local report route and the operating system/browser print dialog. This keeps the desktop delivery offline-friendly while still producing client-ready PDF files through "Save as PDF".

AI summary is implemented as a local/offline executive summary. When enabled, reports include a rule-generated headline, overview, key risks, next actions, and evidence notes. It does not call external AI services in this build.

Local Alert Inbox is also offline-only. It turns selected report findings into local notifications and persists acknowledgement state in SQLite. It does not send email, webhook, push, SMS, or public status-page updates in this build.

Retention Maintenance is explicit and local. It uses the configured retention window to delete expired report history, analysis jobs, and alert inbox entries, while preserving the latest report and current snapshot for each server so the active workspace remains usable after cleanup.

Status Page Preview is a local read-only summary. It redacts hostnames, SSH usernames, key paths, connection state, snapshots, and raw telemetry while showing service names, grouped status, scores, and unacknowledged incident titles.

Delivery Evidence manifest is generated locally and summarizes handoff facts only. It does not include secrets, raw logs, private keys, passwords, or collected telemetry payloads.

Delivery Readiness Gate is a local pre-handoff checklist. It summarizes verification, packaging, reference, safety, capability, and product UI checks from declared project evidence; it does not contact external services or collect telemetry.

UI Experience Audit is a local product-UI evidence checklist. It records the declared macOS material rules, OKLCH tokens, contained touch scrolling, Command Center workflow, focus/control states, responsive layout constraints, and runtime smoke coverage; it does not capture screenshots, inspect private telemetry, or call external design services.

UI Visual Evidence is a local screenshot evidence flow. It starts the local app, tries Playwright first, can use installed system Chrome through Playwright when bundled Chromium is unavailable, then falls back to Electron rendering and installed Edge/Chrome system-browser capture. When a renderer is available, it captures desktop and mobile screenshots, checks for blank captures, horizontal overflow, macOS material presence, Command Center visibility, and mobile health-label visibility, then writes `ui-visual-evidence.json` plus PNG files. If this host cannot render screenshots, the JSON status is `blocked` with the exact reason and next actions. It does not call external visual services or upload screenshots.

First-run Handoff Checklist is an operator workflow helper. It derives steps from local reports, export routes, readiness status, package commands, validation ledger status, and safety evidence; it does not collect new telemetry, call external services, or execute packaging commands. In the offline handoff package, the checklist includes a delivery-validation step that becomes `review` when command-level validation has warnings.

Release Readiness Workspace is a local review surface for handoff meetings. It summarizes connected assets, evidence freshness, risk queue, delivery package status, safety boundary, and reference basis, then routes the reviewer to Settings, Reports, Analysis, or Detail. It does not publish status pages, send notifications, collect new telemetry, or change servers.

Interaction Studio is a touch-first local operations layer. Tactile cards route to existing views, the swipe rail uses native scroll snap, Experience Deck guides client walkthrough steps, Action Dock exposes safe local commands, and Focus Peek summarizes the selected server/report context. It does not execute hidden actions, publish externally, enrich IPs, block traffic, scan networks, or modify remote hosts.

Scenario Board extends Interaction Studio with five operator command cards: Fleet Triage, Security Review, Runtime Pressure, Client Handoff, and Release Audit. Reviewers can select cards, pin scenarios, use `1` through `5` keyboard shortcuts, route through Action Dock or Command Center, and copy a client-safe summary. It remains a local defensive review workflow and does not perform hidden discovery, remote modification, external enrichment, or active response.

Authorized Inspection Workspace is the ServerLens 3.0 delivery path. It summarizes the selected authorized server, connection preflight, latest collection, latest analysis, readiness gate, checklist, and expected handoff artifacts in one local workspace. It can copy a client-safe inspection summary, but it does not collect hidden telemetry, scan networks, enrich IPs, block traffic, execute fixes, or modify remote hosts.

Strategy Iteration Workspace is the ServerLens 9.0 delivery path. It summarizes ten major-version planning cycles, local reference inputs, execution notes, validation gates, and handoff evidence. It is a review workspace only; it does not collect telemetry, run scans, call external services, modify servers, enrich sources, publish status pages, or execute release commands.

ServerLens 9.0 RetroUI Card clarity is the current interface layer. It uses bold black borders, hard offset shadows, flat high-contrast cards, short labels, live pulse cards, scroll-safe workspaces, wrapped evidence text, visible active movement, and strong focus states. It does not add hidden gestures that execute server actions; all collection, analysis, export, readiness, and handoff operations still require explicit buttons or commands.

Delivery Validation Ledger is a local command-results record. It summarizes `npm.cmd test`, `npm.cmd run build`, `npm.cmd run runtime:smoke`, `npm.cmd run ui:evidence`, `npm.cmd run package:app`, and `npm.cmd run handoff:dir`; it records command exit codes and artifact paths, but it does not include secrets, raw logs, private keys, passwords, or collected telemetry payloads. If UI visual evidence exits successfully but records `status: blocked`, the ledger status becomes `review` with one warning instead of claiming the package is fully screenshot-verified.

## Desktop App Packaging

```powershell
npm.cmd install
npm.cmd run package:app
npm.cmd run handoff:dir
```

For a command-level commercial validation ledger, run:

```powershell
npm.cmd run delivery:validate
```

This runs the test/build/smoke/package/handoff sequence and writes both:

```text
dist\delivery-validation.json
dist\handoff\ServerLens-9.0.0\delivery-validation.json
```

For optional screenshot-level UI evidence, run:

```powershell
npm.cmd run ui:evidence
```

This writes:

```text
dist\ui-visual-evidence.json
dist\ui-evidence\ui-evidence-desktop.png
dist\ui-evidence\ui-evidence-mobile.png
```

If Playwright, system Chrome, Electron hidden rendering, and installed Edge/Chrome system-browser capture are unavailable, `dist\ui-visual-evidence.json` is still written with status `blocked` and a reason. In that case `delivery-validation.json` reports `review`, not `ready`, because screenshot evidence still needs a desktop-capable rerun.

Expected output:

```text
dist\win-unpacked\ServerLens.exe
dist\handoff\ServerLens-9.0.0
```

The project also keeps the electron-builder path for standard packaging:

```powershell
npm.cmd run pack:dir
```

Expected output after a successful package run:

```text
dist\win-unpacked\ServerLens.exe
```

The desktop shell is Electron-based and starts the same local API/server used by the browser build.
Packaged desktop data is retained between app launches through the local `serverlens.sqlite` database in the app user data folder.

If Windows keeps an old packaged app running and locks `dist\win-unpacked`, use the controlled alternate output path:

```powershell
$env:SERVERLENS_PACKAGE_DIR="dist\win-unpacked-ready"
npm.cmd run package:app
$env:SERVERLENS_HANDOFF_APP_DIR="dist\win-unpacked-ready"
npm.cmd run handoff:dir
```

The local handoff manifest is available after the app starts:

```text
http://localhost:4173/api/delivery/evidence
http://localhost:4173/api/delivery/readiness
http://localhost:4173/api/delivery/ui-audit
http://localhost:4173/api/delivery/checklist
```

The offline handoff directory contains:

```text
app\ServerLens.exe
docs\README.md
docs\docs\reference-notes.md
codestable\architecture\
codestable\features\
delivery-evidence.json
delivery-validation.json
ui-visual-evidence.json
ui-evidence\
START-HERE.txt
```

`delivery-evidence.json` includes the Delivery Evidence manifest, the latest local Delivery Readiness Gate result, the UI Experience Audit, UI Visual Evidence status, validation ledger status, and an offline Handoff Checklist for package review. `delivery-validation.json` includes command-level validation results for test/build/smoke/UI evidence/package/handoff. The handoff package intentionally excludes secrets, private keys, passwords, raw logs, and collected telemetry payloads.

## Local References

The active 9.0 UI reference is stored under `references/web-v70/`, then summarized in `docs/reference-notes.md`. Historical 6.0 local worktrees remain in `references/github-v60/` for provenance, but the current releasable app uses the RetroUI Card clarity contract.

Current local references:

- `retroui-card`: local reference note for RetroUI Card, used for black borders, hard shadows, compact cards, font direction, and active movement.

The reference repositories were reviewed as complete local worktrees, including source, docs, packaging metadata, and security notes where present. They are used for product and architecture comparison only. ServerLens does not copy their source into the app.

## Image-2 Asset Prompt

If image generation is available, use this prompt for a project-local visual reference asset:

```text
Use case: ui-mockup
Asset type: product design reference
Primary request: A ServerLens 9.0 server operations workbench with RetroUI Card visual discipline, live local monitoring, and scroll-safe multi-dimensional status views.
Style/medium: polished product UI mockup, tactile paper surfaces, strong outlines, compact metrics, fleet table, alerts, and report detail panes.
Composition/framing: wide desktop application screenshot, dense professional controls, no marketing hero.
Lighting/mood: calm, precise, delivery-ready.
Color palette: tinted white and graphite neutrals, restrained cool blue accent, green amber red status colors.
Constraints: no cyberpunk visuals, no pure black, no pure white, no oversized SaaS cards, no decorative gradient text.
```
