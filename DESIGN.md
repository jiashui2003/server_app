# ServerLens 16.0 Design Context

ServerLens 16.0 is a local-first server operations workbench. It keeps the 11.0 hardened runtime (loopback binding, optional API token, `node:crypto` identifiers, optional AES-256-GCM credential storage), the 12.0 honest metric history (real per-server snapshot trends with an explicit "collect more" placeholder, no synthetic curves), the 13.0 modular frontend (pure DOM-free logic in native ES modules under `public/js/`, zero build step), the 14.0 consolidated Delivery Workspace (the former Inspection, Strategy, and Release views folded into one tabbed Inspect → Validate → Handoff surface), and the 15.0 accessibility and opt-in delivery extensions. 16.0 replaces the decorative Interaction Studio (Experience Deck demo toys and the Command-Center-redundant Scenario Board) with a real **Ecosystem** dashboard: six panels — resource pressure, service mix, container fleet, exposure surface, risk distribution, and freshness with a real fleet CPU/memory trend — aggregated from already-collected telemetry by the pure `buildEcosystemOverview` function and refreshed live on the existing polling loop. It also removes the last fabricated visualization (the live-monitor sine-wave sweep), replacing it with a real fleet-trend sparkline. The aggregation triggers no new collection, opens no outbound connection, and carries no secrets; when fewer than three aligned collections exist it flags `insufficient-history` rather than drawing a fake line. The retained tactile navigation rail, Action Dock, and Focus Peek stay as real operator shortcuts.

## Visual Thesis

Professional operations console with macOS/iOS material restraint, RetroUI card edges, clear status color, and dense but calm page surfaces.

## Interaction Thesis

- Every page exposes one primary action and one next step.
- Navigation stays explicit; no hidden server collection, scanning, or remote modification happens through gestures.
- Scroll and swipe surfaces are contained, touch-friendly, and verified page by page.

## Active Contracts

- `retro-v9-shell` remains for the proven RetroUI compatibility layer.
- `retro-v10-shell` and `data-component-system="serverlens-v100"` declare the current 10.0 page-operation layer.
- `page-operation-summary` is required on every page and must include title, action, evidence chips, and next step.

## Reference Basis

10.0 references RetroUI Card, shadcn/ui, Konsta, Uptime Kuma, Glances, node_exporter, and Dashy. These references shape layout and interaction decisions; their source is not copied into runtime.

## 11.0 Security Runtime

- The local API binds to `127.0.0.1` by default. `SERVERLENS_BIND_HOST` can explicitly open a wider interface for trusted setups.
- `SERVERLENS_API_TOKEN`, when set, requires a `Bearer` token on write operations (POST/PUT/PATCH/DELETE) using a timing-safe comparison. When unset, the demo build stays zero-configuration.
- Identifiers (servers, snapshots, reports, jobs) use `node:crypto` `randomUUID`/`randomBytes`; the store keeps monotonic counters so deleted IDs are never reused.
- Request bodies over 256KB are rejected with `413`, and malformed JSON returns `400`.
- `SERVERLENS_CRED_KEY` (planned extension, default off) wraps sensitive SSH credential metadata in an AES-256-GCM envelope at rest. Without the key the store keeps the existing plaintext metadata behavior so demo mode needs no configuration.
