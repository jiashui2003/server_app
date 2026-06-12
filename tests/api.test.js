import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/server/app.js';
import { createDemoSnapshot } from '../src/server/collector.js';
import { analyzeSnapshot } from '../src/shared/analysis-engine.js';

test('API can add a server, collect a demo snapshot, and run selected analysis modules', async () => {
  const app = createApp({ memoryOnly: true });
  const server = await app.inject('POST', '/api/servers', {
    name: 'Production Edge',
    host: 'demo.local',
    mode: 'demo',
    tags: ['production', 'edge']
  });

  assert.equal(server.statusCode, 201);
  const created = JSON.parse(server.body);
  assert.equal(created.name, 'Production Edge');

  const snapshotResponse = await app.inject('POST', `/api/servers/${created.id}/collect`, {});
  assert.equal(snapshotResponse.statusCode, 201);
  const snapshot = JSON.parse(snapshotResponse.body);
  assert.equal(snapshot.serverId, created.id);

  const analysisResponse = await app.inject('POST', `/api/servers/${created.id}/analyze`, {
    modules: ['security', 'ecosystem']
  });
  assert.equal(analysisResponse.statusCode, 201);
  const report = JSON.parse(analysisResponse.body);
  assert.deepEqual(report.modulesRun, ['security', 'ecosystem']);
  assert.ok(report.findings.some((finding) => finding.category === 'security'));
  assert.ok(report.findings.some((finding) => finding.category === 'ecosystem'));
});

test('API rejects unknown analysis modules with a useful error', async () => {
  const app = createApp({ memoryOnly: true });
  const server = JSON.parse((await app.inject('POST', '/api/servers', {
    name: 'Demo',
    host: 'demo.local',
    mode: 'demo'
  })).body);

  const response = await app.inject('POST', `/api/servers/${server.id}/analyze`, {
    modules: ['security', 'unknown-module']
  });

  assert.equal(response.statusCode, 400);
  const error = JSON.parse(response.body);
  assert.match(error.message, /unknown-module/);
});

test('API accepts analysis presets and records the resolved job scope', async () => {
  const app = createApp({ memoryOnly: true });
  const server = JSON.parse((await app.inject('POST', '/api/servers', {
    name: 'Preset Demo',
    host: 'preset.demo.local',
    mode: 'demo'
  })).body);

  const response = await app.inject('POST', `/api/servers/${server.id}/analyze`, {
    preset: 'security-review'
  });

  assert.equal(response.statusCode, 201);
  const report = JSON.parse(response.body);
  assert.equal(report.analysisScope.preset, 'security-review');
  assert.deepEqual(report.modulesRun, ['security', 'logs', 'network']);
  assert.equal(report.analysisScope.depth, 'deep');
  assert.equal(report.analysisScope.timeRange, 'last-1h');

  const jobs = JSON.parse((await app.inject('GET', '/api/analysis-jobs')).body);
  const job = jobs.find((item) => item.reportId === report.id);
  assert.ok(job);
  assert.equal(job.preset, 'security-review');
  assert.deepEqual(job.modules, ['security', 'logs', 'network']);
  assert.equal(job.depth, 'deep');
  assert.equal(job.timeRange, 'last-1h');
});

test('API stores delivery-grade server asset metadata and tests authorized connectivity', async () => {
  const app = createApp({ memoryOnly: true });

  const createdResponse = await app.inject('POST', '/api/servers', {
    name: 'EU Edge',
    host: 'edge.example.local',
    port: '2222',
    authType: 'ssh-key',
    username: 'ops',
    keyPath: 'C:\\Users\\ops\\.ssh\\id_ed25519',
    group: 'production',
    tags: 'edge, nginx, eu',
    password: 'must-not-be-stored'
  });

  assert.equal(createdResponse.statusCode, 201);
  const created = JSON.parse(createdResponse.body);
  assert.equal(created.port, 2222);
  assert.equal(created.authType, 'ssh-key');
  assert.equal(created.mode, 'demo');
  assert.equal(created.username, 'ops');
  assert.match(created.keyPath, /id_ed25519/);
  assert.equal(created.group, 'production');
  assert.deepEqual(created.tags, ['edge', 'nginx', 'eu']);
  assert.equal(Object.hasOwn(created, 'password'), false);
  assert.equal(created.connection.status, 'untested');

  const testResponse = await app.inject('POST', `/api/servers/${created.id}/test-connection`, {});
  assert.equal(testResponse.statusCode, 200);
  const result = JSON.parse(testResponse.body);
  assert.equal(result.serverId, created.id);
  assert.equal(result.status, 'skipped');
  assert.equal(result.reachable, null);
  assert.match(result.message, /Demo mode/);

  const detail = JSON.parse((await app.inject('GET', `/api/servers/${created.id}`)).body);
  assert.equal(detail.server.connection.status, 'skipped');
});

