import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeSnapshot, calculateHealthScore } from '../src/shared/analysis-engine.js';

const riskySnapshot = {
  id: 'snapshot-risky',
  serverId: 'server-1',
  collectedAt: '2026-06-06T09:00:00.000Z',
  system: {
    hostname: 'prod-edge-01',
    platform: 'linux',
    uptimeSeconds: 86400,
    loadAverage: [6.4, 5.9, 5.1]
  },
  resources: {
    cpuPercent: 92,
    memoryPercent: 88,
    diskPercent: 94,
    diskReadMbps: 18,
    diskWriteMbps: 42,
    ioWaitPercent: 4,
    networkRxMbps: 180,
    networkTxMbps: 220
  },
  ports: [
    { port: 22, protocol: 'tcp', process: 'sshd', exposure: 'public' },
    { port: 3306, protocol: 'tcp', process: 'mysqld', exposure: 'public' },
    { port: 443, protocol: 'tcp', process: 'nginx', exposure: 'public' }
  ],
  services: [
    { name: 'nginx', status: 'running' },
    { name: 'mysql', status: 'degraded' },
    { name: 'redis', status: 'stopped' }
  ],
  containers: [
    { name: 'api', image: 'server-api:latest', status: 'running', restarts: 0 },
    { name: 'worker', image: 'jobs:latest', status: 'restarting', restarts: 7 }
  ],
  securityEvents: {
    failedSshLogins10m: 86,
    suspiciousConnections: [
      { remoteAddress: '203.0.113.77', port: 22, count: 44 }
    ]
  }
};

test('analyzeSnapshot only runs selected modules and returns explainable findings', () => {
  const report = analyzeSnapshot(riskySnapshot, {
    modules: ['security', 'runtime']
  });

  assert.equal(report.modulesRun.length, 2);
  assert.deepEqual(report.modulesRun, ['security', 'runtime']);
  assert.equal(report.summary.hostname, 'prod-edge-01');
  assert.ok(report.findings.some((finding) => finding.id === 'security.ssh-bruteforce'));
  assert.ok(report.findings.some((finding) => finding.id === 'runtime.service-degraded'));
  assert.ok(!report.findings.some((finding) => finding.id === 'health.cpu-high'));
  assert.ok(report.findings.every((finding) => finding.evidence.length > 0));
  assert.ok(report.findings.every((finding) => finding.recommendation.length > 0));
  assert.ok(report.findings.every((finding) => finding.commands.length > 0));
});

test('analyzeSnapshot expands analysis presets into modules, depth, and time range', () => {
  const report = analyzeSnapshot(riskySnapshot, {
    preset: 'security-review'
  });

  assert.equal(report.analysisScope.preset, 'security-review');
  assert.equal(report.analysisScope.depth, 'deep');
  assert.equal(report.analysisScope.timeRange, 'last-1h');
  assert.deepEqual(report.modulesRun, ['security', 'logs', 'network']);
  assert.ok(report.findings.every((finding) => ['security', 'logs', 'network'].includes(finding.category)));
});

test('calculateHealthScore penalizes critical and high findings more than warnings', () => {
  const score = calculateHealthScore([
    { severity: 'critical' },
    { severity: 'high' },
    { severity: 'medium' },
    { severity: 'low' }
  ]);

  assert.equal(score, 50);
});

test('analyzeSnapshot produces a full report with ordered severities and a bounded score', () => {
  const report = analyzeSnapshot(riskySnapshot, {
    modules: ['health', 'security', 'runtime', 'ecosystem']
  });

  assert.equal(report.status, 'attention');
  assert.ok(report.score >= 0);
  assert.ok(report.score <= 100);
  assert.equal(report.findings[0].severity, 'critical');
  assert.ok(report.findings.some((finding) => finding.id === 'ecosystem.public-database'));
  assert.ok(report.findings.some((finding) => finding.id === 'ecosystem.container-restarts'));
  assert.ok(report.findings.some((finding) => finding.commands.some((command) => command.includes('journalctl'))));
  assert.ok(report.findings.some((finding) => finding.commands.some((command) => command.includes('df -h'))));
});

test('analyzeSnapshot builds a service topology from ports, services, containers, and findings', () => {
  const report = analyzeSnapshot(riskySnapshot, {
    modules: ['health', 'security', 'runtime', 'ecosystem', 'network']
  });

  assert.equal(report.topology.root.label, 'prod-edge-01');
  assert.ok(report.topology.nodes.some((node) => node.kind === 'service' && node.label === 'mysql'));
  assert.ok(report.topology.nodes.some((node) => node.kind === 'port' && node.label === 'tcp/3306'));
  assert.ok(report.topology.nodes.some((node) => node.kind === 'container' && node.label === 'worker'));
  assert.ok(report.topology.edges.some((edge) => edge.label === 'listens on'));
  assert.ok(report.topology.edges.some((edge) => edge.label === 'runs container'));
  assert.ok(report.topology.risks.some((risk) => risk.nodeId.includes('port-3306') && risk.severity === 'high'));
});

