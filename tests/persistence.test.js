import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createStore } from '../src/server/store.js';
import { createDemoSnapshot } from '../src/server/collector.js';
import { analyzeSnapshot } from '../src/shared/analysis-engine.js';
import { createApp } from '../src/server/app.js';

test('SQLite store persists servers, settings, snapshots, reports, and jobs across restarts', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'serverlens-'));
  const dbPath = path.join(tempDir, 'serverlens.sqlite');

  try {
    const first = createStore({ dbPath });
    const server = first.createServer({
      name: 'Persistent Server',
      host: 'persistent.local',
      mode: 'demo',
      tags: ['persistent']
    });
    first.updateSettings({ thresholds: { cpuHigh: 81, memoryHigh: 82 } });
    const snapshot = first.saveSnapshot(createDemoSnapshot(server.id));
    const job = first.createAnalysisJob({
      serverId: server.id,
      modules: ['health', 'security', 'logs'],
      depth: 'deep'
    });
    const report = first.saveReport(analyzeSnapshot(snapshot, {
      modules: ['health', 'security', 'logs'],
      settings: first.getSettings()
    }));
    first.completeAnalysisJob(job.id, report);
    first.close();

    const second = createStore({ dbPath });
    const detail = second.getServerDetail(server.id);

    assert.equal(detail.server.name, 'Persistent Server');
    assert.equal(detail.snapshot.serverId, server.id);
    assert.equal(detail.report.id, report.id);
    assert.equal(detail.jobs[0].status, 'completed');
    assert.equal(second.getSettings().thresholds.cpuHigh, 81);
    assert.equal(second.listReports()[0].id, report.id);
    second.close();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('createApp can run against a persistent database without reseeding duplicates', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'serverlens-app-'));
  const dbPath = path.join(tempDir, 'serverlens.sqlite');

  try {
    const first = createApp({ dbPath });
    const created = JSON.parse((await first.inject('POST', '/api/servers', {
      name: 'Saved Through API',
      host: 'api.persist.local',
      mode: 'demo'
    })).body);
    await first.inject('POST', `/api/servers/${created.id}/analyze`, {
      modules: ['health', 'security', 'logs']
    });
    first.store.close();

    const second = createApp({ dbPath });
    const servers = JSON.parse((await second.inject('GET', '/api/servers')).body);
    const names = servers.map((server) => server.name);

    assert.ok(names.includes('Saved Through API'));
    assert.equal(names.filter((name) => name === 'Production Edge').length, 1);
    second.store.close();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('local alert inbox persists acknowledgement state across restarts', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'serverlens-alerts-'));
  const dbPath = path.join(tempDir, 'serverlens.sqlite');

  try {
    const first = createApp({ dbPath });
    const server = JSON.parse((await first.inject('POST', '/api/servers', {
      name: 'Persistent Alerts',
      host: 'alerts.persist.local',
      mode: 'demo'
    })).body);
    await first.inject('POST', `/api/servers/${server.id}/analyze`, {
      modules: ['health', 'security', 'runtime', 'ecosystem', 'logs', 'network', 'performance']
    });
    const alerts = JSON.parse((await first.inject('GET', '/api/alerts')).body);
    assert.ok(alerts.length >= 1);

    const acknowledged = JSON.parse((await first.inject('POST', `/api/alerts/${alerts[0].id}/ack`, {})).body);
    assert.equal(acknowledged.status, 'acknowledged');
    first.store.close();

    const second = createApp({ dbPath });
    const restoredAlerts = JSON.parse((await second.inject('GET', '/api/alerts')).body);
    assert.equal(restoredAlerts.find((alert) => alert.id === alerts[0].id).status, 'acknowledged');
    second.store.close();
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
