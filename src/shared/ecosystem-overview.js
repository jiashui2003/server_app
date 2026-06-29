// Fleet-wide ecosystem aggregation (ServerLens 16.0).
//
// This is a PURE function: it only aggregates data the store already holds
// (servers, latest snapshots, snapshot history, latest reports). It triggers
// NO new collection, opens NO network connection, and calls NO external
// service. Every number it returns is derived from real collected telemetry
// and real rule-engine findings — there are no simulated/sine-wave values.
//
// It deliberately excludes secrets: no passwords, key paths, SSH usernames,
// raw logs, or full telemetry payloads appear in the output — only the same
// counts/labels the per-server detail views already show, rolled up.

import { inferServiceRole } from './analysis-engine.js';

const TREND_MIN_POINTS = 3;
const TREND_MAX_POINTS = 48;

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function round(value) {
  return Math.round(Number(value) || 0);
}

// Honest fleet-average trend across the most recent collections. Mirrors the
// v12 buildTrends honesty contract: when fewer than TREND_MIN_POINTS aligned
// points exist the series is flagged `insufficient-history` rather than padded.
function buildFleetTrend(histories) {
  // Each history is an ascending array of snapshots for one server. We average
  // the cpu/memory across servers at each of the last N positions so the line
  // reflects real fleet pressure over time, not a single host.
  const maxLen = histories.reduce((max, h) => Math.max(max, h.length), 0);
  const points = Math.min(maxLen, TREND_MAX_POINTS);
  const cpu = [];
  const memory = [];
  for (let offset = points; offset >= 1; offset -= 1) {
    const cpuSamples = [];
    const memSamples = [];
    for (const history of histories) {
      const entry = history[history.length - offset];
      if (entry && entry.resources) {
        cpuSamples.push(Number(entry.resources.cpuPercent) || 0);
        memSamples.push(Number(entry.resources.memoryPercent) || 0);
      }
    }
    if (cpuSamples.length > 0) {
      cpu.push(clamp(round(cpuSamples.reduce((a, b) => a + b, 0) / cpuSamples.length), 0, 100));
      memory.push(clamp(round(memSamples.reduce((a, b) => a + b, 0) / memSamples.length), 0, 100));
    }
  }
  const dataPoints = cpu.length;
  return {
    status: dataPoints >= TREND_MIN_POINTS ? 'ready' : 'insufficient-history',
    dataPoints,
    minPoints: TREND_MIN_POINTS,
    cpu,
    memory
  };
}

function trendDirection(series) {
  if (!Array.isArray(series) || series.length < TREND_MIN_POINTS) return 'insufficient-history';
  const head = series[0];
  const tail = series[series.length - 1];
  const delta = tail - head;
  if (delta >= 5) return 'rising';
  if (delta <= -5) return 'falling';
  return 'steady';
}

export function buildEcosystemOverview(input = {}) {
  const servers = Array.isArray(input.servers) ? input.servers : [];
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const now = input.now ? Date.parse(input.now) : Date.now();

  // Resolve per-server snapshot + history + report from either explicit maps or
  // the server objects themselves (listServers already attaches latestSnapshot).
  const resolved = servers.map((server) => {
    const snapshot = input.snapshots?.[server.id] ?? server.latestSnapshot ?? null;
    const history = input.histories?.[server.id] ?? [];
    const report = input.reports?.[server.id] ?? server.latestReport ?? null;
    return { server, snapshot, history, report };
  });

  const withSnapshot = resolved.filter((item) => item.snapshot);

  return {
    product: 'ServerLens',
    mode: 'local-fleet-ecosystem',
    generatedAt,
    fleet: {
      total: servers.length,
      withTelemetry: withSnapshot.length,
      withReport: resolved.filter((item) => item.report).length
    },
    resourcePressure: buildResourcePressure(withSnapshot),
    serviceEcosystem: buildServiceEcosystem(withSnapshot),
    containerFleet: buildContainerFleet(withSnapshot),
    exposureSurface: buildExposureSurface(withSnapshot),
    riskDistribution: buildRiskDistribution(resolved),
    freshness: buildFreshness(resolved, now),
    note: 'Aggregated from local collected telemetry and rule-engine findings only. No new collection, no outbound calls, no secrets.'
  };
}

