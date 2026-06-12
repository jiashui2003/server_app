import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeSnapshot } from '../src/shared/analysis-engine.js';
import { createDemoSnapshot } from '../src/server/collector.js';
import { createApp } from '../src/server/app.js';
import { buildDeliveryPackageChecklist, buildDeliveryValidationLedger, buildPageExperienceReadiness, buildUiExperienceAudit } from '../src/shared/delivery-evidence.js';

test('analysis engine supports commercial delivery modules beyond the MVP set', () => {
  const snapshot = createDemoSnapshot('server-1');
  const report = analyzeSnapshot(snapshot, {
    modules: ['health', 'security', 'runtime', 'ecosystem', 'logs', 'network', 'performance']
  });

  assert.deepEqual(report.modulesRun, ['health', 'security', 'runtime', 'ecosystem', 'logs', 'network', 'performance']);
  assert.ok(report.findings.some((finding) => finding.category === 'logs'));
  assert.ok(report.findings.some((finding) => finding.category === 'network'));
  assert.ok(report.findings.some((finding) => finding.category === 'performance'));
  assert.ok(report.recommendations.length >= 3);
  assert.equal(report.trends.mode, 'local-snapshot-history');
  assert.equal(report.trends.status, 'insufficient-history');
  assert.equal(report.trends.cpu.length, 1);
  assert.equal(report.trends.cpu[0], snapshot.resources.cpuPercent);
  assert.ok(report.topology.nodes.length >= 6);
  assert.ok(report.topology.edges.length >= 5);
  assert.ok(report.topology.risks.some((risk) => risk.severity === 'high' || risk.severity === 'critical'));
  assert.equal(report.topology.map.mode, 'local-service-topology-map');
  assert.ok(report.topology.map.nodes.length >= 6);
  assert.ok(report.topology.map.edges.length >= 5);
  assert.ok(report.topology.map.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));
  assert.ok(report.topology.map.nodes.some((node) => node.kind === 'port' && node.severity === 'high'));
  assert.ok(report.serviceCatalog.some((entry) => entry.role === 'database' && entry.exposure === 'public'));
  assert.ok(report.serviceCatalog.some((entry) => entry.role === 'web-proxy'));
  assert.ok(report.serviceCatalog.every((entry) => entry.recommendation.length > 0));
  assert.equal(report.remediationPlan.mode, 'local-rule-checklist');
  assert.ok(report.remediationPlan.totalActions >= 3);
  assert.ok(report.remediationPlan.phases.some((phase) => phase.items.some((item) => item.commands.length > 0)));
});

