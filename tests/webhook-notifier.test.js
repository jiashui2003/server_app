import test from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldDispatchWebhook,
  selectAlerts,
  buildWebhookPayload,
  isValidWebhookUrl,
  dispatchWebhook
} from '../src/server/webhook-notifier.js';

const sampleAlerts = [
  { id: 'a1', severity: 'critical', category: 'security', title: 'Brute force' },
  { id: 'a2', severity: 'high', category: 'network', title: 'Public DB' },
  { id: 'a3', severity: 'medium', category: 'logs', title: 'Error burst' }
];

function settingsWith(overrides = {}) {
  return {
    notifications: {
      localOnly: true,
      webhook: { enabled: false, url: '', minSeverity: 'high', ...overrides.webhook },
      ...overrides
    }
  };
}

test('webhook stays disabled by default (local-only is the safe default)', () => {
  assert.equal(shouldDispatchWebhook(settingsWith(), sampleAlerts), false);
});

test('webhook stays disabled when enabled but local-only is still true', () => {
  const settings = settingsWith({ webhook: { enabled: true, url: 'https://hooks.example.com/x', minSeverity: 'high' } });
  assert.equal(shouldDispatchWebhook(settings, sampleAlerts), false);
});

test('webhook dispatches only when local-only is explicitly false and a valid https url is set', () => {
  const settings = settingsWith({
    localOnly: false,
    webhook: { enabled: true, url: 'https://hooks.example.com/x', minSeverity: 'high' }
  });
  assert.equal(shouldDispatchWebhook(settings, sampleAlerts), true);
});

test('non-https webhook urls are rejected', () => {
  assert.equal(isValidWebhookUrl('http://insecure.example.com'), false);
  assert.equal(isValidWebhookUrl('https://ok.example.com'), true);
  assert.equal(isValidWebhookUrl(''), false);
});

test('severity filter selects only alerts at or above the configured minimum', () => {
  const settings = settingsWith({ localOnly: false, webhook: { enabled: true, url: 'https://x.example.com', minSeverity: 'high' } });
  const selected = selectAlerts(settings, sampleAlerts);
  assert.deepEqual(selected.map((a) => a.id), ['a1', 'a2']);
});

test('payload carries redacted metadata only', () => {
  const settings = settingsWith({ localOnly: false, webhook: { enabled: true, url: 'https://x.example.com', minSeverity: 'critical' } });
  const payload = buildWebhookPayload(settings, sampleAlerts, { serverName: 'edge-1', now: '2026-06-12T00:00:00.000Z' });
  assert.equal(payload.product, 'ServerLens');
  assert.equal(payload.alertCount, 1);
  assert.deepEqual(Object.keys(payload.alerts[0]).sort(), ['category', 'id', 'severity', 'title']);
  // No raw evidence / recommendation / commands leak into the payload.
  assert.equal('evidence' in payload.alerts[0], false);
  assert.equal('commands' in payload.alerts[0], false);
});

test('dispatchWebhook does nothing and opens no connection when disabled', async () => {
  let called = false;
  const result = await dispatchWebhook(settingsWith(), sampleAlerts, {
    fetchImpl: async () => { called = true; return { status: 200 }; }
  });
  assert.equal(called, false);
  assert.equal(result.dispatched, false);
});

test('dispatchWebhook posts the payload when fully enabled', async () => {
  const settings = settingsWith({ localOnly: false, webhook: { enabled: true, url: 'https://hooks.example.com/x', minSeverity: 'high' } });
  let capturedUrl = null;
  let capturedBody = null;
  const result = await dispatchWebhook(settings, sampleAlerts, {
    fetchImpl: async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return { status: 202 };
    }
  });
  assert.equal(result.dispatched, true);
  assert.equal(result.status, 202);
  assert.equal(capturedUrl, 'https://hooks.example.com/x');
  assert.equal(capturedBody.alertCount, 2);
});

test('dispatchWebhook never throws when the request fails', async () => {
  const settings = settingsWith({ localOnly: false, webhook: { enabled: true, url: 'https://hooks.example.com/x', minSeverity: 'high' } });
  const result = await dispatchWebhook(settings, sampleAlerts, {
    fetchImpl: async () => { throw new Error('network down'); }
  });
  assert.equal(result.dispatched, false);
  assert.equal(result.reason, 'request-failed');
});
