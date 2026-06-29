# ServerLens

> A local-first, macOS-style desktop workbench for server status and **defensive** risk analysis of your own authorized infrastructure.

ServerLens gives individual developers and small operations teams a compact control surface for server health, runtime state, exposed services, security signals, custom analysis modules, and client-ready delivery reports — without deploying a heavy observability platform. It runs entirely on your machine, stores data in a local SQLite database, and makes **no outbound network calls by default**.

- **Local-first** — the API binds to `127.0.0.1`, data lives in a local SQLite file, and demo mode runs with zero external infrastructure.
- **Defensive only** — analysis is based on owned telemetry (logs, ports, service state, established connections). It never scans adjacent hosts, attributes activity, enriches sources, or modifies remote systems.
- **Evidence-backed** — every risk finding carries evidence, a severity, and a concrete recommendation. Performance trends are charted from real collected history, never simulated.
- **Zero runtime dependencies** — the server uses only Node.js built-ins (`node:sqlite`, `node:crypto`, `node:http`).

## Requirements

- **Node.js `>=24.0.0`** (the persistence layer uses the built-in `node:sqlite` runtime).
- Windows is the primary packaging target; the local server and tests run on any platform Node 24 supports.

## Quick Start

```bash
npm install
npm start
```

Then open `http://localhost:4173`.

The local server persists data to `data/serverlens.sqlite` by default. Override the location with the `SERVERLENS_DB_PATH` environment variable. A demo fleet is seeded automatically so you can explore the full workflow immediately, with no servers configured and no external calls.

## Usage

The operator workflow is: **add a server → test the connection → collect telemetry → run analysis → review the report → hand off**.

- **Servers** — add/edit/archive assets with host, port, auth type, collection mode (demo / local / authorized SSH), and tags. A Connection Health Map shows TCP + SSH authentication stages and concrete next actions.
- **Collection** — demo, local, or agentless SSH (`BatchMode`) collection of CPU, memory, disk, IO, ports, services, containers, firewall posture, and security events. Passwords are never stored.
- **Analysis** — selectable modules (health, security, runtime, ecosystem, logs, network, performance) with presets, depth, and time-range controls. Produces evidence-backed findings, a remediation checklist, service topology, and a service catalog.
- **Ecosystem** — a real-time, fleet-wide dashboard that aggregates resource pressure, service mix, container fleet, exposure surface, risk distribution, and freshness across all servers from collected telemetry. It auto-refreshes on the live polling loop and shows an explicit placeholder (never a fabricated line) until enough history exists.
- **Delivery Workspace** — one tabbed surface for handoff review: **Inspect** (authorized inspection flow), **Validate** (release readiness gate), and **Handoff** (strategy iteration evidence).
- **Reports** — history, score/finding trends, current-vs-previous comparison, a redacted status-page preview, and Markdown / print-ready PDF export.

## Configuration