test('analyzeSnapshot builds an operator service catalog with roles, exposure, health, and actions', () => {
  const report = analyzeSnapshot({
    ...riskySnapshot,
    ports: [
      ...riskySnapshot.ports,
      { port: 6379, protocol: 'tcp', process: 'redis-server', exposure: 'private' },
      { port: 3000, protocol: 'tcp', process: 'node-api', exposure: 'private' }
    ],
    services: [
      ...riskySnapshot.services,
      { name: 'node-api', status: 'running' }
    ]
  }, {
    modules: ['runtime', 'ecosystem', 'network']
  });

  assert.ok(Array.isArray(report.serviceCatalog));
  assert.ok(report.serviceCatalog.length >= 5);

  const mysql = report.serviceCatalog.find((entry) => entry.name === 'mysql');
  assert.equal(mysql.role, 'database');
  assert.equal(mysql.health, 'degraded');
  assert.equal(mysql.exposure, 'public');
  assert.ok(mysql.ports.some((port) => port.port === 3306));
  assert.ok(mysql.risks.some((risk) => risk.severity === 'high'));
  assert.match(mysql.recommendation, /private network/i);

  const redis = report.serviceCatalog.find((entry) => entry.name === 'redis');
  assert.equal(redis.role, 'cache');
  assert.equal(redis.exposure, 'private');
  assert.ok(redis.ports.some((port) => port.port === 6379));

  const nodeApi = report.serviceCatalog.find((entry) => entry.name === 'node-api');
  assert.equal(nodeApi.role, 'application');
  assert.equal(nodeApi.health, 'running');
  assert.ok(nodeApi.backing.some((item) => item.kind === 'container' && item.name === 'api'));
});

test('analyzeSnapshot flags unknown public listeners with defensive evidence', () => {
  const report = analyzeSnapshot({
    ...riskySnapshot,
    ports: [
      ...riskySnapshot.ports,
      { port: 49152, protocol: 'tcp', process: 'unknown', exposure: 'public' }
    ]
  }, {
    modules: ['network']
  });

  const finding = report.findings.find((item) => item.id === 'network.unknown-public-listener');
  assert.ok(finding);
  assert.equal(finding.severity, 'medium');
  assert.match(finding.evidence.join(' '), /49152/);
  assert.match(finding.recommendation, /owner/i);
  assert.ok(finding.commands.some((command) => command.includes('ss -tulpen')));
});

test('analyzeSnapshot flags disk IO pressure with defensive diagnostics', () => {
  const report = analyzeSnapshot({
    ...riskySnapshot,
    resources: {
      ...riskySnapshot.resources,
      diskReadMbps: 82,
      diskWriteMbps: 260,
      ioWaitPercent: 24
    }
  }, {
    modules: ['performance']
  });

  const finding = report.findings.find((item) => item.id === 'performance.disk-io-pressure');
  assert.ok(finding);
  assert.equal(finding.severity, 'medium');
  assert.match(finding.evidence.join(' '), /iowait/i);
  assert.match(finding.evidence.join(' '), /260/);
  assert.ok(finding.commands.some((command) => command.includes('iostat')));
  assert.ok(finding.commands.some((command) => command.includes('iotop') || command.includes('pidstat')));
});

test('analyzeSnapshot builds an evidence-backed risk event timeline', () => {
  const report = analyzeSnapshot({
    ...riskySnapshot,
    logs: {
      errorCount1h: 31,
      authFailures1h: 140
    },
    ports: [
      ...riskySnapshot.ports,
      { port: 49152, protocol: 'tcp', process: 'unknown', exposure: 'public' }
    ]
  }, {
    modules: ['security', 'logs', 'network']
  });

  assert.equal(report.riskEventTimeline.mode, 'local-evidence-timeline');
  assert.ok(report.riskEventTimeline.generatedAt);
  assert.ok(report.riskEventTimeline.summary.total >= 5);
  assert.ok(report.riskEventTimeline.summary.critical >= 1);
  assert.ok(report.riskEventTimeline.events.some((event) => event.id === 'risk-event-ssh-failures'));
  assert.ok(report.riskEventTimeline.events.some((event) => event.id === 'risk-event-auth-failures'));
  assert.ok(report.riskEventTimeline.events.some((event) => event.id === 'risk-event-connection-spike-203-0-113-77'));
  assert.ok(report.riskEventTimeline.events.some((event) => event.id === 'risk-event-high-risk-public-ports'));
  assert.ok(report.riskEventTimeline.events.some((event) => event.id === 'risk-event-unknown-public-listeners'));
  assert.ok(report.riskEventTimeline.events.every((event) => event.evidence.length > 0));
  assert.ok(report.riskEventTimeline.events.every((event) => event.recommendation.length > 0));
  assert.ok(report.riskEventTimeline.events.every((event) => !/exploit|attack/i.test(event.title)));
});