test('API connection test explains SSH authentication failures with operator next actions', async () => {
  const app = createApp({
    memoryOnly: true,
    connectionTester: async (server) => ({
      serverId: server.id,
      host: server.host,
      port: server.port,
      status: 'auth-failed',
      reachable: true,
      checkedAt: '2026-06-09T00:00:00.000Z',
      message: 'TCP succeeded, but SSH authentication failed for the configured account.',
      stages: [
        {
          id: 'tcp',
          label: 'TCP reachability',
          status: 'pass',
          message: 'TCP connection succeeded for the configured server.'
        },
        {
          id: 'ssh-auth',
          label: 'SSH authentication',
          status: 'fail',
          message: 'Permission denied (publickey,password).'
        }
      ],
      ssh: {
        checked: true,
        authenticated: false,
        method: 'agent',
        message: 'Permission denied (publickey,password).'
      },
      nextActions: [
        'Add a usable SSH key to the local agent or switch this asset to SSH key mode.',
        'Confirm liusonglin is present in authorized_keys on 192.168.1.45.'
      ]
    })
  });

  const server = JSON.parse((await app.inject('POST', '/api/servers', {
    name: 'LAN SSH',
    host: '192.168.1.45',
    port: 22,
    mode: 'ssh',
    authType: 'agent',
    username: 'liusonglin'
  })).body);

  const response = await app.inject('POST', `/api/servers/${server.id}/test-connection`, {});
  assert.equal(response.statusCode, 200);
  const result = JSON.parse(response.body);
  assert.equal(result.status, 'auth-failed');
  assert.equal(result.reachable, true);
  assert.equal(result.ssh.authenticated, false);
  assert.deepEqual(result.stages.map((stage) => stage.id), ['tcp', 'ssh-auth']);
  assert.match(result.nextActions.join(' '), /SSH key|authorized_keys/);

  const detail = JSON.parse((await app.inject('GET', `/api/servers/${server.id}`)).body);
  assert.equal(detail.server.connection.status, 'auth-failed');
  assert.equal(detail.server.connection.ssh.authenticated, false);
});

test('API updates server assets and resets stale connection state when endpoint changes', async () => {
  const app = createApp({ memoryOnly: true });
  const created = JSON.parse((await app.inject('POST', '/api/servers', {
    name: 'Editable Edge',
    host: 'editable.demo.local',
    port: 22,
    mode: 'demo',
    group: 'staging',
    tags: 'old'
  })).body);

  const testResponse = await app.inject('POST', `/api/servers/${created.id}/test-connection`, {});
  assert.equal(testResponse.statusCode, 200);

  const updateResponse = await app.inject('PUT', `/api/servers/${created.id}`, {
    name: 'Edited Edge',
    host: 'edited.demo.local',
    port: 2222,
    mode: 'demo',
    authType: 'agent',
    username: 'ops',
    keyPath: '',
    group: 'production',
    tags: 'edited, edge'
  });

  assert.equal(updateResponse.statusCode, 200);
  const updated = JSON.parse(updateResponse.body);
  assert.equal(updated.name, 'Edited Edge');
  assert.equal(updated.host, 'edited.demo.local');
  assert.equal(updated.port, 2222);
  assert.equal(updated.authType, 'agent');
  assert.equal(updated.username, 'ops');
  assert.equal(updated.group, 'production');
  assert.deepEqual(updated.tags, ['edited', 'edge']);
  assert.equal(updated.connection.status, 'untested');
  assert.match(updated.connection.message, /latest asset edit/);

  const detail = JSON.parse((await app.inject('GET', `/api/servers/${created.id}`)).body);
  assert.equal(detail.server.name, 'Edited Edge');
  assert.equal(detail.server.connection.status, 'untested');
});

