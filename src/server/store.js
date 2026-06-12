import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes } from 'node:crypto';

import { createCredentialCipher } from './credential-cipher.js';

const MAX_SNAPSHOT_HISTORY = 240;

const defaultSettings = {
  thresholds: {
    cpuHigh: 90,
    memoryHigh: 85,
    diskCritical: 90,
    loadHigh: 4
  },
  notifications: {
    localOnly: true,
    statusPage: false,
    inboxEnabled: true,
    alertSeverities: ['critical', 'high'],
    webhook: {
      enabled: false,
      url: '',
      minSeverity: 'high'
    }
  },
  aiSummary: {
    enabled: false,
    mode: 'local-placeholder'
  },
  retentionDays: 30
};

export function createStore(options = {}) {
  const servers = new Map();
  const snapshots = new Map();
  const snapshotHistory = new Map(); // serverId -> ascending array of snapshots
  const reports = new Map();
  const reportsById = new Map();
  const reportHistory = [];
  const analysisJobs = [];
  const alertInbox = [];
  const alertsById = new Map();
  let settings = structuredClone(defaultSettings);
  let serverSeq = 0;
  let jobSeq = 0;
  const cipher = createCredentialCipher(options.credentialKey ?? process.env.SERVERLENS_CRED_KEY ?? '');
  const db = options.dbPath ? openDatabase(options.dbPath) : null;

  if (db) {
    loadPersistedState();
  }

  return {
    createServer(input) {
      const normalized = normalizeServerInput(input);
      serverSeq += 1;
      const id = `server-${serverSeq}-${shortId()}`;
      const server = {
        id,
        ...normalized,
        connection: {
          status: 'untested',
          checkedAt: null,
          message: 'Connection has not been tested.'
        },
        archived: false,
        archivedAt: null,
        createdAt: new Date().toISOString()
      };
      servers.set(id, server);
      persistRecord('servers', id, server);
      return server;
    },
    updateServer(id, input) {
      const existing = servers.get(id);
      if (!existing) return null;
      const normalized = normalizeServerInput(input);
      const endpointChanged = normalized.host !== existing.host
        || normalized.port !== existing.port
        || normalized.authType !== existing.authType
        || normalized.mode !== existing.mode
        || normalized.username !== existing.username
        || normalized.keyPath !== existing.keyPath;
      const server = {
        ...existing,
        ...normalized,
        connection: endpointChanged
          ? {
            status: 'untested',
            checkedAt: null,
            message: 'Connection has not been tested after the latest asset edit.'
          }
          : existing.connection
      };
      servers.set(id, server);
      persistRecord('servers', id, server);
      return server;
    },
    archiveServer(id) {
      const server = servers.get(id);
      if (!server) return null;
      server.archived = true;
      server.archivedAt = new Date().toISOString();
      persistRecord('servers', id, server);
      return server;
    },
    restoreServer(id) {
      const server = servers.get(id);
      if (!server) return null;
      server.archived = false;
      server.archivedAt = null;
      persistRecord('servers', id, server);
      return server;
    },
    exportServerInventory() {
      return {
        format: 'serverlens.inventory.v1',
        exportedAt: new Date().toISOString(),
        servers: [...servers.values()].map(exportServerAsset)
      };
    },
    importServerInventory(input = {}) {
      const assets = Array.isArray(input.servers) ? input.servers : [];
      if (assets.length === 0) {
        throw validationError('Inventory import requires a servers array.');
      }
      let imported = 0;
      let skipped = 0;
      const created = [];
      for (const asset of assets) {
        const normalized = normalizeServerInput(asset);
        const duplicate = [...servers.values()].some((server) => {
          return server.name === normalized.name
            && server.host === normalized.host
            && server.port === normalized.port;
        });
        if (duplicate) {
          skipped += 1;
          continue;
        }
        const server = this.createServer(normalized);
        if (asset.archived) {
          server.archived = true;
          server.archivedAt = typeof asset.archivedAt === 'string' && asset.archivedAt
            ? asset.archivedAt
            : new Date().toISOString();
          persistRecord('servers', server.id, server);
        }
        imported += 1;
        created.push(server);
      }
      return {
        imported,
        skipped,
        servers: created
      };
    },
    listServers(options = {}) {
      return [...servers.values()]
        .filter((server) => options.includeArchived || !server.archived)
        .map((server) => ({
        ...server,
        latestSnapshot: snapshots.get(server.id) ?? null,
        latestReport: reports.get(server.id) ?? null
      }));
    },
    getServer(id) {
      return servers.get(id) ?? null;
    },
    getServerDetail(id) {
      const server = servers.get(id) ?? null;
      if (!server) return null;
      return {
        server,
        snapshot: snapshots.get(id) ?? null,
        report: reports.get(id) ?? null,
        jobs: analysisJobs.filter((job) => job.serverId === id)
      };
    },
    updateServerConnection(id, result) {
      const server = servers.get(id);
      if (!server) return null;
      server.connection = {
        status: result.status,
        reachable: result.reachable ?? null,
        checkedAt: result.checkedAt,
        message: result.message,
        stages: Array.isArray(result.stages) ? result.stages : [],
        ssh: result.ssh ?? null,
        nextActions: Array.isArray(result.nextActions) ? result.nextActions : []
      };
      persistRecord('servers', id, server);
      return server.connection;
    },
    saveSnapshot(snapshot) {
      snapshots.set(snapshot.serverId, snapshot);
      persistRecord('snapshots', snapshot.serverId, snapshot);
      appendSnapshotHistory(snapshot);
      return snapshot;
    },
    getSnapshot(serverId) {
      return snapshots.get(serverId) ?? null;
    },
    listSnapshotHistory(serverId, limit = 48) {
      const history = snapshotHistory.get(serverId) ?? [];
      const bounded = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : history.length;
      return history.slice(-bounded).map((entry) => structuredClone(entry));
    },
    saveReport(report) {
      reports.set(report.serverId, report);
      if (!reportsById.has(report.id)) {
        reportHistory.unshift(report);
      }
      reportsById.set(report.id, report);
      persistRecord('reports', report.id, report);
      return report;
    },
    createAlertsForReport(report, server) {
      if (!settings.notifications.inboxEnabled) return [];
      const allowedSeverities = new Set(settings.notifications.alertSeverities ?? ['critical', 'high']);
      const createdAt = new Date().toISOString();
      const alerts = report.findings
        .filter((finding) => allowedSeverities.has(finding.severity))
        .map((finding) => {
          const id = `alert-${report.id}-${slug(finding.id)}`;
          const existing = alertsById.get(id);
          if (existing) return existing;
          const alert = {
            id,
            reportId: report.id,
            serverId: report.serverId,
            serverName: server?.name ?? report.summary.hostname,
            findingId: finding.id,
            severity: finding.severity,
            category: finding.category,
            title: finding.title,
            evidence: finding.evidence,
            recommendation: finding.recommendation,
            commands: finding.commands ?? [],
            status: 'unread',
            createdAt,
            acknowledgedAt: null
          };
          alertsById.set(id, alert);
          alertInbox.unshift(alert);
          persistRecord('alerts', id, alert);
          return alert;
        });
      return alerts;
    },
    listAlerts() {
      return [...alertInbox].sort(compareAlerts);
    },
    acknowledgeAlert(id) {
      const alert = alertsById.get(id);
      if (!alert) return null;
      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date().toISOString();
      persistRecord('alerts', id, alert);
      return alert;
    },
    getReport(id) {
      return reportsById.get(id) ?? null;
    },
    listReports() {
      return [...reportHistory].sort(compareReports);
    },
    createAnalysisJob(input) {
      jobSeq += 1;
      const job = {
        id: `job-${jobSeq}-${shortId()}`,
        serverId: input.serverId,
        preset: input.preset ?? 'custom',
        modules: input.modules,
        depth: input.depth ?? 'standard',
        timeRange: input.timeRange ?? 'latest-snapshot',
        status: 'running',
        progress: 68,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        reportId: null
      };
      analysisJobs.unshift(job);
      persistRecord('analysis_jobs', job.id, job);
      return job;
    },
    completeAnalysisJob(jobId, report) {
      const job = analysisJobs.find((item) => item.id === jobId);
      if (!job) return null;
      job.status = 'completed';
      job.progress = 100;
      job.finishedAt = new Date().toISOString();
      job.reportId = report.id;
      persistRecord('analysis_jobs', job.id, job);
      return job;
    },
    listAnalysisJobs() {
      return [...analysisJobs];
    },
    runRetentionMaintenance(options = {}) {
      const retentionDays = normalizeRetentionDays(options.retentionDays ?? settings.retentionDays);
      const now = options.now ? new Date(options.now) : new Date();
      const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
      const latestReportIds = new Set([...reports.values()].map((report) => report.id));
      const deleted = {
        snapshots: 0,
        snapshotHistory: 0,
        reports: 0,
        analysisJobs: 0,
        alerts: 0
      };

      for (const [serverId, list] of snapshotHistory.entries()) {
        if (list.length === 0) continue;
        const latest = list[list.length - 1];
        const kept = list.filter((entry) => entry === latest || !isOlderThan(entry.collectedAt, cutoff));
        const removed = list.filter((entry) => entry !== latest && isOlderThan(entry.collectedAt, cutoff));
        for (const entry of removed) {
          deleteRecord('snapshot_history', `snaphist-${entry.id}`);
        }
        deleted.snapshotHistory += removed.length;
        snapshotHistory.set(serverId, kept);
      }

      for (let index = reportHistory.length - 1; index >= 0; index -= 1) {
        const report = reportHistory[index];
        if (latestReportIds.has(report.id) || !isOlderThan(report.generatedAt, cutoff)) continue;
        reportHistory.splice(index, 1);
        reportsById.delete(report.id);
        deleteRecord('reports', report.id);
        deleted.reports += 1;
      }

      for (let index = analysisJobs.length - 1; index >= 0; index -= 1) {
        const job = analysisJobs[index];
        if (latestReportIds.has(job.reportId) || !isOlderThan(job.finishedAt ?? job.startedAt, cutoff)) continue;
        analysisJobs.splice(index, 1);
        deleteRecord('analysis_jobs', job.id);
        deleted.analysisJobs += 1;
      }

      for (let index = alertInbox.length - 1; index >= 0; index -= 1) {
        const alert = alertInbox[index];
        if (latestReportIds.has(alert.reportId) || !isOlderThan(alert.createdAt, cutoff)) continue;
        alertInbox.splice(index, 1);
        alertsById.delete(alert.id);
        deleteRecord('alerts', alert.id);
        deleted.alerts += 1;
      }

      return {
        retentionDays,
        cutoff: cutoff.toISOString(),
        deleted,
        preservedLatestReports: latestReportIds.size,
        ranAt: now.toISOString()
      };
    },
    getSettings() {
      return structuredClone(settings);
    },
    updateSettings(input) {
      settings = {
        ...settings,
        ...input,
        thresholds: {
          ...settings.thresholds,
          ...(input.thresholds ?? {})
        },
        notifications: {
          ...settings.notifications,
          ...(input.notifications ?? {}),
          webhook: {
            ...settings.notifications.webhook,
            ...(input.notifications?.webhook ?? {})
          }
        },
        aiSummary: {
          ...settings.aiSummary,
          ...(input.aiSummary ?? {})
        }
      };
      persistSetting(settings);
      return structuredClone(settings);
    },
    close() {
      db?.close();
    }
  };

  function loadPersistedState() {
    for (const row of db.prepare('SELECT id, payload FROM servers').all()) {
      servers.set(row.id, cipher.decryptServer(JSON.parse(row.payload)));
      serverSeq = Math.max(serverSeq, seqFromId(row.id));
    }
    for (const row of db.prepare('SELECT id, payload FROM snapshots').all()) {
      snapshots.set(row.id, JSON.parse(row.payload));
    }
    for (const row of db.prepare('SELECT server_id, payload FROM snapshot_history ORDER BY collected_at ASC').all()) {
      const snapshot = JSON.parse(row.payload);
      const list = snapshotHistory.get(row.server_id) ?? [];
      list.push(snapshot);
      if (list.length > MAX_SNAPSHOT_HISTORY) {
        list.splice(0, list.length - MAX_SNAPSHOT_HISTORY);
      }
      snapshotHistory.set(row.server_id, list);
    }
    for (const row of db.prepare('SELECT id, payload FROM reports ORDER BY started_at DESC').all()) {
      const report = JSON.parse(row.payload);
      const latest = reports.get(report.serverId);
      if (!latest || compareReports(report, latest) < 0) {
        reports.set(report.serverId, report);
      }
      reportsById.set(report.id, report);
      reportHistory.push(report);
    }
    for (const row of db.prepare('SELECT id, payload FROM analysis_jobs ORDER BY started_at DESC').all()) {
      analysisJobs.push(JSON.parse(row.payload));
      jobSeq = Math.max(jobSeq, seqFromId(row.id));
    }
    for (const row of db.prepare('SELECT id, payload FROM alerts ORDER BY started_at DESC').all()) {
      const alert = JSON.parse(row.payload);
      alertsById.set(row.id, alert);
      alertInbox.push(alert);
    }
    const persistedSettings = db.prepare('SELECT payload FROM settings WHERE id = ?').get('default');
    if (persistedSettings) {
      settings = mergeSettings(JSON.parse(persistedSettings.payload));
    }
  }

  function persistRecord(table, id, payload) {
    if (!db) return;
    const startedAt = payload.startedAt ?? payload.createdAt ?? payload.generatedAt ?? new Date().toISOString();
    const stored = table === 'servers' ? cipher.encryptServer(payload) : payload;
    db.prepare(`INSERT OR REPLACE INTO ${table} (id, payload, started_at) VALUES (?, ?, ?)`)
      .run(id, JSON.stringify(stored), startedAt);
  }

  function persistSetting(payload) {
    if (!db) return;
    db.prepare('INSERT OR REPLACE INTO settings (id, payload) VALUES (?, ?)')
      .run('default', JSON.stringify(payload));
  }

  function appendSnapshotHistory(snapshot) {
    const serverId = snapshot.serverId;
    const list = snapshotHistory.get(serverId) ?? [];
    list.push(structuredClone(snapshot));
    list.sort((left, right) => left.collectedAt.localeCompare(right.collectedAt));
    if (list.length > MAX_SNAPSHOT_HISTORY) {
      list.splice(0, list.length - MAX_SNAPSHOT_HISTORY);
    }
    snapshotHistory.set(serverId, list);
    if (!db) return;
    const historyId = `snaphist-${snapshot.id}`;
    db.prepare('INSERT OR REPLACE INTO snapshot_history (id, server_id, payload, collected_at) VALUES (?, ?, ?, ?)')
      .run(historyId, serverId, JSON.stringify(snapshot), snapshot.collectedAt);
  }

  function deleteRecord(table, id) {
    if (!db) return;
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  }
}

