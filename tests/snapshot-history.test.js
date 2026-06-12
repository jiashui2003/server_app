import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createStore } from '../src/server/store.js';
import { analyzeSnapshot } from '../src/shared/analysis-engine.js';
import { createDemoSnapshot } from '../src/server/collector.js';

function snapshotAt(serverId, collectedAt, cpuPercent) {
  const snapshot = createDemoSnapshot(serverId);
  snapshot.id = `snapshot-${collectedAt}`;
  snapshot.collectedAt = collectedAt;
  snapshot.resources.cpuPercent = cpuPercent;
  return snapshot;
}

test('saveSnapshot appends an ascending real history per server', () => {
  const store = createStore({ memoryOnly: true });
  const server = store.createServer({ name: 'History', host: 'h.local', mode: 'demo' });

  store.saveSnapshot(snapshotAt(server.id, '2026-06-11T10:00:00.000Z', 40));
  store.saveSnapshot(snapshotAt(server.id, '2026-06-11T10:05:00.000Z', 55));
  store.saveSnapshot(snapshotAt(server.id, '2026-06-11T10:10:00.000Z', 70));

  const history = store.listSnapshotHistory(server.id);
  assert.equal(history.length, 3);
  assert.deepEqual(history.map((entry) => entry.resources.cpuPercent), [40, 55, 70]);
});

test('trends carry real data points and flag insufficient history honestly', () => {
  const single = analyzeSnapshot(createDemoSnapshot('server-1'), { modules: ['health'] });
  assert.equal(single.trends.mode, 'local-snapshot-history');
  assert.equal(single.trends.status, 'insufficient-history');
  assert.equal(single.trends.dataPoints, 1);
  assert.equal(single.trends.cpu.length, 1);

  const history = [
    snapshotAt('server-1', '2026-06-11T10:00:00.000Z', 30),
    snapshotAt('server-1', '2026-06-11T10:05:00.000Z', 45),
    snapshotAt('server-1', '2026-06-11T10:10:00.000Z', 60)
  ];
  const latest = history.at(-1);
  const report = analyzeSnapshot(latest, { modules: ['health'], snapshotHistory: history });
  assert.equal(report.trends.status, 'ready');
  assert.equal(report.trends.dataPoints, 3);
  assert.deepEqual(report.trends.cpu, [30, 45, 60]);
});

test('trends never fabricate points beyond the collected count', () => {
  const history = [
    snapshotAt('server-1', '2026-06-11T10:00:00.000Z', 20),
    snapshotAt('server-1', '2026-06-11T10:05:00.000Z', 25)
  ];
  const report = analyzeSnapshot(history.at(-1), { modules: ['health'], snapshotHistory: history });
  assert.equal(report.trends.cpu.length, 2);
  assert.equal(report.trends.dataPoints, 2);
  assert.equal(report.trends.status, 'insufficient-history');
});

test('retention maintenance prunes old snapshot history but keeps the latest snapshot', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'serverlens-history-'));
  const dbPath = path.join(dir, 'serverlens.sqlite');
  try {
    const store = createStore({ dbPath });
    const server = store.createServer({ name: 'Retained', host: 'r.local', mode: 'demo' });
    const old = snapshotAt(server.id, '2020-01-01T00:00:00.000Z', 10);
    const recent = snapshotAt(server.id, new Date().toISOString(), 50);
    store.saveSnapshot(old);
    store.saveSnapshot(recent);
    assert.equal(store.listSnapshotHistory(server.id).length, 2);

    store.runRetentionMaintenance({ retentionDays: 30 });
    const history = store.listSnapshotHistory(server.id);
    assert.ok(history.length >= 1);
    assert.ok(history.some((entry) => entry.resources.cpuPercent === 50));
    assert.ok(!history.some((entry) => entry.collectedAt === '2020-01-01T00:00:00.000Z'));
    store.close();
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows may hold the SQLite handle briefly; the assertions already passed.
    }
  }
});

test('snapshot history survives a persistent store restart', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'serverlens-history-restart-'));
  const dbPath = path.join(dir, 'serverlens.sqlite');
  try {
    const first = createStore({ dbPath });
    const server = first.createServer({ name: 'Persisted', host: 'p.local', mode: 'demo' });
    first.saveSnapshot(snapshotAt(server.id, '2026-06-11T10:00:00.000Z', 33));
    first.saveSnapshot(snapshotAt(server.id, '2026-06-11T10:05:00.000Z', 44));
    first.close();

    const second = createStore({ dbPath });
    const history = second.listSnapshotHistory(server.id);
    assert.equal(history.length, 2);
    assert.deepEqual(history.map((entry) => entry.resources.cpuPercent), [33, 44]);
    second.close();
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // tolerate Windows file lock during cleanup
    }
  }
});
