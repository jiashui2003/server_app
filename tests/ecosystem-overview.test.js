import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEcosystemOverview } from '../src/shared/ecosystem-overview.js';

// Two synthetic servers with real-shaped snapshots and ascending history.
function makeServer(id, overrides = {}) {
  return {
    id,
    name: `srv-${id}`,
    latestSnapshot: {
      collectedAt: new Date().toISOString(),
      resources: { cpuPercent: 60, memoryPercent: 50, diskPercent: 40, ioWaitPercent: 5 },
      services: [
        { name: 'nginx', status: 'running' },
        { name: 'postgres', status: 'running' }
      ],
      containers: [
        { name: 'api', status: 'running', restarts: 0 }
      ],
      ports: [
        { port: 22, exposure: 'public' },
        { port: 5432, exposure: 'private' }
      ],
      firewall: { exposedHighRiskPorts: [] },
      ...overrides.snapshot
    },
    latestReport: overrides.report ?? null
  };
}

function ascendingHistory(count, base = 40) {
  return Array.from({ length: count }, (_, index) => ({
    collectedAt: new Date(Date.now() - (count - index) * 60000).toISOString(),
    resources: { cpuPercent: base + index, memoryPercent: base + index }
  }));
}

test('aggregates resource pressure, services, containers, and exposure across the fleet', () => {
  const servers = [
    makeServer('a'),
    makeServer('b', {
      snapshot: {
        resources: { cpuPercent: 80, memoryPercent: 70, diskPercent: 90, ioWaitPercent: 20 },
        containers: [{ name: 'worker', status: 'restarting', restarts: 5 }],
        ports: [{ port: 443, exposure: 'public' }],
        firewall: { exposedHighRiskPorts: [3306] }
      }
    })
  ];

  const overview = buildEcosystemOverview({ servers });

  assert.equal(overview.fleet.total, 2);
  assert.equal(overview.fleet.withTelemetry, 2);
  // Resource pressure averages both hosts and tracks the peak.
  assert.equal(overview.resourcePressure.metrics.cpuPercent.average, 70);
  assert.equal(overview.resourcePressure.metrics.cpuPercent.peak, 80);
  assert.ok(overview.resourcePressure.hottestServer);
  // Services rolled up by role with running counts.
  assert.ok(overview.serviceEcosystem.running >= 2);
  assert.ok(Array.isArray(overview.serviceEcosystem.roles));
  // Container fleet sees the restarting hotspot.
  assert.equal(overview.containerFleet.restarting, 1);
  assert.ok(overview.containerFleet.restartHotspots.some((h) => h.restarts === 5));
  // Exposure surface separates public/private and flags high-risk ports.
  assert.ok(overview.exposureSurface.publicPorts >= 2);
  assert.ok(overview.exposureSurface.highRiskExposed.some((entry) => entry.port === 3306));
});

test('flags insufficient history honestly instead of fabricating a fleet trend', () => {
  const servers = [makeServer('a')];
  // Only two aligned points — below the 3-point minimum.
  const overview = buildEcosystemOverview({
    servers,
    histories: { a: ascendingHistory(2) }
  });

  assert.equal(overview.freshness.fleetTrend.status, 'insufficient-history');
  assert.ok(overview.freshness.fleetTrend.dataPoints < overview.freshness.fleetTrend.minPoints);
});

test('reports a ready fleet trend once enough aligned points exist', () => {
  const servers = [makeServer('a'), makeServer('b')];
  const overview = buildEcosystemOverview({
    servers,
    histories: { a: ascendingHistory(6), b: ascendingHistory(6, 30) }
  });

  assert.equal(overview.freshness.fleetTrend.status, 'ready');
  assert.ok(overview.freshness.fleetTrend.cpu.length >= 3);
  assert.ok(['rising', 'falling', 'steady'].includes(overview.freshness.cpuDirection));
});

test('rolls up risk distribution from report findings', () => {
  const servers = [
    makeServer('a', {
      report: {
        findings: [
          { severity: 'critical', category: 'security' },
          { severity: 'high', category: 'network' },
          { severity: 'high', category: 'security' }
        ]
      }
    })
  ];

  const overview = buildEcosystemOverview({ servers });

  assert.equal(overview.riskDistribution.total, 3);
  assert.equal(overview.riskDistribution.bySeverity.critical, 1);
  assert.equal(overview.riskDistribution.bySeverity.high, 2);
  assert.equal(overview.riskDistribution.byCategory[0].category, 'security');
});

test('is safe and honest on an empty fleet', () => {
  const overview = buildEcosystemOverview({ servers: [] });

  assert.equal(overview.fleet.total, 0);
  assert.equal(overview.fleet.withTelemetry, 0);
  assert.equal(overview.resourcePressure.hottestServer, null);
  assert.equal(overview.serviceEcosystem.running, 0);
  assert.equal(overview.containerFleet.total, 0);
  assert.equal(overview.exposureSurface.publicPorts, 0);
  assert.equal(overview.riskDistribution.total, 0);
  assert.equal(overview.freshness.fleetTrend.status, 'insufficient-history');
});

test('output carries no secrets (no passwords, key paths, ssh usernames, or raw payloads)', () => {
  const servers = [
    makeServer('a', {
      // Even if the server object carries sensitive metadata, the overview must not surface it.
      snapshot: {}
    })
  ];
  servers[0].username = 'root';
  servers[0].keyPath = 'C:/secrets/id_ed25519';
  servers[0].password = 'should-never-appear';

  const overview = buildEcosystemOverview({ servers });
  const serialized = JSON.stringify(overview);

  assert.ok(!serialized.includes('root'));
  assert.ok(!serialized.includes('id_ed25519'));
  assert.ok(!serialized.includes('should-never-appear'));
  assert.ok(!serialized.toLowerCase().includes('password'));
  assert.ok(!serialized.toLowerCase().includes('keypath'));
});