test('API archives server assets without deleting audit history', async () => {
  const app = createApp({ memoryOnly: true });
  const created = JSON.parse((await app.inject('POST', '/api/servers', {
    name: 'Retired Edge',
    host: 'retired.demo.local',
    mode: 'demo',
    tags: 'retired, edge'
  })).body);

  const report = JSON.parse((await app.inject('POST', `/api/servers/${created.id}/analyze`, {
    modules: ['health', 'security']
  })).body);
  assert.equal(report.serverId, created.id);

  const archiveResponse = await app.inject('POST', `/api/servers/${created.id}/archive`, {});
  assert.equal(archiveResponse.statusCode, 200);
  const archived = JSON.parse(archiveResponse.body);
  assert.equal(archived.archived, true);
  assert.match(archived.archivedAt, /^\d{4}-/);

  const activeServers = JSON.parse((await app.inject('GET', '/api/servers')).body);
  assert.equal(activeServers.some((server) => server.id === created.id), false);

  const allServers = JSON.parse((await app.inject('GET', '/api/servers/all')).body);
  assert.equal(allServers.some((server) => server.id === created.id && server.archived), true);

  const detail = JSON.parse((await app.inject('GET', `/api/servers/${created.id}`)).body);
  assert.equal(detail.server.archived, true);
  assert.equal(detail.report.id, report.id);

  const collectResponse = await app.inject('POST', `/api/servers/${created.id}/collect`, {});
  assert.equal(collectResponse.statusCode, 409);
  assert.match(JSON.parse(collectResponse.body).message, /archived/i);

  const restoreResponse = await app.inject('POST', `/api/servers/${created.id}/restore`, {});
  assert.equal(restoreResponse.statusCode, 200);
  const restored = JSON.parse(restoreResponse.body);
  assert.equal(restored.archived, false);
  assert.equal(restored.archivedAt, null);
});

test('API exports and imports sanitized server inventory for handoff migration', async () => {
  const source = createApp({ memoryOnly: true });
  const created = JSON.parse((await source.inject('POST', '/api/servers', {
    name: 'Migration Edge',
    host: 'migration.demo.local',
    port: 2222,
    mode: 'demo',
    authType: 'agent',
    username: 'ops',
    group: 'delivery',
    tags: 'migration, edge',
    password: 'must-not-export'
  })).body);
  await source.inject('POST', `/api/servers/${created.id}/analyze`, { modules: ['health'] });
  await source.inject('POST', `/api/servers/${created.id}/archive`, {});

  const exportResponse = await source.inject('GET', '/api/servers/export');
  assert.equal(exportResponse.statusCode, 200);
  const exported = JSON.parse(exportResponse.body);
  assert.equal(exported.format, 'serverlens.inventory.v1');
  assert.ok(exported.exportedAt);
  const exportedServer = exported.servers.find((server) => server.host === 'migration.demo.local');
  assert.ok(exportedServer);
  assert.equal(exportedServer.archived, true);
  assert.equal(exportedServer.username, 'ops');
  assert.equal(Object.hasOwn(exportedServer, 'password'), false);
  assert.equal(Object.hasOwn(exportedServer, 'latestReport'), false);
  assert.equal(Object.hasOwn(exportedServer, 'latestSnapshot'), false);
  assert.equal(Object.hasOwn(exportedServer, 'connection'), false);

  const target = createApp({ memoryOnly: true });
  const importResponse = await target.inject('POST', '/api/servers/import', exported);
  assert.equal(importResponse.statusCode, 200);
  const imported = JSON.parse(importResponse.body);
  assert.ok(imported.imported >= 1);

  const secondImport = JSON.parse((await target.inject('POST', '/api/servers/import', exported)).body);
  assert.ok(secondImport.skipped >= 1);

  const allServers = JSON.parse((await target.inject('GET', '/api/servers/all')).body);
  const migrated = allServers.find((server) => server.host === 'migration.demo.local');
  assert.ok(migrated);
  assert.equal(migrated.archived, true);
  assert.equal(migrated.authType, 'agent');
  assert.deepEqual(migrated.tags, ['migration', 'edge']);
  assert.equal(Object.hasOwn(migrated, 'password'), false);
});