All configuration is via environment variables. Everything below is **off by default** so demo mode needs no setup.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4173` | Local HTTP port. |
| `SERVERLENS_DB_PATH` | `data/serverlens.sqlite` | SQLite database location. |
| `SERVERLENS_BIND_HOST` | `127.0.0.1` | Bind host. Set to `0.0.0.0` only when you intentionally need LAN access. |
| `SERVERLENS_API_TOKEN` | _(unset)_ | When set, write requests (`POST`/`PUT`/`PATCH`/`DELETE` on `/api/*`) require `Authorization: Bearer <token>` (timing-safe check). Reads stay open for the UI. |
| `SERVERLENS_CRED_KEY` | _(unset)_ | When set, sensitive SSH metadata (key path) is stored as an AES-256-GCM envelope at rest. The same key must be present on restart to decrypt. |
| `SERVERLENS_SIGN_CERT` | _(unset)_ | Path to a Windows Authenticode certificate. When supplied, `package:app` signs `ServerLens.exe`; otherwise it falls back to an unsigned build. |

## Architecture

```
src/
  server/       Local HTTP API, SQLite store, SSH collector, webhook notifier, credential cipher
  shared/       Analysis engine and delivery-evidence builders (pure, unit-tested)
  desktop/      Electron entry (contextIsolation + sandbox, loads the loopback API)
public/
  app.js        UI runtime, loaded as a native ES module
  js/           Pure DOM-free modules (format, commands, page-model) — directly unit-tested
scripts/        build-check, runtime-smoke, ui-visual-evidence, package-desktop, delivery-validate
tests/          Node's built-in test runner (no test framework dependency)
```

There is **no build/bundling step**. The browser loads native ES modules; the server runs source directly on Node 24.

## Testing & Verification

```bash
npm test                    # unit + contract tests (Node's built-in runner)
npm run build               # static contract / design-guardrail check
npm run runtime:smoke       # local API + rendered-UI contract verification
npm run delivery:validate   # full sequence: test → build → smoke → screenshots → package → handoff
```

`runtime:smoke` verifies the rendered app through a hidden Electron window and falls back to API/HTML/CSS/JS contract checks (`mode: "static-fallback"`) when the host cannot render. `ui:evidence` captures desktop/mobile screenshots with Playwright (or system Chrome/Edge) and writes a `blocked` evidence file with a clear reason when no renderer is available.

## Security Model

ServerLens is **defensive by design**. It is built to inspect infrastructure you own and are authorized to analyze.

- **No offensive capability.** No host/network scanning, no credential guessing, no attribution, no source enrichment, no traffic blocking, no remote modification.
- **No outbound calls by default.** Alerts go to a local inbox. The optional webhook notifier (`src/server/webhook-notifier.js`) is double-gated — it sends only when `localOnly` is explicitly `false` **and** the webhook is enabled with a valid `https` URL — and transmits redacted metadata only (id, severity, category, title), never raw logs, secrets, or credentials.
- **Secrets stay out of artifacts.** Reports, exports, the evidence appendix, the status-page preview, and the handoff package exclude passwords, private keys, raw logs, and collected telemetry payloads.
- **Hardened local runtime.** Loopback binding, optional bearer-token gate on writes, `node:crypto` identifiers, a 256 KB request-body limit, and an Electron shell with `contextIsolation`, `sandbox`, and no `nodeIntegration`.

## Desktop Packaging

```bash
npm run package:app    # produces dist/win-unpacked/ServerLens.exe
npm run handoff:dir    # assembles dist/handoff/ServerLens-<version>/
```

Code signing runs automatically when `SERVERLENS_SIGN_CERT` is configured; otherwise packaging falls back to an unsigned `dir` target so demo/handoff builds work with zero signing infrastructure. The handoff directory bundles the app, docs, architecture notes, and offline evidence manifests (`delivery-evidence.json`, `delivery-validation.json`, `ui-visual-evidence.json`).

## Version History

| Version | Focus |
| --- | --- |
| 11.0 | Security hardening — loopback binding, optional API token, `node:crypto` IDs, optional encrypted credentials |
| 12.0 | Honest metric history — real per-server snapshot trends, no simulated curves |
| 13.0 | Frontend modularity — pure logic extracted into unit-tested ES modules |
| 14.0 | Information architecture — three delivery views consolidated into one tabbed Delivery Workspace |
| 15.0 | Accessibility (ARIA tabs, skip link, live regions, reduced-motion) + optional webhook notifications and signed-installer config (both off by default) |
| 16.0 | Real-time fleet Ecosystem dashboard (resource/service/container/exposure/risk/freshness aggregation) replacing decorative studio panels; removed the last fabricated visualization |

## License

Licensed under the [Apache License 2.0](LICENSE).

## Disclaimer

Use ServerLens only on infrastructure you own or are explicitly authorized to analyze. The tool is intended for defensive operations review and does not perform offensive security actions.