test('analyzeSnapshot builds a defensive security source review from collected evidence', () => {
  const report = analyzeSnapshot(riskySnapshot, {
    modules: ['security', 'logs', 'network']
  });

  assert.equal(report.securitySourceReview.mode, 'local-security-source-review');
  assert.ok(report.securitySourceReview.summary.totalSources >= 2);
  assert.ok(report.securitySourceReview.summary.highRisk >= 1);
  assert.ok(report.securitySourceReview.sources.some((source) => {
    return source.remoteAddress === '203.0.113.77' &&
      source.ports.includes(22) &&
      source.signals.some((signal) => signal.includes('connections'));
  }));
  assert.ok(report.securitySourceReview.sources.every((source) => source.recommendation.length > 0));
  assert.ok(report.securitySourceReview.sources.every((source) => !/exploit|attack/i.test(source.recommendation)));
});

test('analyzeSnapshot builds a redacted evidence appendix for commercial reports', () => {
  const report = analyzeSnapshot(riskySnapshot, {
    modules: ['health', 'security', 'runtime', 'ecosystem', 'logs', 'network']
  });

  assert.equal(report.evidenceAppendix.mode, 'local-redacted-evidence');
  assert.ok(report.evidenceAppendix.generatedAt);
  assert.equal(report.evidenceAppendix.redaction.policy, 'metadata-and-rule-evidence-only');
  assert.match(report.evidenceAppendix.redaction.note, /passwords/i);
  assert.equal(report.evidenceAppendix.summary.totalItems, report.findings.length);
  assert.ok(report.evidenceAppendix.summary.commandCount >= report.findings.length);
  assert.ok(report.evidenceAppendix.items.some((item) => item.findingId === 'security.ssh-bruteforce'));
  assert.ok(report.evidenceAppendix.items.every((item) => item.evidence.length > 0));
  assert.ok(report.evidenceAppendix.items.every((item) => item.commands.length > 0));
  assert.ok(report.evidenceAppendix.items.every((item) => item.redaction === 'safe-summary'));
  assert.ok(report.evidenceAppendix.items.every((item) => !/private key|password/i.test(item.evidence.join(' '))));
});

test('analyzeSnapshot includes a local executive summary only when enabled', () => {
  const withoutSummary = analyzeSnapshot(riskySnapshot, {
    modules: ['health', 'security', 'runtime', 'ecosystem'],
    settings: { aiSummary: { enabled: false } }
  });
  assert.equal(withoutSummary.executiveSummary, null);

  const report = analyzeSnapshot(riskySnapshot, {
    modules: ['health', 'security', 'runtime', 'ecosystem'],
    settings: { aiSummary: { enabled: true } }
  });

  assert.equal(report.executiveSummary.mode, 'local-rule-summary');
  assert.match(report.executiveSummary.headline, /prod-edge-01/);
  assert.ok(report.executiveSummary.overview.length > 30);
  assert.ok(report.executiveSummary.keyRisks.length >= 3);
  assert.ok(report.executiveSummary.nextActions.length >= 3);
  assert.ok(report.executiveSummary.evidence.some((item) => /critical/i.test(item)));
  assert.ok(report.executiveSummary.generatedAt);
});

test('analyzeSnapshot builds a prioritized remediation checklist for commercial handoff', () => {
  const report = analyzeSnapshot(riskySnapshot, {
    modules: ['health', 'security', 'runtime', 'ecosystem', 'performance']
  });

  assert.ok(report.remediationPlan);
  assert.equal(report.remediationPlan.mode, 'local-rule-checklist');
  assert.ok(report.remediationPlan.totalActions >= 4);
  assert.ok(report.remediationPlan.phases.some((phase) => phase.id === 'contain'));
  assert.ok(report.remediationPlan.phases.some((phase) => phase.id === 'investigate'));
  assert.ok(report.remediationPlan.phases.some((phase) => phase.id === 'stabilize'));

  const contain = report.remediationPlan.phases.find((phase) => phase.id === 'contain');
  assert.ok(contain.items.some((item) => item.findingId === 'security.ssh-bruteforce'));
  assert.ok(contain.items.every((item) => item.commands.length > 0));
  assert.ok(contain.items.every((item) => item.evidence.length > 0));

  const firstItem = contain.items[0];
  assert.match(firstItem.owner, /operations/i);
  assert.match(firstItem.acceptance, /evidence/i);
  assert.ok(['critical', 'high', 'medium', 'low'].includes(firstItem.severity));
});