function buildResourcePressure(withSnapshot) {
  const metrics = ['cpuPercent', 'memoryPercent', 'diskPercent', 'ioWaitPercent'];
  const summary = {};
  for (const metric of metrics) {
    const values = withSnapshot.map((item) => Number(item.snapshot.resources?.[metric]) || 0);
    summary[metric] = {
      average: values.length ? clamp(round(values.reduce((a, b) => a + b, 0) / values.length), 0, 100) : 0,
      peak: values.length ? clamp(round(Math.max(...values)), 0, 100) : 0
    };
  }
  // Highest-pressure host by a simple composite of cpu+memory+disk.
  let hottest = null;
  for (const item of withSnapshot) {
    const r = item.snapshot.resources ?? {};
    const score = (Number(r.cpuPercent) || 0) + (Number(r.memoryPercent) || 0) + (Number(r.diskPercent) || 0);
    if (!hottest || score > hottest.score) {
      hottest = { name: item.server.name, score, cpu: round(r.cpuPercent), memory: round(r.memoryPercent), disk: round(r.diskPercent) };
    }
  }
  return {
    metrics: summary,
    hottestServer: hottest ? { name: hottest.name, cpu: hottest.cpu, memory: hottest.memory, disk: hottest.disk } : null
  };
}

function buildServiceEcosystem(withSnapshot) {
  const roles = {};
  let running = 0;
  let stopped = 0;
  for (const item of withSnapshot) {
    for (const service of item.snapshot.services ?? []) {
      const role = inferServiceRole(service.name);
      roles[role] = roles[role] ?? { role, running: 0, total: 0 };
      roles[role].total += 1;
      if (service.status === 'running') {
        roles[role].running += 1;
        running += 1;
      } else {
        stopped += 1;
      }
    }
  }
  return {
    running,
    stopped,
    roles: Object.values(roles).sort((a, b) => b.total - a.total)
  };
}

function buildContainerFleet(withSnapshot) {
  let running = 0;
  let restarting = 0;
  let stopped = 0;
  const restartHotspots = [];
  for (const item of withSnapshot) {
    for (const container of item.snapshot.containers ?? []) {
      if (container.status === 'running') running += 1;
      else if (container.status === 'restarting') restarting += 1;
      else stopped += 1;
      if ((Number(container.restarts) || 0) >= 3) {
        restartHotspots.push({
          server: item.server.name,
          name: container.name,
          status: container.status,
          restarts: Number(container.restarts) || 0
        });
      }
    }
  }
  restartHotspots.sort((a, b) => b.restarts - a.restarts);
  return { running, restarting, stopped, total: running + restarting + stopped, restartHotspots };
}

function buildExposureSurface(withSnapshot) {
  let publicPorts = 0;
  let privatePorts = 0;
  const highRisk = [];
  for (const item of withSnapshot) {
    for (const port of item.snapshot.ports ?? []) {
      if (port.exposure === 'public') publicPorts += 1;
      else privatePorts += 1;
    }
    for (const riskPort of item.snapshot.firewall?.exposedHighRiskPorts ?? []) {
      highRisk.push({ server: item.server.name, port: riskPort });
    }
  }
  return { publicPorts, privatePorts, highRiskExposed: highRisk };
}

function buildRiskDistribution(resolved) {
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const byCategory = {};
  for (const item of resolved) {
    for (const finding of item.report?.findings ?? []) {
      if (bySeverity[finding.severity] !== undefined) bySeverity[finding.severity] += 1;
      byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1;
    }
  }
  const total = Object.values(bySeverity).reduce((a, b) => a + b, 0);
  return {
    total,
    bySeverity,
    byCategory: Object.entries(byCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
  };
}

function buildFreshness(resolved, now) {
  const fleetTrend = buildFleetTrend(resolved.map((item) => item.history).filter((h) => Array.isArray(h) && h.length));
  const servers = resolved.map((item) => {
    const collectedAt = item.snapshot?.collectedAt ?? null;
    const ageMinutes = collectedAt ? Math.max(0, Math.round((now - Date.parse(collectedAt)) / 60000)) : null;
    return {
      name: item.server.name,
      ageMinutes,
      status: ageMinutes === null ? 'no-data' : ageMinutes > 15 ? 'stale' : 'fresh'
    };
  });
  return {
    servers,
    fleetTrend,
    cpuDirection: trendDirection(fleetTrend.cpu),
    memoryDirection: trendDirection(fleetTrend.memory)
  };
}
