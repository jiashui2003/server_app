// Optional outbound webhook notifier (planned extension, default OFF).
//
// This is the ONLY path in ServerLens that makes an outbound network call with
// alert data. It is double-gated and fails safe:
//   1. settings.notifications.localOnly must be explicitly false, AND
//   2. settings.notifications.webhook.enabled must be true with a valid https URL.
// When either gate is closed (the default), nothing is sent and no network
// connection is opened. The payload carries only redacted alert metadata that is
// already shown in the local inbox — never raw logs, secrets, or credentials.

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

export function shouldDispatchWebhook(settings, alerts) {
  const webhook = settings?.notifications?.webhook;
  if (!webhook) return false;
  if (settings.notifications.localOnly !== false) return false; // local-only is the safe default
  if (!webhook.enabled) return false;
  if (!isValidWebhookUrl(webhook.url)) return false;
  return selectAlerts(settings, alerts).length > 0;
}

export function selectAlerts(settings, alerts = []) {
  const minRank = SEVERITY_RANK[settings?.notifications?.webhook?.minSeverity] ?? SEVERITY_RANK.high;
  return alerts.filter((alert) => (SEVERITY_RANK[alert.severity] ?? 0) >= minRank);
}

export function buildWebhookPayload(settings, alerts, context = {}) {
  const selected = selectAlerts(settings, alerts);
  return {
    product: 'ServerLens',
    kind: 'local-alert-notification',
    generatedAt: context.now ?? new Date().toISOString(),
    serverId: context.serverId ?? null,
    serverName: context.serverName ?? null,
    alertCount: selected.length,
    // Redacted metadata only — the same summary fields the local inbox shows.
    alerts: selected.map((alert) => ({
      id: alert.id,
      severity: alert.severity,
      category: alert.category,
      title: alert.title
    })),
    note: 'Sent by ServerLens because an operator explicitly enabled an outbound webhook (localOnly=false). Metadata only; no raw logs or secrets.'
  };
}

export function isValidWebhookUrl(value) {
  const url = String(value ?? '').trim();
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Dispatch the notification. Returns a result record (never throws) so a failed
// webhook never blocks local analysis. `fetchImpl` is injectable for tests.
export async function dispatchWebhook(settings, alerts, context = {}) {
  if (!shouldDispatchWebhook(settings, alerts)) {
    return { dispatched: false, reason: 'disabled-or-no-matching-alerts' };
  }
  const fetchImpl = context.fetchImpl ?? globalThis.fetch;
  const payload = buildWebhookPayload(settings, alerts, context);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), context.timeoutMs ?? 5000);
  try {
    const response = await fetchImpl(settings.notifications.webhook.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    return { dispatched: true, status: response.status, alertCount: payload.alertCount };
  } catch (error) {
    return { dispatched: false, reason: 'request-failed', error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}