test('API runs retention maintenance without removing current server evidence', async () => {
  const app = createApp({ memoryOnly: true });
  const server = app.store.createServer({
    name: 'Retention Edge',
    host: 'retention.demo.local',
    mode: 'demo',
    tags: ['retention']
  });
  const snapshot = app.store.saveSnapshot(createDemoSnapshot(server.id));
  const oldReport = analyzeSnapshot(snapshot, {
    modules: ['health', 'security', 'runtime', 'ecosystem', 'logs', 'network', 'performance'],
    settings: app.store.getSettings()
  });
  oldReport.id = 'report-retention-old';
  oldReport.generatedAt = '2020-01-01T00:00:00.000Z';
  app.store.saveReport(oldReport);
  app.store.createAlertsForReport(oldReport, server);
  for (const alert of app.store.listAlerts().filter((item) => item.reportId === oldReport.id)) {
    alert.createdAt = '2020-01-01T00:00:00.000Z';
  }
  const oldJob = app.store.createAnalysisJob({
    serverId: server.id,
    modules: ['security'],
    depth: 'quick'
  });
  oldJob.startedAt = '2020-01-01T00:00:00.000Z';
  app.store.completeAnalysisJob(oldJob.id, oldReport);
  oldJob.finishedAt = '2020-01-01T00:00:01.000Z';

  const currentReport = analyzeSnapshot(snapshot, {
    modules: ['health', 'security'],
    settings: app.store.getSettings()
  });
  app.store.saveReport(currentReport);
  app.store.createAlertsForReport(currentReport, server);

  const retentionResponse = await app.inject('POST', '/api/maintenance/retention', {});
  assert.equal(retentionResponse.statusCode, 200);
  const result = JSON.parse(retentionResponse.body);
  assert.equal(result.retentionDays, 30);
  assert.ok(result.deleted.reports >= 1);
  assert.ok(result.deleted.analysisJobs >= 1);
  assert.ok(result.deleted.alerts >= 1);

  const detail = JSON.parse((await app.inject('GET', `/api/servers/${server.id}`)).body);
  assert.equal(detail.snapshot.serverId, server.id);
  assert.equal(detail.report.id, currentReport.id);

  const missingOldReport = await app.inject('GET', '/api/reports/report-retention-old');
  assert.equal(missingOldReport.statusCode, 404);
  const jobs = JSON.parse((await app.inject('GET', '/api/analysis-jobs')).body);
  assert.equal(jobs.some((job) => job.id === oldJob.id), false);
  const alerts = JSON.parse((await app.inject('GET', '/api/alerts')).body);
  assert.equal(alerts.some((alert) => alert.reportId === oldReport.id), false);
});

test('API exposes a redacted local status page summary for handoff previews', async () => {
  const app = createApp({ memoryOnly: true });
  const server = JSON.parse((await app.inject('POST', '/api/servers', {
    name: 'Status Edge',
    host: 'private-status.demo.local',
    port: 2222,
    mode: 'demo',
    authType: 'agent',
    username: 'ops',
    keyPath: 'C:\\Users\\ops\\.ssh\\id_ed25519',
    group: 'customer',
    tags: 'status, edge'
  })).body);

  await app.inject('POST', `/api/servers/${server.id}/analyze`, {
    modules: ['health', 'security', 'runtime', 'ecosystem', 'logs', 'network', 'performance']
  });

  const response = await app.inject('GET', '/api/status-page');
  assert.equal(response.statusCode, 200);
  const summary = JSON.parse(response.body);
  assert.equal(summary.localOnly, true);
  assert.ok(summary.generatedAt);
  assert.ok(['operational', 'degraded', 'major-incident'].includes(summary.overallStatus));
  assert.ok(summary.services.some((service) => service.name === 'Status Edge'));
  assert.ok(summary.incidents.length >= 1);

  const serialized = JSON.stringify(summary);
  assert.equal(serialized.includes('private-status.demo.local'), false);
  assert.equal(serialized.includes('ops'), false);
  assert.equal(serialized.includes('id_ed25519'), false);
  assert.equal(serialized.includes('latestSnapshot'), false);
  assert.equal(summary.services.some((service) => Object.hasOwn(service, 'connection')), false);
});

test('status page overall status reflects degraded services even without alert rows', async () => {
  const app = createApp({ memoryOnly: true });
  const response = await app.inject('GET', '/api/status-page');
  assert.equal(response.statusCode, 200);
  const summary = JSON.parse(response.body);
  assert.ok(summary.services.some((service) => service.status === 'major-incident'));
  assert.equal(summary.overallStatus, 'major-incident');
});

test('API rejects unsafe server asset metadata before collection', async () => {
  const app = createApp({ memoryOnly: true });

  const response = await app.inject('POST', '/api/servers', {
    name: 'Bad Port',
    host: 'bad.example.local',
    port: 70000,
    authType: 'ssh-key'
  });

  assert.equal(response.statusCode, 400);
  assert.match(JSON.parse(response.body).message, /port/i);
});