function openDatabase(dbPath) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      started_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      started_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS snapshot_history (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      collected_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_snapshot_history_server
      ON snapshot_history (server_id, collected_at);
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      started_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS analysis_jobs (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      started_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      started_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL
    );
  `);
  return db;
}

function mergeSettings(input = {}) {
  return {
    ...defaultSettings,
    ...input,
    thresholds: {
      ...defaultSettings.thresholds,
      ...(input.thresholds ?? {})
    },
    notifications: {
      ...defaultSettings.notifications,
      ...(input.notifications ?? {}),
      webhook: {
        ...defaultSettings.notifications.webhook,
        ...(input.notifications?.webhook ?? {})
      }
    },
    aiSummary: {
      ...defaultSettings.aiSummary,
      ...(input.aiSummary ?? {})
    }
  };
}

function compareReports(left, right) {
  return right.generatedAt.localeCompare(left.generatedAt);
}

function compareAlerts(left, right) {
  return right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id);
}

function isOlderThan(value, cutoff) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time < cutoff.getTime();
}

function normalizeRetentionDays(value) {
  const days = Number(value);
  if (!Number.isFinite(days)) return defaultSettings.retentionDays;
  return Math.max(1, Math.min(365, Math.floor(days)));
}

function slug(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}

function shortId() {
  return randomBytes(5).toString('hex');
}

function seqFromId(id) {
  const match = String(id ?? '').match(/-(\d+)(?:-|$)/);
  return match ? Number(match[1]) : 0;
}

function exportServerAsset(server) {
  return {
    name: server.name,
    host: server.host,
    port: server.port,
    mode: server.mode,
    authType: server.authType,
    username: server.username,
    keyPath: server.keyPath,
    group: server.group,
    tags: [...server.tags],
    archived: Boolean(server.archived),
    archivedAt: server.archivedAt ?? null
  };
}

function normalizeServerInput(input = {}) {
  const name = String(input.name ?? '').trim();
  const host = String(input.host ?? '').trim();
  const port = Number(input.port ?? 22);
  const authType = String(input.authType ?? input.auth_type ?? 'none').trim() || 'none';
  const group = String(input.group ?? 'default').trim() || 'default';
  const mode = String(input.mode ?? 'demo').trim() || 'demo';
  const username = String(input.username ?? '').trim();
  const keyPath = String(input.keyPath ?? input.key_path ?? '').trim();

  if (!name || !host) {
    throw validationError('Server name and host are required.');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw validationError('Server port must be an integer from 1 to 65535.');
  }
  if (!['none', 'ssh-key', 'password', 'agent'].includes(authType)) {
    throw validationError('Unsupported authentication type.');
  }
  if (!['demo', 'local', 'ssh'].includes(mode)) {
    throw validationError('Unsupported collection mode.');
  }
  if (mode === 'ssh' && authType === 'password') {
    throw validationError('Password authentication is not stored. Use SSH agent or key collection.');
  }

  return {
    name,
    host,
    port,
    authType,
    group,
    mode,
    username,
    keyPath,
    tags: normalizeTags(input.tags)
  };
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }
  return String(tags ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