test('API records analysis jobs, exposes settings, server detail, and delivery exports', async () => {
  const app = createApp({ memoryOnly: true });
  const server = JSON.parse((await app.inject('POST', '/api/servers', {
    name: 'Commercial Demo',
    host: 'commercial.demo.local',
    mode: 'demo',
    tags: ['production', 'demo']
  })).body);

  const settingsResponse = await app.inject('GET', '/api/settings');
  assert.equal(settingsResponse.statusCode, 200);
  const settings = JSON.parse(settingsResponse.body);
  assert.equal(settings.thresholds.cpuHigh, 90);
  assert.equal(settings.retentionDays, 30);
  assert.equal(settings.notifications.localOnly, true);
  assert.equal(settings.aiSummary.enabled, false);

  const updateSettings = await app.inject('PUT', '/api/settings', {
    thresholds: { cpuHigh: 82, memoryHigh: 80, diskCritical: 88 },
    retentionDays: 45,
    notifications: { localOnly: false },
    aiSummary: { enabled: true }
  });
  assert.equal(updateSettings.statusCode, 200);
  const updatedSettings = JSON.parse(updateSettings.body);
  assert.equal(updatedSettings.thresholds.cpuHigh, 82);
  assert.equal(updatedSettings.retentionDays, 45);
  assert.equal(updatedSettings.notifications.localOnly, false);
  assert.equal(updatedSettings.aiSummary.enabled, true);

  const analysisResponse = await app.inject('POST', `/api/servers/${server.id}/analyze`, {
    modules: ['health', 'security', 'runtime', 'ecosystem', 'logs', 'network', 'performance'],
    depth: 'deep',
    timeRange: 'last-24h'
  });
  assert.equal(analysisResponse.statusCode, 201);
  const report = JSON.parse(analysisResponse.body);
  assert.equal(report.analysisScope.depth, 'deep');
  assert.equal(report.analysisScope.timeRange, 'last-24h');
  assert.equal(report.executiveSummary.mode, 'local-rule-summary');
  assert.match(report.executiveSummary.overview, /generated locally/);
  assert.ok(report.executiveSummary.keyRisks.length >= 1);
  assert.equal(report.riskEventTimeline.mode, 'local-evidence-timeline');
  assert.ok(report.riskEventTimeline.events.length >= 4);
  assert.equal(report.securitySourceReview.mode, 'local-security-source-review');
  assert.ok(report.securitySourceReview.sources.some((source) => source.remoteAddress === '203.0.113.77'));
  assert.equal(report.evidenceAppendix.mode, 'local-redacted-evidence');
  assert.ok(report.evidenceAppendix.summary.totalItems >= report.findings.length);
  assert.equal(report.remediationPlan.mode, 'local-rule-checklist');
  assert.ok(report.remediationPlan.phases.some((phase) => phase.items.length > 0));

  const jobsResponse = await app.inject('GET', '/api/analysis-jobs');
  assert.equal(jobsResponse.statusCode, 200);
  const jobs = JSON.parse(jobsResponse.body);
  assert.ok(jobs.some((job) => job.serverId === server.id && job.status === 'completed'));
  assert.ok(jobs.some((job) => job.serverId === server.id && job.depth === 'deep'));
  assert.ok(jobs.some((job) => job.serverId === server.id && job.timeRange === 'last-24h'));

  const detailResponse = await app.inject('GET', `/api/servers/${server.id}`);
  assert.equal(detailResponse.statusCode, 200);
  const detail = JSON.parse(detailResponse.body);
  assert.equal(detail.server.id, server.id);
  assert.ok(detail.snapshot.processes.length >= 5);
  assert.ok(detail.report.topology.nodes.some((node) => node.kind === 'service'));
  assert.ok(detail.report.serviceCatalog.some((entry) => entry.name === 'mysql' && entry.role === 'database'));

  const exportResponse = await app.inject('GET', `/api/reports/${report.id}/markdown`);
  assert.equal(exportResponse.statusCode, 200);
  const markdown = JSON.parse(exportResponse.body);
  assert.match(markdown.markdown, /# ServerLens Report/);
  assert.match(markdown.markdown, /Commercial Demo|prod-edge-01/);
  assert.match(markdown.markdown, /Recommendations/);
  assert.match(markdown.markdown, /Executive Summary/);
  assert.match(markdown.markdown, /Remediation Checklist/);
  assert.match(markdown.markdown, /Acceptance/);
  assert.match(markdown.markdown, /generated locally/);
  assert.match(markdown.markdown, /Analysis scope/);
  assert.match(markdown.markdown, /last-24h/);
  assert.match(markdown.markdown, /Commands/);
  assert.match(markdown.markdown, /journalctl|ss -tulpen|docker ps|df -h/);
  assert.match(markdown.markdown, /Service Topology/);
  assert.match(markdown.markdown, /Topology Map Summary/);
  assert.match(markdown.markdown, /local-service-topology-map/);
  assert.match(markdown.markdown, /Map nodes: \d+/);
  assert.match(markdown.markdown, /Service Catalog/);
  assert.match(markdown.markdown, /database|web-proxy|cache/);
  assert.match(markdown.markdown, /Risk Event Timeline/);
  assert.match(markdown.markdown, /SSH failure spike|High-risk public listener/);
  assert.match(markdown.markdown, /Security Source Review/);
  assert.match(markdown.markdown, /local-security-source-review/);
  assert.match(markdown.markdown, /203\.0\.113\.77/);
  assert.match(markdown.markdown, /Evidence Appendix/);
  assert.match(markdown.markdown, /metadata-and-rule-evidence-only/);
  assert.match(markdown.markdown, /Redaction/);

  const printResponse = await app.inject('GET', `/api/reports/${report.id}/print`);
  assert.equal(printResponse.statusCode, 200);
  assert.equal(printResponse.contentType, 'text/html; charset=utf-8');
  assert.match(printResponse.body, /<!doctype html>/);
  assert.match(printResponse.body, /window\.print/);
  assert.match(printResponse.body, /Analysis scope/);
  assert.match(printResponse.body, /Executive Summary/);
  assert.match(printResponse.body, /Remediation Checklist/);
  assert.match(printResponse.body, /Acceptance/);
  assert.match(printResponse.body, /generated locally/);
  assert.match(printResponse.body, /last-24h/);
  assert.match(printResponse.body, /Service Topology/);
  assert.match(printResponse.body, /Topology Map Summary/);
  assert.match(printResponse.body, /local-service-topology-map/);
  assert.match(printResponse.body, /Service Catalog/);
  assert.match(printResponse.body, /Commands/);
  assert.match(printResponse.body, /journalctl|ss -tulpen|docker ps|df -h/);
  assert.match(printResponse.body, /Commercial Demo|prod-edge-01/);
  assert.match(printResponse.body, /Risk Event Timeline/);
  assert.match(printResponse.body, /local-evidence-timeline/);
  assert.match(printResponse.body, /Security Source Review/);
  assert.match(printResponse.body, /local-security-source-review/);
  assert.match(printResponse.body, /203\.0\.113\.77/);
  assert.match(printResponse.body, /Evidence Appendix/);
  assert.match(printResponse.body, /local-redacted-evidence/);

  const runbookResponse = await app.inject('GET', `/api/servers/${server.id}/runbook/markdown`);
  assert.equal(runbookResponse.statusCode, 200);
  const runbook = JSON.parse(runbookResponse.body);
  assert.match(runbook.markdown, /# ServerLens Server Runbook/);
  assert.match(runbook.markdown, /Commercial Demo|prod-edge-01/);
  assert.match(runbook.markdown, /## Asset/);
  assert.match(runbook.markdown, /## Latest Snapshot/);
  assert.match(runbook.markdown, /## Service Catalog/);
  assert.match(runbook.markdown, /## Risk Event Timeline/);
  assert.match(runbook.markdown, /## Security Source Review/);
  assert.match(runbook.markdown, /local-security-source-review/);
  assert.match(runbook.markdown, /## Topology Map Summary/);
  assert.match(runbook.markdown, /local-service-topology-map/);
  assert.match(runbook.markdown, /## Evidence Appendix/);
  assert.match(runbook.markdown, /## Remediation Checklist/);
  assert.match(runbook.markdown, /## Diagnostic Commands/);
  assert.match(runbook.markdown, /## Safety Boundary/);
  assert.match(runbook.markdown, /authorized telemetry/i);
});

test('API exposes a local UI experience audit for commercial design review', async () => {
  const audit = buildUiExperienceAudit();
  assert.equal(audit.mode, 'local-ui-experience-audit');
  assert.equal(audit.status, 'ready');
  assert.ok(audit.categories.includes('material'));
  assert.ok(audit.categories.includes('scrolling'));
  assert.ok(audit.categories.includes('controls'));
  assert.ok(audit.categories.includes('responsive'));
  assert.ok(audit.checks.some((check) => check.id === 'material.v9-retroui-clarity-system' && check.status === 'pass'));
  assert.ok(audit.checks.some((check) => check.id === 'controls.command-keyboard-selection' && check.status === 'pass'));
  assert.ok(audit.checks.some((check) => check.id === 'scroll.contained-touch-momentum' && check.evidence.some((item) => item.includes('-webkit-overflow-scrolling'))));
  assert.ok(audit.checks.some((check) => check.id === 'controls.command-center' && check.evidence.some((item) => item.includes('Ctrl/Cmd+K'))));

  const app = createApp({ memoryOnly: true });
  const auditResponse = await app.inject('GET', '/api/delivery/ui-audit');
  assert.equal(auditResponse.statusCode, 200);
  const apiAudit = JSON.parse(auditResponse.body);
  assert.equal(apiAudit.mode, 'local-ui-experience-audit');
  assert.equal(apiAudit.status, 'ready');
  assert.ok(apiAudit.summary.pass >= 6);

  const evidenceResponse = await app.inject('GET', '/api/delivery/evidence');
  const evidence = JSON.parse(evidenceResponse.body);
  assert.equal(evidence.uiExperienceAudit.mode, 'local-ui-experience-audit');
  assert.ok(evidence.capabilities.includes('local UI experience audit for material, scrolling, controls, and responsive review'));
  assert.ok(evidence.capabilities.includes('local UI visual evidence for desktop and mobile screenshot review'));

  const readinessResponse = await app.inject('GET', '/api/delivery/readiness');
  const readiness = JSON.parse(readinessResponse.body);
  assert.ok(readiness.checks.some((check) => check.id === 'ui.experience-audit' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.id === 'ui.visual-evidence-command' && check.status === 'pass'));
});

test('API exposes ServerLens 10 page-by-page experience readiness', async () => {
  const readiness = buildPageExperienceReadiness();
  assert.equal(readiness.mode, 'local-page-experience-readiness');
  assert.equal(readiness.versionTarget, '15.0.0');
  assert.equal(readiness.status, 'ready');
  assert.equal(readiness.pages.length, 11);
  assert.deepEqual(readiness.pages.map((page) => page.id), [
    'overview',
    'servers',
    'server-detail',
    'analysis',
    'inspection',
    'strategy',
    'reports',
    'alerts',
    'release',
    'interaction',
    'settings'
  ]);
  assert.ok(readiness.pages.every((page) => page.primaryAction && page.evidence.length >= 3 && page.nextStep));

  const app = createApp({ memoryOnly: true });
  const response = await app.inject('GET', '/api/delivery/page-readiness');
  assert.equal(response.statusCode, 200);
  const apiReadiness = JSON.parse(response.body);
  assert.equal(apiReadiness.status, 'ready');
  assert.ok(apiReadiness.pages.some((page) => page.id === 'servers' && /connection/i.test(page.primaryAction)));

  const evidenceResponse = await app.inject('GET', '/api/delivery/evidence');
  const evidence = JSON.parse(evidenceResponse.body);
  assert.ok(evidence.capabilities.includes('ServerLens 10.0 page-by-page operation summary with primary action, evidence state, and next step for every view'));
  assert.ok(evidence.githubReferences.includes('uptime-kuma'));
  assert.ok(evidence.githubReferences.includes('glances'));
  assert.ok(evidence.githubReferences.includes('node_exporter'));
  assert.ok(evidence.githubReferences.includes('dashy'));
});

test('API exposes report center summaries with history, trends, and comparison', async () => {
  const app = createApp({ memoryOnly: true });
  const server = JSON.parse((await app.inject('POST', '/api/servers', {
    name: 'Report Center Demo',
    host: 'reports.demo.local',
    mode: 'demo',
    tags: ['reports']
  })).body);

  await app.inject('POST', `/api/servers/${server.id}/collect`, {});
  await app.inject('POST', `/api/servers/${server.id}/analyze`, {
    modules: ['health', 'security', 'runtime']
  });
  await app.inject('POST', `/api/servers/${server.id}/analyze`, {
    modules: ['health', 'security', 'runtime', 'ecosystem', 'logs', 'network', 'performance']
  });

  const response = await app.inject('GET', '/api/reports/summary');
  assert.equal(response.statusCode, 200);
  const summary = JSON.parse(response.body);

  assert.ok(summary.history.length >= 2);
  assert.ok(summary.history.every((item) => item.id && item.serverName && Number.isInteger(item.score)));
  assert.ok(summary.trends.score.length >= 2);
  assert.ok(summary.trends.findings.length >= 2);
  assert.equal(summary.comparison.current.serverId, server.id);
  assert.equal(summary.comparison.previous.serverId, server.id);
  assert.equal(typeof summary.comparison.deltaScore, 'number');
  assert.equal(typeof summary.comparison.deltaFindings, 'number');

  const serverReport = summary.history.find((item) => item.serverId === server.id);
  assert.ok(serverReport);

  const detailResponse = await app.inject('GET', `/api/reports/${serverReport.id}`);
  assert.equal(detailResponse.statusCode, 200);
  const reportDetail = JSON.parse(detailResponse.body);
  assert.equal(reportDetail.id, serverReport.id);
  assert.equal(reportDetail.serverId, server.id);
});

test('API creates a local alert inbox from report findings and supports acknowledgement', async () => {
  const app = createApp({ memoryOnly: true });
  const server = JSON.parse((await app.inject('POST', '/api/servers', {
    name: 'Alert Inbox Demo',
    host: 'alerts.demo.local',
    mode: 'demo',
    tags: ['alerts']
  })).body);

  const analysisResponse = await app.inject('POST', `/api/servers/${server.id}/analyze`, {
    modules: ['health', 'security', 'runtime', 'ecosystem', 'logs', 'network', 'performance'],
    depth: 'deep'
  });
  assert.equal(analysisResponse.statusCode, 201);
  const report = JSON.parse(analysisResponse.body);

  const alertsResponse = await app.inject('GET', '/api/alerts');
  assert.equal(alertsResponse.statusCode, 200);
  const alerts = JSON.parse(alertsResponse.body);
  const reportAlerts = alerts.filter((alert) => alert.reportId === report.id);

  assert.ok(reportAlerts.length >= 1);
  assert.ok(reportAlerts.every((alert) => alert.serverId === server.id));
  assert.ok(reportAlerts.every((alert) => alert.status === 'unread'));
  assert.ok(reportAlerts.every((alert) => ['critical', 'high'].includes(alert.severity)));
  assert.ok(reportAlerts.every((alert) => alert.evidence.length > 0));
  assert.ok(reportAlerts.every((alert) => alert.recommendation.length > 0));
  assert.ok(reportAlerts.every((alert) => alert.commands.length > 0));

  const ackResponse = await app.inject('POST', `/api/alerts/${reportAlerts[0].id}/ack`, {});
  assert.equal(ackResponse.statusCode, 200);
  const acknowledged = JSON.parse(ackResponse.body);
  assert.equal(acknowledged.status, 'acknowledged');
  assert.ok(acknowledged.acknowledgedAt);

  const updatedAlerts = JSON.parse((await app.inject('GET', '/api/alerts')).body);
  assert.equal(updatedAlerts.find((alert) => alert.id === reportAlerts[0].id).status, 'acknowledged');
});

test('API exposes a delivery evidence manifest for commercial handoff', async () => {
  const app = createApp({ memoryOnly: true });

  const response = await app.inject('GET', '/api/delivery/evidence');
  assert.equal(response.statusCode, 200);
  const evidence = JSON.parse(response.body);

  assert.equal(evidence.product, 'ServerLens');
  assert.equal(evidence.deliveryMode, 'local-first desktop');
  assert.match(evidence.generatedAt, /^\d{4}-/);
  assert.ok(evidence.packagePath.endsWith('dist\\win-unpacked\\ServerLens.exe'));
  assert.ok(evidence.capabilities.includes('authorized SSH agent/key telemetry'));
  assert.ok(evidence.capabilities.includes('server archive and restore lifecycle'));
  assert.ok(evidence.capabilities.includes('report remediation checklist with acceptance criteria'));
  assert.ok(evidence.capabilities.includes('server runbook Markdown export for handoff operations'));
  assert.ok(evidence.capabilities.includes('release readiness workspace for client handoff review'));
  assert.ok(evidence.capabilities.includes('iOS-inspired Interaction Studio with tactile cards, swipe rail, Action Dock, and Focus Peek'));
  assert.ok(evidence.capabilities.includes('guided Experience Deck for client walkthrough, presentation mode, motion intensity, and density controls'));
  assert.ok(evidence.capabilities.includes('Scenario Board with selectable cards, pinned scenarios, copyable summaries, and keyboard shortcuts'));
  assert.ok(evidence.capabilities.includes('Authorized Inspection Workspace with guided preflight, collection, analysis, and package evidence'));
  assert.ok(evidence.capabilities.includes('10-cycle Strategy Iteration Workspace with plan, execution, validation, and handoff evidence'));
  assert.ok(evidence.capabilities.includes('ServerLens 10.0 page-by-page operation summary with primary action, evidence state, and next step for every view'));
  assert.ok(evidence.capabilities.includes('risk event timeline for evidence-backed security review'));
  assert.ok(evidence.capabilities.includes('security source review for collected authentication and connection evidence'));
  assert.ok(evidence.capabilities.includes('redacted evidence appendix for commercial report review'));
  assert.ok(evidence.capabilities.includes('commercial interaction polish with card run builder, evidence tracker, and server inspector'));
  assert.ok(evidence.verificationCommands.includes('npm.cmd test'));
  assert.ok(evidence.verificationCommands.includes('npm.cmd run build'));
  assert.ok(evidence.verificationCommands.includes('npm.cmd run runtime:smoke'));
  assert.ok(evidence.verificationCommands.includes('npm.cmd run ui:evidence'));
  assert.ok(evidence.githubReferences.includes('retroui-card'));
  assert.ok(evidence.githubReferences.includes('uptime-kuma'));
  assert.ok(evidence.githubReferences.includes('glances'));
  assert.ok(evidence.githubReferences.includes('node_exporter'));
  assert.ok(evidence.githubReferences.includes('dashy'));
  assert.ok(evidence.safetyBoundary.every((item) => !/brute force|exploit|attack/i.test(item)));
});

test('API exposes a delivery readiness gate with categorized commercial checks', async () => {
  const app = createApp({ memoryOnly: true });

  const response = await app.inject('GET', '/api/delivery/readiness');
  assert.equal(response.statusCode, 200);
  const readiness = JSON.parse(response.body);

  assert.equal(readiness.product, 'ServerLens');
  assert.equal(readiness.status, 'ready');
  assert.match(readiness.generatedAt, /^\d{4}-/);
  assert.equal(readiness.summary.fail, 0);
  assert.ok(readiness.summary.pass >= 10);
  assert.ok(readiness.categories.includes('verification'));
  assert.ok(readiness.categories.includes('packaging'));
  assert.ok(readiness.categories.includes('github-references'));
  assert.ok(readiness.categories.includes('safety-boundary'));
  assert.ok(readiness.categories.includes('commercial-capabilities'));
  assert.ok(readiness.categories.includes('product-ui'));
  assert.ok(readiness.checks.every((check) => check.id && check.label && check.category && check.status));
  assert.ok(readiness.checks.some((check) => check.id === 'verification.commands' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.evidence.some((item) => item.includes('npm.cmd run runtime:smoke'))));
  assert.ok(readiness.checks.some((check) => check.id === 'packaging.handoff-dir' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.id === 'references.current-v100-monitoring' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.id === 'ui.page-experience-readiness' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.id === 'safety.demo-no-external-network' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.id === 'capabilities.security-source-review' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.id === 'capabilities.commercial-interaction-polish' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.id === 'capabilities.release-readiness-workspace' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.id === 'capabilities.interaction-studio' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.id === 'capabilities.experience-deck' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.id === 'capabilities.scenario-board' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.id === 'capabilities.authorized-inspection-workspace' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.id === 'capabilities.10-cycle-strategy-workspace' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.id === 'capabilities.v9-retroui-clarity-system' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.id === 'ui.v9-retroui-clarity-contract' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.id === 'ui.visual-evidence-command' && check.status === 'pass'));
  assert.ok(readiness.checks.some((check) => check.evidence.some((item) => item.includes('retroui-card'))));
  assert.ok(readiness.checks.some((check) => check.evidence.some((item) => item.includes('npm.cmd run handoff:dir'))));
  assert.ok(readiness.nextActions.every((item) => !/brute force|exploit|attack/i.test(item)));
});

test('API exposes a local authorized inspection workspace for commercial onboarding', async () => {
  const app = createApp({ memoryOnly: true });

  const response = await app.inject('GET', '/api/delivery/inspection');
  assert.equal(response.statusCode, 200);
  const inspection = JSON.parse(response.body);

  assert.equal(inspection.product, 'ServerLens');
  assert.equal(inspection.mode, 'local-authorized-inspection-workspace');
  assert.match(inspection.generatedAt, /^\d{4}-/);
  assert.ok(['ready', 'review', 'blocked'].includes(inspection.status));
  assert.ok(inspection.server.id);
  assert.ok(inspection.server.name);
  assert.ok(inspection.steps.length >= 5);
  assert.deepEqual(inspection.steps.map((step) => step.id), ['authorize', 'preflight', 'collect', 'analyze', 'package']);
  assert.ok(inspection.steps.every((step) => step.label && step.status && step.action));
  assert.ok(inspection.steps.every((step) => Array.isArray(step.evidence) && step.evidence.length > 0));
  assert.ok(inspection.packageArtifacts.includes('Markdown report'));
  assert.ok(inspection.packageArtifacts.includes('PDF handoff'));
  assert.ok(inspection.packageArtifacts.includes('Server runbook'));
  assert.ok(inspection.safetyBoundary.every((item) => !/brute force|exploit|attack/i.test(item)));
});

test('API exposes a 10-cycle strategy iteration workspace for major-version delivery', async () => {
  const app = createApp({ memoryOnly: true });

  const response = await app.inject('GET', '/api/delivery/strategy');
  assert.equal(response.statusCode, 200);
  const strategy = JSON.parse(response.body);

  assert.equal(strategy.product, 'ServerLens');
  assert.equal(strategy.mode, 'local-10-cycle-strategy-workspace');
  assert.match(strategy.generatedAt, /^\d{4}-/);
  assert.equal(strategy.versionTarget, '10.0.0');
  assert.equal(strategy.iterations.length, 10);
  assert.deepEqual(strategy.iterations.map((item) => item.id), [
    'strategy-01-baseline',
    'strategy-02-reference-synthesis',
    'strategy-03-commercial-scope',
    'strategy-04-safe-data-boundary',
    'strategy-05-operator-flow',
    'strategy-06-ui-material',
    'strategy-07-evidence-ledger',
    'strategy-08-package-handoff',
    'strategy-09-validation-gates',
    'strategy-10-release-ios'
  ]);
  assert.ok(strategy.iterations.every((item) => item.status === 'done'));
  assert.ok(strategy.iterations.every((item) => item.plan && item.execution && item.validation));
  assert.ok(strategy.iterations.every((item) => Array.isArray(item.evidence) && item.evidence.length > 0));
  assert.ok(strategy.summary.done === 10);
  assert.ok(strategy.githubReferences.includes('uptime-kuma'));
  assert.ok(strategy.githubReferences.includes('glances'));
  assert.ok(strategy.githubReferences.includes('node_exporter'));
  assert.ok(strategy.githubReferences.includes('dashy'));
  assert.ok(strategy.safetyBoundary.every((item) => !/brute force|exploit|attack/i.test(item)));
});

test('API exposes a first-run handoff checklist with actionable evidence', async () => {
  const app = createApp({ memoryOnly: true });

  const response = await app.inject('GET', '/api/delivery/checklist');
  assert.equal(response.statusCode, 200);
  const checklist = JSON.parse(response.body);

  assert.equal(checklist.product, 'ServerLens');
  assert.match(checklist.generatedAt, /^\d{4}-/);
  assert.equal(checklist.status, 'ready');
  assert.equal(checklist.summary.blocked, 0);
  assert.ok(checklist.summary.ready >= 6);
  assert.ok(checklist.steps.every((step) => step.id && step.label && step.status && step.action));
  assert.ok(checklist.steps.every((step) => Array.isArray(step.evidence) && step.evidence.length > 0));
  assert.ok(checklist.steps.some((step) => step.id === 'demo-fleet' && step.status === 'ready'));
  assert.ok(checklist.steps.some((step) => step.id === 'latest-report' && step.action.includes('Analyze')));
  assert.ok(checklist.steps.some((step) => step.id === 'export-markdown' && step.evidence.some((item) => item.includes('/api/reports/'))));
  assert.ok(checklist.steps.some((step) => step.id === 'export-runbook' && step.evidence.some((item) => item.includes('/runbook/markdown'))));
  assert.ok(checklist.steps.some((step) => step.id === 'readiness-gate' && step.evidence.some((item) => item.includes('ready'))));
  assert.ok(checklist.steps.some((step) => step.id === 'handoff-package' && step.action.includes('handoff:dir')));
  assert.ok(checklist.steps.some((step) => step.id === 'local-safety' && step.evidence.some((item) => item.includes('no external'))));
  assert.ok(checklist.nextActions.every((item) => !/brute force|exploit|attack/i.test(item)));
});

test('shared delivery evidence builds an offline package checklist for handoff artifacts', () => {
  const validationLedger = buildDeliveryValidationLedger({
    packagePath: 'D:\\vibe-server-status-app\\dist\\win-unpacked-ready\\ServerLens.exe',
    handoffRoot: 'D:\\vibe-server-status-app\\dist\\handoff\\ServerLens-10.0.0',
    commandResults: [
      { command: 'npm.cmd test', status: 'pass', exitCode: 0, durationMs: 531, summary: '51/51 tests passed' },
      { command: 'npm.cmd run build', status: 'pass', exitCode: 0, durationMs: 420, summary: 'Build check passed' },
      { command: 'npm.cmd run runtime:smoke', status: 'pass', exitCode: 0, durationMs: 900, summary: 'readiness ready' },
      { command: 'npm.cmd run ui:evidence', status: 'pass', exitCode: 0, durationMs: 900, summary: 'UI visual evidence ready' },
      { command: 'npm.cmd run package:app', status: 'pass', exitCode: 0, durationMs: 1400, summary: 'ServerLens.exe generated' },
      { command: 'npm.cmd run handoff:dir', status: 'pass', exitCode: 0, durationMs: 730, summary: 'handoff directory generated' }
    ]
  });
  const checklist = buildDeliveryPackageChecklist({
    packagePath: 'D:\\vibe-server-status-app\\dist\\win-unpacked-ready\\ServerLens.exe',
    handoffRoot: 'D:\\vibe-server-status-app\\dist\\handoff\\ServerLens-10.0.0',
    validationLedger
  });

  assert.equal(checklist.product, 'ServerLens');
  assert.equal(checklist.status, 'ready');
  assert.equal(checklist.summary.blocked, 0);
  assert.ok(checklist.steps.length >= 6);
  assert.ok(checklist.steps.some((step) => step.id === 'open-desktop-app' && step.evidence.some((item) => item.includes('ServerLens.exe'))));
  assert.ok(checklist.steps.some((step) => step.id === 'review-delivery-evidence' && step.evidence.some((item) => item.includes('delivery-evidence.json'))));
  assert.ok(checklist.steps.some((step) => step.id === 'review-readiness-gate' && step.evidence.some((item) => item.includes('ready'))));
  assert.ok(checklist.steps.some((step) => step.id === 'review-delivery-validation' && step.status === 'ready'));
  assert.ok(checklist.steps.some((step) => step.id === 'review-ui-experience-audit' && step.status === 'ready'));
  assert.ok(checklist.steps.some((step) => step.id === 'review-github-references' && step.evidence.some((item) => item.includes('retroui-card'))));
  assert.ok(checklist.steps.some((step) => step.id === 'confirm-safety-boundary' && step.evidence.some((item) => item.includes('Demo mode'))));
  assert.ok(checklist.nextActions.every((item) => !/brute force|exploit|attack/i.test(item)));
});

test('shared delivery package checklist surfaces validation ledger review status', () => {
  const validationLedger = buildDeliveryValidationLedger({
    packagePath: 'D:\\vibe-server-status-app\\dist\\win-unpacked-ready\\ServerLens.exe',
    handoffRoot: 'D:\\vibe-server-status-app\\dist\\handoff\\ServerLens-10.0.0',
    commandResults: [
      { command: 'npm.cmd test', status: 'pass', exitCode: 0, durationMs: 531, summary: '51/51 tests passed' },
      { command: 'npm.cmd run ui:evidence', status: 'warn', exitCode: 0, durationMs: 900, summary: 'UI visual evidence blocked: desktop rerun required' }
    ]
  });
  const checklist = buildDeliveryPackageChecklist({
    packagePath: 'D:\\vibe-server-status-app\\dist\\win-unpacked-ready\\ServerLens.exe',
    handoffRoot: 'D:\\vibe-server-status-app\\dist\\handoff\\ServerLens-10.0.0',
    validationLedger
  });

  assert.equal(validationLedger.status, 'review');
  assert.equal(checklist.status, 'review');
  assert.equal(checklist.summary.review, 1);
  assert.ok(checklist.steps.some((step) => (
    step.id === 'review-delivery-validation' &&
    step.status === 'review' &&
    step.evidence.some((item) => item.includes('1 warned'))
  )));
});

test('shared delivery evidence builds a command-level validation ledger', () => {
  const ledger = buildDeliveryValidationLedger({
    packagePath: 'D:\\vibe-server-status-app\\dist\\win-unpacked-ready\\ServerLens.exe',
    handoffRoot: 'D:\\vibe-server-status-app\\dist\\handoff\\ServerLens-10.0.0',
    commandResults: [
      { command: 'npm.cmd test', status: 'pass', exitCode: 0, durationMs: 531, summary: '48/48 tests passed' },
      { command: 'npm.cmd run build', status: 'pass', exitCode: 0, durationMs: 420, summary: 'Build check passed' },
      { command: 'npm.cmd run runtime:smoke', status: 'pass', exitCode: 0, durationMs: 900, summary: 'readiness ready, static-fallback' },
      { command: 'npm.cmd run package:app', status: 'pass', exitCode: 0, durationMs: 1400, summary: 'ServerLens.exe generated' },
      { command: 'npm.cmd run handoff:dir', status: 'pass', exitCode: 0, durationMs: 730, summary: 'handoff directory generated' }
    ]
  });

  assert.equal(ledger.product, 'ServerLens');
  assert.equal(ledger.mode, 'local-delivery-validation-ledger');
  assert.equal(ledger.status, 'ready');
  assert.equal(ledger.summary.fail, 0);
  assert.equal(ledger.summary.pass, 5);
  assert.ok(ledger.commands.every((item) => item.status === 'pass' && item.exitCode === 0));
  assert.ok(ledger.commands.some((item) => item.command === 'npm.cmd run runtime:smoke' && item.summary.includes('static-fallback')));
  assert.ok(ledger.artifacts.some((item) => item.id === 'desktop-executable' && item.path.includes('ServerLens.exe')));
  assert.ok(ledger.artifacts.some((item) => item.id === 'handoff-directory' && item.path.includes('ServerLens-10.0.0')));
  assert.ok(ledger.safetyBoundary.every((item) => !/brute force|exploit|attack/i.test(item)));
});
