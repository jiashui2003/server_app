# ServerLens 15.0 — Accessibility, Optional Notifications, Signing & Final Delivery

## Context

15.0 is the final major version in the v11→v15 commercial-delivery arc. It hardens the
user-facing surface (accessibility) and lands the two remaining planned extensions
(outbound alert webhook, signed installer) — both default-OFF to preserve the
demo-without-infrastructure principle. i18n was scoped out of this version by the user.

## Delivered

### Accessibility (a11y)
- Skip link (`.skip-link` → `#main-content`) and a focusable `<main id="main-content" tabindex="-1">` landmark.
- Delivery Workspace is now a real ARIA tab set: `role="tablist"` on the tab bar,
  `role="tab"` + `aria-selected` + `aria-controls` on each tab button, `role="tabpanel"`
  + `aria-labelledby` + `tabindex="0"` on each panel. `setDeliveryTab` keeps `aria-selected` in sync.
- Active navigation uses `aria-current="page"` (set in `setView` for nav items).
- Dynamic status surfaces use `aria-live="polite"` (`#live-monitor-status`, `#freshness-label`, `#page-operation-summary`).
- `prefers-reduced-motion: reduce` extended to suppress view transitions, skip-link/topbar/delivery-tab animation.
- Focus-visible outline extended to `a` and `[tabindex]`.

### Optional outbound webhook (planned extension, default OFF)
- New `src/server/webhook-notifier.js` — the ONLY outbound data path. Double-gated:
  `notifications.localOnly === false` AND `notifications.webhook.enabled === true` with a valid `https` URL.
- `notifications.webhook` config added to `defaultSettings` + deep-merged in `mergeSettings`/`updateSettings`.
- Wired into the analyze route in `src/server/app.js` after `createAlertsForReport` (fire-and-forget, never blocks/throws).
- Payload = redacted alert metadata only (id, severity, category, title); never raw logs/secrets.
- Settings form gains webhook enable / url / min-severity fields.

### Optional signed installer (planned extension, default fallback)
- `scripts/package-desktop.js` runs `maybeSignExecutable` after packaging; signs with `signtool`
  only when `SERVERLENS_SIGN_CERT` is set, otherwise returns `unsigned-dir-fallback` and continues.
- `package.json` `build.win` gains env-driven signing fields; target stays `dir`.

### Final delivery
- Version → `15.0.0`; visible chips, page-experience `versionTarget`, and version-pinned tests updated.
  (Strategy workspace stays `10.0.0` as a historical 10-cycle artifact.)
- DESIGN.md / README.md / ARCHITECTURE.md refreshed; Delivery Boundary moves signing + notifications
  from "planned" to "implemented (default off)".

## Tests
- `tests/webhook-notifier.test.js` — gating, https-only, severity filter, redacted payload, no-egress-when-disabled, never-throws.
- `tests/ui-contract.test.js` — new "15.0 accessibility contracts" block (skip link, ARIA tabs, live regions, reduced-motion).
- `tests/desktop-package.test.js` — signing fallback assertions + version bump.

## Verification
- `npm.cmd test` (92 tests), `npm.cmd run build`, `npm.cmd run delivery:validate` must be green/ready.
- `ui:evidence` real-browser render must stay `ready` (2 screenshots) — the true regression check.
- Webhook default-off asserted by test (no outbound connection unless explicitly enabled).
