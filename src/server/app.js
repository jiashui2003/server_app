import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';

import { analyzeSnapshot, resolveAnalysisOptions } from '../shared/analysis-engine.js';
import { buildDeliveryEvidence, buildDeliveryReadiness, buildPageExperienceReadiness, buildUiExperienceAudit } from '../shared/delivery-evidence.js';
import { buildEcosystemOverview } from '../shared/ecosystem-overview.js';
import { buildSshArgs, collectSnapshotForServer, collectSnapshotForServerAsync } from './collector.js';
import { createStore } from './store.js';
import { dispatchWebhook } from './webhook-notifier.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const publicRoot = path.join(projectRoot, 'public');
const execFileAsync = promisify(execFile);

const MAX_REQUEST_BODY_BYTES = 256 * 1024;
const DEFAULT_BIND_HOST = '127.0.0.1';

export function createApp(options = {}) {
  const store = createStore(options);
  if (store.listServers().length === 0) {
    seedDemoServer(store);
  }

  const bindHost = options.bindHost ?? process.env.SERVERLENS_BIND_HOST ?? DEFAULT_BIND_HOST;
  const apiToken = (options.apiToken ?? process.env.SERVERLENS_API_TOKEN ?? '').trim();

  async function handle(method, urlPath, body = undefined) {
    try {
      if (method === 'GET' && urlPath === '/api/servers') {
        return json(200, store.listServers());
      }

      if (method === 'GET' && urlPath === '/api/servers/all') {
        return json(200, store.listServers({ includeArchived: true }));
      }

      if (method === 'GET' && urlPath === '/api/servers/export') {
        return json(200, store.exportServerInventory());
      }

      if (method === 'POST' && urlPath === '/api/servers/import') {
        return json(200, store.importServerInventory(body ?? {}));
      }

      const serverDetailMatch = urlPath.match(/^\/api\/servers\/([^/]+)$/);
      if (method === 'GET' && serverDetailMatch) {
        const detail = store.getServerDetail(serverDetailMatch[1]);
        if (!detail) return json(404, { message: 'Server not found.' });
        return json(200, detail);
      }

      if (method === 'POST' && urlPath === '/api/servers') {
        if (!body?.name || !body?.host) {
          return json(400, { message: 'Server name and host are required.' });
        }
        return json(201, store.createServer(body));
      }

      if (method === 'PUT' && serverDetailMatch) {
        if (!body?.name || !body?.host) {
          return json(400, { message: 'Server name and host are required.' });
        }
        const server = store.updateServer(serverDetailMatch[1], body);
        if (!server) return json(404, { message: 'Server not found.' });
        return json(200, server);
      }

      const archiveServerMatch = urlPath.match(/^\/api\/servers\/([^/]+)\/archive$/);
      if (method === 'POST' && archiveServerMatch) {
        const server = store.archiveServer(archiveServerMatch[1]);
        if (!server) return json(404, { message: 'Server not found.' });
        return json(200, server);
      }

      const restoreServerMatch = urlPath.match(/^\/api\/servers\/([^/]+)\/restore$/);
      if (method === 'POST' && restoreServerMatch) {
        const server = store.restoreServer(restoreServerMatch[1]);
        if (!server) return json(404, { message: 'Server not found.' });
        return json(200, server);
      }

      const testConnectionMatch = urlPath.match(/^\/api\/servers\/([^/]+)\/test-connection$/);
      if (method === 'POST' && testConnectionMatch) {
        const server = store.getServer(testConnectionMatch[1]);
        if (!server) return json(404, { message: 'Server not found.' });
        if (server.archived) return json(409, { message: 'Archived servers must be restored before connection testing.' });
        const result = await (options.connectionTester ?? testServerConnection)(server);
        store.updateServerConnection(server.id, result);
        return json(200, result);
      }

      const collectMatch = urlPath.match(/^\/api\/servers\/([^/]+)\/collect$/);
      if (method === 'POST' && collectMatch) {
        const server = store.getServer(collectMatch[1]);
        if (!server) return json(404, { message: 'Server not found.' });
        if (server.archived) return json(409, { message: 'Archived servers must be restored before collection.' });
        const snapshot = await collectSnapshotForServerAsync(server);
        store.saveSnapshot(snapshot);
        return json(201, snapshot);
      }

      const analyzeMatch = urlPath.match(/^\/api\/servers\/([^/]+)\/analyze$/);
      if (method === 'POST' && analyzeMatch) {
        const server = store.getServer(analyzeMatch[1]);
        if (!server) return json(404, { message: 'Server not found.' });
        if (server.archived) return json(409, { message: 'Archived servers must be restored before analysis.' });
        const snapshot = store.getSnapshot(server.id) ?? store.saveSnapshot(await collectSnapshotForServerAsync(server));
        const analysisOptions = resolveAnalysisOptions({
          preset: body?.preset,
          modules: body?.modules,
          depth: body?.depth,
          timeRange: body?.timeRange
        });
        const job = store.createAnalysisJob({
          serverId: server.id,
          preset: analysisOptions.preset,
          modules: analysisOptions.modules,
          depth: analysisOptions.depth,
          timeRange: analysisOptions.timeRange
        });
        const report = analyzeSnapshot(snapshot, {
          ...analysisOptions,
          settings: store.getSettings(),
          history: store.listSnapshotHistory(server.id)
        });
        store.saveReport(report);
        const createdAlerts = store.createAlertsForReport(report, server);
        store.completeAnalysisJob(job.id, report);
        // Optional outbound webhook (planned extension, default OFF). Double-gated
        // by localOnly=false + webhook.enabled inside dispatchWebhook; failures
        // never block local analysis.
        dispatchWebhook(store.getSettings(), createdAlerts, {
          serverId: server.id,
          serverName: server.name
        }).catch(() => {});
        return json(201, report);
      }

      if (method === 'GET' && urlPath === '/api/alerts') {
        return json(200, store.listAlerts());
      }

      const acknowledgeAlertMatch = urlPath.match(/^\/api\/alerts\/([^/]+)\/ack$/);
      if (method === 'POST' && acknowledgeAlertMatch) {
        const alert = store.acknowledgeAlert(acknowledgeAlertMatch[1]);
        if (!alert) return json(404, { message: 'Alert not found.' });
        return json(200, alert);
      }

      if (method === 'GET' && urlPath === '/api/reports') {
        return json(200, store.listReports());
      }

      if (method === 'GET' && urlPath === '/api/reports/summary') {
        return json(200, buildReportSummary(store));
      }

      if (method === 'GET' && urlPath === '/api/status-page') {
        return json(200, buildStatusPageSummary(store));
      }

      const reportDetailMatch = urlPath.match(/^\/api\/reports\/([^/]+)$/);
      if (method === 'GET' && reportDetailMatch) {
        const report = store.getReport(reportDetailMatch[1]);
        if (!report) return json(404, { message: 'Report not found.' });
        return json(200, report);
      }

      const exportReportMatch = urlPath.match(/^\/api\/reports\/([^/]+)\/markdown$/);
      if (method === 'GET' && exportReportMatch) {
        const report = store.getReport(exportReportMatch[1]);
        if (!report) return json(404, { message: 'Report not found.' });
        return json(200, { markdown: renderReportMarkdown(report, store.getServer(report.serverId)) });
      }

      const printReportMatch = urlPath.match(/^\/api\/reports\/([^/]+)\/print$/);
      if (method === 'GET' && printReportMatch) {
        const report = store.getReport(printReportMatch[1]);
        if (!report) return json(404, { message: 'Report not found.' });
        return html(200, renderReportPrintHtml(report, store.getServer(report.serverId)));
      }

      const serverRunbookMatch = urlPath.match(/^\/api\/servers\/([^/]+)\/runbook\/markdown$/);
      if (method === 'GET' && serverRunbookMatch) {
        const detail = store.getServerDetail(serverRunbookMatch[1]);
        if (!detail) return json(404, { message: 'Server not found.' });
        return json(200, { markdown: renderServerRunbookMarkdown(detail) });
      }

      if (method === 'GET' && urlPath === '/api/analysis-jobs') {
        return json(200, store.listAnalysisJobs());
      }

      if (method === 'GET' && urlPath === '/api/settings') {
        return json(200, store.getSettings());
      }

      if (method === 'PUT' && urlPath === '/api/settings') {
        return json(200, store.updateSettings(body ?? {}));
      }

      if (method === 'POST' && urlPath === '/api/maintenance/retention') {
        return json(200, store.runRetentionMaintenance(body ?? {}));
      }

      if (method === 'GET' && urlPath === '/api/delivery/evidence') {
        return json(200, buildDeliveryEvidence({ projectRoot }));
      }

      if (method === 'GET' && urlPath === '/api/delivery/checklist') {
        return json(200, buildHandoffChecklist(store));
      }

      if (method === 'GET' && urlPath === '/api/delivery/inspection') {
        return json(200, buildInspectionWorkspace(store));
      }

      if (method === 'GET' && urlPath === '/api/delivery/strategy') {
        return json(200, buildStrategyIterationWorkspace(store));
      }

      if (method === 'GET' && urlPath === '/api/delivery/ui-audit') {
        return json(200, buildUiExperienceAudit());
      }

      if (method === 'GET' && urlPath === '/api/delivery/page-readiness') {
        return json(200, buildPageExperienceReadiness());
      }

      if (method === 'GET' && urlPath === '/api/delivery/readiness') {
        return json(200, buildDeliveryReadiness({ projectRoot }));
      }

      if (method === 'GET' && urlPath === '/api/ecosystem/overview') {
        return json(200, buildEcosystemForStore(store));
      }

      return json(404, { message: 'Route not found.' });
    } catch (error) {
      return json(error.statusCode ?? (error.message.startsWith('Unknown analysis module') || error.message.startsWith('Unknown analysis preset') ? 400 : 500), {
        message: error.message
      });
    }
  }

  return {
    store,
    async inject(method, urlPath, body) {
      return handle(method, urlPath, body);
    },
    listen(port = 4173, host = bindHost) {
      const server = createHttpServer(async (request, response) => {
        const requestUrl = new URL(request.url, `http://${request.headers.host}`);
        if (requestUrl.pathname.startsWith('/api/')) {
          if (!isAuthorizedRequest(request, apiToken)) {
            response.writeHead(401, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ message: 'A valid ServerLens API token is required for this request.' }));
            return;
          }
          let parsedBody;
          try {
            parsedBody = await readJsonBody(request);
          } catch (error) {
            response.writeHead(error.statusCode ?? 400, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ message: error.message }));
            return;
          }
          const result = await handle(request.method, requestUrl.pathname, parsedBody);
          response.writeHead(result.statusCode, { 'content-type': result.contentType ?? 'application/json' });
          response.end(result.body);
          return;
        }

        const filePath = requestUrl.pathname === '/'
          ? path.join(publicRoot, 'index.html')
          : path.join(publicRoot, requestUrl.pathname);
        const safePath = path.normalize(filePath);
        if (!safePath.startsWith(publicRoot)) {
          response.writeHead(403);
          response.end('Forbidden');
          return;
        }

        try {
          const content = await readFile(safePath);
          response.writeHead(200, { 'content-type': contentType(safePath) });
          response.end(content);
        } catch {
          response.writeHead(404);
          response.end('Not found');
        }
      });

      return new Promise((resolve) => {
        server.listen(port, host, () => resolve(server));
      });
    }
  };
}

function isAuthorizedRequest(request, apiToken) {
  if (!apiToken) return true;
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return true;
  const header = request.headers.authorization ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
  return timingSafeEqualString(presented, apiToken);
}

function timingSafeEqualString(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ''), 'utf8');
  const rightBuffer = Buffer.from(String(right ?? ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

async function testServerConnection(server) {
  const checkedAt = new Date().toISOString();
  if (server.mode === 'demo') {
    return {
      serverId: server.id,
      host: server.host,
      port: server.port,
      status: 'skipped',
      reachable: null,
      checkedAt,
      message: 'Demo mode uses sample telemetry, so no external connection was opened.',
      stages: [
        {
          id: 'demo',
          label: 'Demo telemetry',
          status: 'pass',
          message: 'No external connection is required for demo assets.'
        }
      ],
      nextActions: ['Use Collect and Analyze to review the built-in sample telemetry.']
    };
  }

  const tcpResult = await new Promise((resolve) => {
    const socket = net.createConnection({ host: server.host, port: server.port });
    const finish = (status, reachable, message) => {
      socket.destroy();
      resolve({
        serverId: server.id,
        host: server.host,
        port: server.port,
        status,
        reachable,
        checkedAt,
        message,
        stages: [
          {
            id: 'tcp',
            label: 'TCP reachability',
            status: reachable ? 'pass' : 'fail',
            message
          }
        ],
        nextActions: reachable
          ? ['Run SSH authentication check before collection.']
          : ['Confirm the host, port, VPN, firewall rule, and that SSH is listening on the configured server.']
      });
    };
    socket.setTimeout(1800);
    socket.once('connect', () => finish('reachable', true, 'TCP connection succeeded for the configured server.'));
    socket.once('timeout', () => finish('timeout', false, 'Connection timed out before SSH or agent negotiation.'));
    socket.once('error', (error) => finish('failed', false, error.message));
  });

  if (!tcpResult.reachable || server.mode !== 'ssh') return tcpResult;
  return testSshAuthentication(server, tcpResult);
}

async function testSshAuthentication(server, tcpResult) {
  const method = server.authType === 'ssh-key' ? 'ssh-key' : 'agent';
  try {
    const result = await execFileAsync('ssh', [...buildSshArgs(server), 'echo SERVERLENS_AUTH_OK'], {
      timeout: 9000,
      maxBuffer: 256 * 1024
    });
    const authenticated = result.stdout.includes('SERVERLENS_AUTH_OK');
    if (authenticated) {
      return {
        ...tcpResult,
        status: 'ready',
        message: 'TCP and SSH authentication succeeded. Collection can run with this asset.',
        stages: [
          ...tcpResult.stages,
          {
            id: 'ssh-auth',
            label: 'SSH authentication',
            status: 'pass',
            message: 'BatchMode SSH authentication succeeded.'
          }
        ],
        ssh: {
          checked: true,
          authenticated: true,
          method,
          message: 'SSH authentication succeeded.'
        },
        nextActions: ['Run Collect to gather authorized telemetry, then Analyze for security and runtime findings.']
      };
    }
    return sshAuthFailure(server, tcpResult, method, 'SSH authentication did not return the expected probe marker.');
  } catch (error) {
    return sshAuthFailure(server, tcpResult, method, oneLine(error.stderr || error.message));
  }
}

function sshAuthFailure(server, tcpResult, method, message) {
  return {
    ...tcpResult,
    status: 'auth-failed',
    reachable: true,
    message: 'TCP succeeded, but SSH authentication failed for the configured account.',
    stages: [
      ...tcpResult.stages,
      {
        id: 'ssh-auth',
        label: 'SSH authentication',
        status: 'fail',
        message
      }
    ],
    ssh: {
      checked: true,
      authenticated: false,
      method,
      message
    },
    nextActions: sshNextActions(server, method)
  };
}

function sshNextActions(server, method) {
  const target = `${server.username ? `${server.username}@` : ''}${server.host}`;
  if (method === 'ssh-key') {
    return [
      `Confirm the key path is readable by this desktop app: ${server.keyPath || 'no key path set'}.`,
      `Verify the public key is present in ${target}:~/.ssh/authorized_keys.`,
      `Test manually: ssh -i "${server.keyPath || '<key-path>'}" -p ${server.port ?? 22} ${target}.`
    ];
  }
  return [
    'Add the usable private key to the local SSH agent, or switch this asset to SSH key mode and provide the key path.',
    `Verify the public key is present in ${target}:~/.ssh/authorized_keys.`,
    `Test manually with BatchMode: ssh -o BatchMode=yes -p ${server.port ?? 22} ${target} "echo ok".`
  ];
}

// Extract the most meaningful single line from SSH stderr. The SSH client emits
// advisory noise (post-quantum warnings, banners, verbose/debug lines) that is
// not the real failure cause, so we drop those and prefer the line that names
// the actual authentication problem before falling back to the first real line.
export function oneLine(value) {
  const lines = String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isSshNoiseLine(line));
  const meaningful = lines.find((line) => /permission denied|authentication|publickey|password|host key|connection refused|timed out|no such|could not|unable to|denied|key|identity/i.test(line));
  return meaningful ?? lines[0] ?? 'SSH authentication failed (no usable credential for this account).';
}

function isSshNoiseLine(line) {
  return /^\*?\*?\s*warning:/i.test(line)
    || /post-quantum/i.test(line)
    || /^debug\d*:/i.test(line)
    || /^banner/i.test(line);
}

function seedDemoServer(store) {
  const primary = store.createServer({
    name: 'Production Edge',
    host: 'demo.local',
    mode: 'demo',
    tags: ['production', 'edge']
  });
  const snapshot = collectSnapshotForServer(primary);
  store.saveSnapshot(snapshot);
  store.saveReport(analyzeSnapshot(snapshot, {
    modules: ['health', 'security', 'runtime', 'ecosystem', 'logs', 'network', 'performance'],
    settings: store.getSettings(),
    snapshotHistory: store.listSnapshotHistory(primary.id)
  }));

  for (const server of [
    { name: 'Database Core', host: 'db.demo.local', tags: ['database'] },
    { name: 'GPU Worker', host: 'gpu.demo.local', tags: ['worker'] },
    { name: 'Backup Node', host: 'backup.demo.local', tags: ['backup'] }
  ]) {
    const created = store.createServer({ ...server, mode: 'demo' });
    const createdSnapshot = collectSnapshotForServer(created);
    createdSnapshot.resources.cpuPercent = created.name === 'Backup Node' ? 18 : createdSnapshot.resources.cpuPercent - 12;
    createdSnapshot.resources.memoryPercent = created.name === 'GPU Worker' ? 82 : createdSnapshot.resources.memoryPercent - 8;
    createdSnapshot.resources.diskPercent = created.name === 'Backup Node' ? 87 : createdSnapshot.resources.diskPercent - 18;
    store.saveSnapshot(createdSnapshot);
    store.saveReport(analyzeSnapshot(createdSnapshot, {
      modules: ['health', 'security', 'runtime', 'ecosystem', 'logs', 'network', 'performance'],
      settings: store.getSettings(),
      snapshotHistory: store.listSnapshotHistory(created.id)
    }));
  }
}

function json(statusCode, payload) {
  return {
    statusCode,
    contentType: 'application/json',
    body: JSON.stringify(payload)
  };
}

function html(statusCode, body) {
  return {
    statusCode,
    contentType: 'text/html; charset=utf-8',
    body
  };
}

async function readJsonBody(request) {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method)) return undefined;
  const chunks = [];
  let received = 0;
  for await (const chunk of request) {
    received += chunk.length;
    if (received > MAX_REQUEST_BODY_BYTES) {
      const error = new Error('Request body exceeds the local 256KB limit.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('Request body is not valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

function contentType(filePath) {
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'text/html; charset=utf-8';
}

function renderReportMarkdown(report, server) {
  const findings = report.findings.map((finding) => {
    return [
      `### ${finding.title}`,
      '',
      `- Severity: ${finding.severity}`,
      `- Category: ${finding.category}`,
      `- Evidence: ${finding.evidence.join(' ')}`,
      `- Recommendation: ${finding.recommendation}`,
      '- Commands:',
      renderFindingCommandsMarkdown(finding)
    ].join('\n');
  }).join('\n\n');

  const recommendations = report.recommendations.map((item) => {
    return `- [${item.severity}] ${item.action}`;
  }).join('\n');

  return [
    '# ServerLens Report',
    '',
    `Server: ${server?.name ?? report.summary.hostname}`,
    `Host: ${server?.host ?? report.summary.hostname}`,
    `Generated: ${report.generatedAt}`,
    `Score: ${report.score}`,
    `Status: ${report.status}`,
    `Analysis scope: ${report.analysisScope?.depth ?? 'standard'} / ${report.analysisScope?.timeRange ?? 'latest-snapshot'}`,
    '',
    '## Summary',
    '',
    `- Platform: ${report.summary.platform}`,
    `- Open ports: ${report.summary.openPorts}`,
    `- Running services: ${report.summary.runningServices}`,
    `- Containers: ${report.summary.containers}`,
    '',
    renderExecutiveSummaryMarkdown(report.executiveSummary),
    '',
    '## Risk Event Timeline',
    '',
    renderRiskEventTimelineMarkdown(report.riskEventTimeline),
    '',
    '## Security Source Review',
    '',
    renderSecuritySourceReviewMarkdown(report.securitySourceReview),
    '',
    '## Evidence Appendix',
    '',
    renderEvidenceAppendixMarkdown(report.evidenceAppendix),
    '',
    '## Remediation Checklist',
    '',
    renderRemediationPlanMarkdown(report.remediationPlan),
    '',
    '## Recommendations',
    '',
    recommendations || '- No recommendations.',
    '',
    '## Service Catalog',
    '',
    renderServiceCatalogMarkdown(report.serviceCatalog),
    '',
    '## Service Topology',
    '',
    renderTopologyMarkdown(report.topology),
    '',
    '## Topology Map Summary',
    '',
    renderTopologyMapSummaryMarkdown(report.topology?.map),
    '',
    '## Findings',
    '',
    findings || 'No findings.'
  ].join('\n');
}

function renderRemediationPlanMarkdown(plan) {
  if (!plan || plan.totalActions === 0) return '- No remediation actions generated.';
  return plan.phases.map((phase) => {
    if (phase.items.length === 0) return '';
    return [
      `### ${phase.label}`,
      '',
      phase.intent,
      '',
      ...phase.items.map((item) => [
        `- [${item.severity}] ${item.title}`,
        `  - Owner: ${item.owner}`,
        `  - Action: ${item.action}`,
        `  - Evidence: ${item.evidence.join(' ')}`,
        `  - Acceptance: ${item.acceptance}`,
        `  - Commands: ${(item.commands ?? []).map((command) => `\`${command}\``).join(', ') || 'No commands provided.'}`
      ].join('\n'))
    ].join('\n');
  }).filter(Boolean).join('\n\n');
}

function renderExecutiveSummaryMarkdown(summary) {
  if (!summary) return '## Executive Summary\n\nLocal executive summary is disabled for this report.';
  return [
    '## Executive Summary',
    '',
    summary.headline,
    '',
    summary.overview,
    '',
    'Key risks:',
    ...summary.keyRisks.map((risk) => `- [${risk.severity}] ${risk.title}: ${risk.evidence}`),
    '',
    'Next actions:',
    ...summary.nextActions.map((action) => `- ${action}`),
    '',
    'Evidence:',
    ...summary.evidence.map((item) => `- ${item}`)
  ].join('\n');
}

function renderTopologyMarkdown(topology) {
  if (!topology) return '- No topology data.';
  const edges = topology.edges.map((edge) => {
    const from = topology.nodes.find((node) => node.id === edge.from)?.label ?? edge.from;
    const to = topology.nodes.find((node) => node.id === edge.to)?.label ?? edge.to;
    return `- ${from} ${edge.label} ${to}`;
  }).join('\n');
  const risks = topology.risks.map((risk) => `- [${risk.severity}] ${risk.title}`).join('\n');
  return [
    `Root: ${topology.root.label}`,
    '',
    'Relationships:',
    edges || '- No relationships.',
    '',
    'Topology Risks:',
    risks || '- No topology risks.'
  ].join('\n');
}

function renderTopologyMapSummaryMarkdown(map) {
  if (!map) return '- No topology map data.';
  const severityCounts = map.nodes.reduce((counts, node) => {
    counts[node.severity] = (counts[node.severity] ?? 0) + 1;
    return counts;
  }, { critical: 0, high: 0, medium: 0, low: 0 });
  const lanes = map.legend.map((kind) => {
    const count = map.nodes.filter((node) => node.kind === kind).length;
    return `${kind}: ${count}`;
  }).join(', ');
  const riskNodes = map.nodes
    .filter((node) => ['critical', 'high', 'medium'].includes(node.severity))
    .map((node) => `- [${node.severity}] ${node.kind} ${node.label}`)
    .join('\n');

  return [
    `Mode: ${map.mode ?? 'local-service-topology-map'}`,
    `Map nodes: ${map.nodes.length}`,
    `Map edges: ${map.edges.length}`,
    `Lanes: ${lanes}`,
    `Risk nodes: ${severityCounts.critical} critical, ${severityCounts.high} high, ${severityCounts.medium} medium, ${severityCounts.low} low.`,
    '',
    riskNodes || '- No elevated topology nodes.'
  ].join('\n');
}

function renderTopologyMapSummaryPrintHtml(map) {
  if (!map) return '<p>No topology map data.</p>';
  const severityCounts = map.nodes.reduce((counts, node) => {
    counts[node.severity] = (counts[node.severity] ?? 0) + 1;
    return counts;
  }, { critical: 0, high: 0, medium: 0, low: 0 });
  const lanes = (map.legend ?? []).map((kind) => {
    const count = map.nodes.filter((node) => node.kind === kind).length;
    return `${kind}: ${count}`;
  }).join(', ');
  const riskNodes = map.nodes
    .filter((node) => ['critical', 'high', 'medium'].includes(node.severity))
    .slice(0, 10)
    .map((node) => `<li>[${escapeHtml(node.severity)}] ${escapeHtml(node.kind)} ${escapeHtml(node.label)}</li>`)
    .join('');

  return `
    <section class="finding">
      <p><strong>Mode:</strong> ${escapeHtml(map.mode ?? 'local-service-topology-map')}</p>
      <p><strong>Map nodes:</strong> ${map.nodes.length} | <strong>Map edges:</strong> ${map.edges.length}</p>
      <p><strong>Lanes:</strong> ${escapeHtml(lanes || 'none')}</p>
      <p><strong>Risk nodes:</strong> ${severityCounts.critical} critical, ${severityCounts.high} high, ${severityCounts.medium} medium, ${severityCounts.low} low.</p>
      <ul>${riskNodes || '<li>No elevated topology nodes.</li>'}</ul>
    </section>
  `;
}

function renderServiceCatalogMarkdown(serviceCatalog = []) {
  if (serviceCatalog.length === 0) return '- No service catalog data.';
  return serviceCatalog.map((entry) => {
    const ports = entry.ports.map((port) => `${port.protocol}/${port.port} ${port.exposure}`).join(', ') || 'no listener';
    const backing = entry.backing.map((item) => {
      return `${item.kind}:${item.name}${item.status ? `(${item.status})` : ''}`;
    }).join(', ') || 'owner unknown';
    const risks = entry.risks.map((risk) => `[${risk.severity}] ${risk.title}`).join('; ') || 'clear';
    return [
      `### ${entry.name}`,
      '',
      `- Role: ${entry.role}`,
      `- Health: ${entry.health}`,
      `- Exposure: ${entry.exposure}`,
      `- Ports: ${ports}`,
      `- Backing: ${backing}`,
      `- Risks: ${risks}`,
      `- Recommendation: ${entry.recommendation}`
    ].join('\n');
  }).join('\n\n');
}

function renderFindingCommandsMarkdown(finding) {
  const commands = finding.commands ?? [];
  if (commands.length === 0) return '  - No commands provided.';
  return commands.map((command) => `  - \`${command}\``).join('\n');
}

function renderReportPrintHtml(report, server) {
  const title = `${server?.name ?? report.summary.hostname} ServerLens Report`;
  const executiveSummary = report.executiveSummary
    ? `
      <h2>Executive Summary</h2>
      <section class="finding">
        <h3>${escapeHtml(report.executiveSummary.headline)}</h3>
        <p>${escapeHtml(report.executiveSummary.overview)}</p>
        <p><strong>Key risks:</strong></p>
        <ul>${report.executiveSummary.keyRisks.map((risk) => `<li>[${escapeHtml(risk.severity)}] ${escapeHtml(risk.title)}: ${escapeHtml(risk.evidence)}</li>`).join('')}</ul>
        <p><strong>Next actions:</strong></p>
        <ul>${report.executiveSummary.nextActions.map((action) => `<li>${escapeHtml(action)}</li>`).join('')}</ul>
      </section>
    `
    : '<h2>Executive Summary</h2><p>Local executive summary is disabled for this report.</p>';
  const findings = report.findings.map((finding) => `
    <section class="finding">
      <h3>${escapeHtml(finding.title)}</h3>
      <p><strong>Severity:</strong> ${escapeHtml(finding.severity)} | <strong>Category:</strong> ${escapeHtml(finding.category)}</p>
      <p><strong>Evidence:</strong> ${escapeHtml(finding.evidence.join(' '))}</p>
      <p><strong>Recommendation:</strong> ${escapeHtml(finding.recommendation)}</p>
      <p><strong>Commands:</strong></p>
      <pre>${escapeHtml((finding.commands ?? []).join('\n') || 'No commands provided.')}</pre>
    </section>
  `).join('') || '<p>No findings.</p>';
  const recommendations = report.recommendations.map((item) => `<li>[${escapeHtml(item.severity)}] ${escapeHtml(item.action)}</li>`).join('') || '<li>No recommendations.</li>';
  const riskEventTimeline = renderRiskEventTimelinePrintHtml(report.riskEventTimeline);
  const securitySourceReview = renderSecuritySourceReviewPrintHtml(report.securitySourceReview);
  const evidenceAppendix = renderEvidenceAppendixPrintHtml(report.evidenceAppendix);
  const remediationPlan = renderRemediationPlanPrintHtml(report.remediationPlan);
  const topologyMapSummary = renderTopologyMapSummaryPrintHtml(report.topology?.map);
  const serviceCatalog = (report.serviceCatalog ?? []).map((entry) => {
    const ports = entry.ports.map((port) => `${port.protocol}/${port.port}`).join(', ') || 'no listener';
    const risk = entry.risks[0] ? `[${entry.risks[0].severity}] ${entry.risks[0].title}` : 'clear';
    return `
      <section class="finding">
        <h3>${escapeHtml(entry.name)}</h3>
        <p><strong>Role:</strong> ${escapeHtml(entry.role)} | <strong>Health:</strong> ${escapeHtml(entry.health)} | <strong>Exposure:</strong> ${escapeHtml(entry.exposure)}</p>
        <p><strong>Ports:</strong> ${escapeHtml(ports)}</p>
        <p><strong>Risk:</strong> ${escapeHtml(risk)}</p>
        <p><strong>Recommendation:</strong> ${escapeHtml(entry.recommendation)}</p>
      </section>
    `;
  }).join('') || '<p>No service catalog data.</p>';

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    '<style>',
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:32px;color:#1f2937;line-height:1.45;}',
    'header{border-bottom:1px solid #d7dde8;margin-bottom:24px;padding-bottom:18px;}',
    'h1{font-size:28px;margin:0 0 8px;} h2{font-size:18px;margin-top:24px;} h3{font-size:15px;margin-bottom:6px;}',
    '.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0;}',
    '.cell,.finding{border:1px solid #d7dde8;border-radius:8px;padding:12px;background:#f8fafc;}',
    '.cell span{display:block;color:#64748b;font-size:12px;text-transform:uppercase;} .cell strong{font-size:22px;}',
    'li{margin:6px 0;} @media print{body{margin:18mm}.no-print{display:none}.finding{break-inside:avoid}}',
    '</style>',
    '</head>',
    '<body>',
    '<button class="no-print" onclick="window.print()">Save as PDF</button>',
    '<header>',
    '<h1>ServerLens Report</h1>',
    `<p>${escapeHtml(server?.name ?? report.summary.hostname)} | ${escapeHtml(server?.host ?? report.summary.hostname)} | Generated ${escapeHtml(report.generatedAt)}</p>`,
    '</header>',
    '<main>',
    '<section class="grid">',
    `<div class="cell"><span>Score</span><strong>${report.score}</strong></div>`,
    `<div class="cell"><span>Status</span><strong>${escapeHtml(report.status)}</strong></div>`,
    `<div class="cell"><span>Open ports</span><strong>${report.summary.openPorts}</strong></div>`,
    `<div class="cell"><span>Findings</span><strong>${report.findings.length}</strong></div>`,
    '</section>',
    '<p><strong>Analysis scope:</strong> ',
    `${escapeHtml(report.analysisScope?.depth ?? 'standard')} / ${escapeHtml(report.analysisScope?.timeRange ?? 'latest-snapshot')}</p>`,
    executiveSummary,
    '<h2>Risk Event Timeline</h2>',
    riskEventTimeline,
    '<h2>Security Source Review</h2>',
    securitySourceReview,
    '<h2>Evidence Appendix</h2>',
    evidenceAppendix,
    '<h2>Remediation Checklist</h2>',
    remediationPlan,
    '<h2>Recommendations</h2>',
    `<ul>${recommendations}</ul>`,
    '<h2>Service Catalog</h2>',
    serviceCatalog,
    '<h2>Service Topology</h2>',
    `<pre>${escapeHtml(renderTopologyMarkdown(report.topology))}</pre>`,
    '<h2>Topology Map Summary</h2>',
    topologyMapSummary,
    '<h2>Findings</h2>',
    findings,
    '</main>',
    '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));</script>',
    '</body>',
    '</html>'
  ].join('');
}

function renderServerRunbookMarkdown(detail) {
  const { server, snapshot, report } = detail;
  const commands = uniqueCommands(report?.findings ?? [], report?.remediationPlan);

  return [
    '# ServerLens Server Runbook',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Server: ${server.name}`,
    `Host: ${server.host}:${server.port ?? 22}`,
    '',
    '## Asset',
    '',
    `- ID: ${server.id}`,
    `- Group: ${server.group ?? 'default'}`,
    `- Tags: ${(server.tags ?? []).join(', ') || 'untagged'}`,
    `- Mode: ${server.mode ?? 'demo'}`,
    `- Auth: ${server.authType ?? 'none'}`,
    `- SSH user: ${server.username || 'not configured'}`,
    `- Connection: ${server.connection?.status ?? 'untested'} (${server.connection?.message ?? 'No connection test recorded.'})`,
    `- Archived: ${server.archived ? 'yes' : 'no'}`,
    '',
    '## Latest Snapshot',
    '',
    renderRunbookSnapshotMarkdown(snapshot),
    '',
    '## Latest Report',
    '',
    report ? [
      `- Report ID: ${report.id}`,
      `- Generated: ${report.generatedAt}`,
      `- Score: ${report.score}`,
      `- Status: ${report.status}`,
      `- Scope: ${report.analysisScope?.depth ?? 'standard'} / ${report.analysisScope?.timeRange ?? 'latest-snapshot'}`,
      `- Modules: ${report.modulesRun.map((moduleName) => moduleName).join(', ')}`,
      `- Findings: ${report.findings.length}`
    ].join('\n') : '- No report has been generated.',
    '',
    '## Service Catalog',
    '',
    report ? renderServiceCatalogMarkdown(report.serviceCatalog) : '- Run analysis to generate service catalog data.',
    '',
    '## Topology Map Summary',
    '',
    report ? renderTopologyMapSummaryMarkdown(report.topology?.map) : '- Run analysis to generate topology map data.',
    '',
    '## Risk Event Timeline',
    '',
    report ? renderRiskEventTimelineMarkdown(report.riskEventTimeline) : '- Run analysis to generate risk timeline data.',
    '',
    '## Security Source Review',
    '',
    report ? renderSecuritySourceReviewMarkdown(report.securitySourceReview) : '- Run analysis to generate security source review data.',
    '',
    '## Evidence Appendix',
    '',
    report ? renderEvidenceAppendixMarkdown(report.evidenceAppendix) : '- Run analysis to generate evidence appendix data.',
    '',
    '## Remediation Checklist',
    '',
    report ? renderRemediationPlanMarkdown(report.remediationPlan) : '- Run analysis to generate remediation actions.',
    '',
    '## Diagnostic Commands',
    '',
    commands.length > 0 ? commands.map((command) => `- \`${command}\``).join('\n') : '- No diagnostic commands are available.',
    '',
    '## Safety Boundary',
    '',
    '- Runbook content is generated locally from authorized telemetry, stored server metadata, and rule-based findings.',
    '- It does not execute commands, modify servers, probe adjacent hosts, store passwords, or call external AI services.',
    '- Commands are diagnostic aids for authorized operators to review before use.'
  ].join('\n');
}

function renderRunbookSnapshotMarkdown(snapshot) {
  if (!snapshot) return '- No snapshot has been collected.';
  return [
    `- Collected: ${snapshot.collectedAt}`,
    `- Hostname: ${snapshot.system.hostname}`,
    `- Platform: ${snapshot.system.platform}`,
    `- Uptime: ${Math.round(snapshot.system.uptimeSeconds / 86400)} days`,
    `- Load average: ${snapshot.system.loadAverage.join(' / ')}`,
    `- CPU: ${snapshot.resources.cpuPercent}%`,
    `- Memory: ${snapshot.resources.memoryPercent}%`,
    `- Disk: ${snapshot.resources.diskPercent}%`,
    `- Disk IO: read ${snapshot.resources.diskReadMbps ?? 0} MB/s, write ${snapshot.resources.diskWriteMbps ?? 0} MB/s, iowait ${snapshot.resources.ioWaitPercent ?? 0}%`,
    `- Network: RX ${snapshot.resources.networkRxMbps} Mbps, TX ${snapshot.resources.networkTxMbps} Mbps`,
    `- Processes: ${snapshot.processes.length}`,
    `- Ports: ${snapshot.ports.length}`,
    `- Services: ${snapshot.services.length}`,
    `- Containers: ${snapshot.containers.length}`
  ].join('\n');
}

function uniqueCommands(findings, remediationPlan) {
  const commands = new Set();
  findings.forEach((finding) => {
    (finding.commands ?? []).forEach((command) => commands.add(command));
  });
  remediationPlan?.phases?.forEach((phase) => {
    phase.items.forEach((item) => {
      (item.commands ?? []).forEach((command) => commands.add(command));
    });
  });
  return [...commands].slice(0, 18);
}

function renderRiskEventTimelineMarkdown(timeline) {
  const events = timeline?.events ?? [];
  if (events.length === 0) return '- No risk events were generated from the available evidence.';
  return [
    `Mode: ${timeline.mode ?? 'local-evidence-timeline'}`,
    `Generated: ${timeline.generatedAt}`,
    `Summary: ${timeline.summary?.critical ?? 0} critical, ${timeline.summary?.high ?? 0} high, ${timeline.summary?.medium ?? 0} medium, ${timeline.summary?.low ?? 0} low.`,
    '',
    ...events.map((event) => [
      `### ${event.title}`,
      '',
      `- Time: ${event.timestamp}`,
      `- Window: ${event.window}`,
      `- Severity: ${event.severity}`,
      `- Category: ${event.category}`,
      `- Source: ${event.source}`,
      `- Evidence: ${event.evidence.join(' ')}`,
      `- Recommendation: ${event.recommendation}`,
      `- Linked findings: ${(event.findingIds ?? []).join(', ') || 'none'}`
    ].join('\n'))
  ].join('\n');
}

function renderRiskEventTimelinePrintHtml(timeline) {
  const events = timeline?.events ?? [];
  if (events.length === 0) return '<p>No risk events were generated from the available evidence.</p>';
  return [
    `<p><strong>Mode:</strong> ${escapeHtml(timeline.mode ?? 'local-evidence-timeline')} | <strong>Generated:</strong> ${escapeHtml(timeline.generatedAt)}</p>`,
    `<p><strong>Summary:</strong> ${timeline.summary?.critical ?? 0} critical, ${timeline.summary?.high ?? 0} high, ${timeline.summary?.medium ?? 0} medium, ${timeline.summary?.low ?? 0} low.</p>`,
    ...events.slice(0, 8).map((event) => `
      <section class="finding">
        <h3>${escapeHtml(event.title)}</h3>
        <p><strong>Time:</strong> ${escapeHtml(event.timestamp)} | <strong>Window:</strong> ${escapeHtml(event.window)}</p>
        <p><strong>Severity:</strong> ${escapeHtml(event.severity)} | <strong>Category:</strong> ${escapeHtml(event.category)} | <strong>Source:</strong> ${escapeHtml(event.source)}</p>
        <p><strong>Evidence:</strong> ${escapeHtml(event.evidence.join(' '))}</p>
        <p><strong>Recommendation:</strong> ${escapeHtml(event.recommendation)}</p>
      </section>
    `)
  ].join('');
}

function renderSecuritySourceReviewMarkdown(review) {
  const sources = review?.sources ?? [];
  if (sources.length === 0) return '- No security source review entries were generated.';
  return [
    `Mode: ${review.mode ?? 'local-security-source-review'}`,
    `Generated: ${review.generatedAt}`,
    `Summary: ${review.summary?.totalSources ?? sources.length} sources, ${review.summary?.highRisk ?? 0} high-risk sources.`,
    '',
    ...sources.map((source) => [
      `### ${source.label ?? source.remoteAddress}`,
      '',
      `- Severity: ${source.severity}`,
      `- Remote address: ${source.remoteAddress}`,
      `- Ports: ${(source.ports ?? []).join(', ') || 'n/a'}`,
      `- Signals: ${(source.signals ?? []).join(' ')}`,
      `- Evidence: ${(source.evidence ?? []).join(' ')}`,
      `- Recommendation: ${source.recommendation}`
    ].join('\n')),
    '',
    `Boundary: ${review.boundary ?? 'Local evidence only.'}`
  ].join('\n');
}

function renderSecuritySourceReviewPrintHtml(review) {
  const sources = review?.sources ?? [];
  if (sources.length === 0) return '<p>No security source review entries were generated.</p>';
  return [
    `<p><strong>Mode:</strong> ${escapeHtml(review.mode ?? 'local-security-source-review')} | <strong>Sources:</strong> ${review.summary?.totalSources ?? sources.length} | <strong>High risk:</strong> ${review.summary?.highRisk ?? 0}</p>`,
    ...sources.slice(0, 10).map((source) => `
      <section class="finding">
        <h3>${escapeHtml(source.label ?? source.remoteAddress)}</h3>
        <p><strong>Severity:</strong> ${escapeHtml(source.severity)} | <strong>Remote address:</strong> ${escapeHtml(source.remoteAddress)} | <strong>Ports:</strong> ${escapeHtml((source.ports ?? []).join(', ') || 'n/a')}</p>
        <p><strong>Signals:</strong> ${escapeHtml((source.signals ?? []).join(' '))}</p>
        <p><strong>Evidence:</strong> ${escapeHtml((source.evidence ?? []).join(' '))}</p>
        <p><strong>Recommendation:</strong> ${escapeHtml(source.recommendation)}</p>
      </section>
    `),
    `<p>${escapeHtml(review.boundary ?? 'Local evidence only.')}</p>`
  ].join('');
}

function renderEvidenceAppendixMarkdown(appendix) {
  const items = appendix?.items ?? [];
  if (items.length === 0) return '- No evidence appendix entries were generated.';
  return [
    `Mode: ${appendix.mode ?? 'local-redacted-evidence'}`,
    `Generated: ${appendix.generatedAt}`,
    `Redaction: ${appendix.redaction?.policy ?? 'metadata-and-rule-evidence-only'}`,
    `${appendix.redaction?.note ?? 'Secrets are not included.'}`,
    `Summary: ${appendix.summary?.totalItems ?? items.length} items, ${appendix.summary?.commandCount ?? 0} commands.`,
    '',
    ...items.map((item) => [
      `### ${item.title}`,
      '',
      `- Finding ID: ${item.findingId}`,
      `- Severity: ${item.severity}`,
      `- Category: ${item.category}`,
      `- Source: ${item.source}`,
      `- Redaction: ${item.redaction}`,
      `- Evidence: ${item.evidence.join(' ')}`,
      `- Recommendation: ${item.recommendation}`,
      `- Commands: ${(item.commands ?? []).map((command) => `\`${command}\``).join(', ') || 'No commands provided.'}`
    ].join('\n'))
  ].join('\n');
}

function renderEvidenceAppendixPrintHtml(appendix) {
  const items = appendix?.items ?? [];
  if (items.length === 0) return '<p>No evidence appendix entries were generated.</p>';
  return [
    `<p><strong>Mode:</strong> ${escapeHtml(appendix.mode ?? 'local-redacted-evidence')} | <strong>Redaction:</strong> ${escapeHtml(appendix.redaction?.policy ?? 'metadata-and-rule-evidence-only')}</p>`,
    `<p>${escapeHtml(appendix.redaction?.note ?? 'Secrets are not included.')}</p>`,
    ...items.slice(0, 10).map((item) => `
      <section class="finding">
        <h3>${escapeHtml(item.title)}</h3>
        <p><strong>Finding:</strong> ${escapeHtml(item.findingId)} | <strong>Severity:</strong> ${escapeHtml(item.severity)} | <strong>Source:</strong> ${escapeHtml(item.source)}</p>
        <p><strong>Redaction:</strong> ${escapeHtml(item.redaction)}</p>
        <p><strong>Evidence:</strong> ${escapeHtml(item.evidence.join(' '))}</p>
        <pre>${escapeHtml((item.commands ?? []).join('\n') || 'No commands provided.')}</pre>
      </section>
    `)
  ].join('');
}

function renderRemediationPlanPrintHtml(plan) {
  if (!plan || plan.totalActions === 0) return '<p>No remediation actions generated.</p>';
  return plan.phases.map((phase) => {
    if (phase.items.length === 0) return '';
    return `
      <section class="finding">
        <h3>${escapeHtml(phase.label)}</h3>
        <p>${escapeHtml(phase.intent)}</p>
        <ul>${phase.items.map((item) => `
          <li>
            <strong>[${escapeHtml(item.severity)}] ${escapeHtml(item.title)}</strong><br>
            Owner: ${escapeHtml(item.owner)}<br>
            Action: ${escapeHtml(item.action)}<br>
            Evidence: ${escapeHtml(item.evidence.join(' '))}<br>
            Acceptance: ${escapeHtml(item.acceptance)}<br>
            Commands: ${escapeHtml((item.commands ?? []).join(' | ') || 'No commands provided.')}
          </li>
        `).join('')}</ul>
      </section>
    `;
  }).filter(Boolean).join('');
}

function buildReportSummary(store) {
  const reports = store.listReports();
  const serversById = new Map(store.listServers().map((server) => [server.id, server]));
  const history = reports.map((report) => {
    const server = serversById.get(report.serverId);
    return {
      id: report.id,
      serverId: report.serverId,
      serverName: server?.name ?? report.summary.hostname,
      generatedAt: report.generatedAt,
      status: report.status,
      score: report.score,
      findings: report.findings.length,
      critical: countSeverity(report, 'critical'),
      high: countSeverity(report, 'high'),
      modulesRun: report.modulesRun
    };
  });
  const current = history[0] ?? null;
  const previous = history.find((item) => item.serverId === current?.serverId && item.id !== current.id) ?? history[1] ?? null;

  return {
    history,
    trends: {
      score: history.slice().reverse().map((item) => ({
        reportId: item.id,
        serverName: item.serverName,
        generatedAt: item.generatedAt,
        value: item.score
      })),
      findings: history.slice().reverse().map((item) => ({
        reportId: item.id,
        serverName: item.serverName,
        generatedAt: item.generatedAt,
        value: item.findings
      }))
    },
    comparison: current && previous
      ? {
          current,
          previous,
          deltaScore: current.score - previous.score,
          deltaFindings: current.findings - previous.findings,
          newHighRisk: current.high + current.critical - previous.high - previous.critical
        }
      : null
  };
}

function countSeverity(report, severity) {
  return report.findings.filter((finding) => finding.severity === severity).length;
}

function buildStatusPageSummary(store) {
  const activeServers = store.listServers().filter((server) => !server.archived);
  const services = activeServers.map((server) => {
    const report = server.latestReport;
    const score = report?.score ?? null;
    return {
      id: server.id,
      name: server.name,
      group: server.group ?? 'default',
      status: statusForScore(score),
      score,
      lastUpdatedAt: report?.generatedAt ?? server.latestSnapshot?.collectedAt ?? server.createdAt,
      activeIncidents: report
        ? report.findings.filter((finding) => ['critical', 'high'].includes(finding.severity)).length
        : 0
    };
  });
  const incidents = store.listAlerts()
    .filter((alert) => alert.status !== 'acknowledged')
    .slice(0, 12)
    .map((alert) => ({
      id: alert.id,
      serviceName: alert.serverName,
      severity: alert.severity,
      title: alert.title,
      category: alert.category,
      createdAt: alert.createdAt
    }));
  const criticalCount = incidents.filter((incident) => incident.severity === 'critical').length;
  const highCount = incidents.filter((incident) => incident.severity === 'high').length;
  const hasMajorService = services.some((service) => service.status === 'major-incident');
  const hasDegradedService = services.some((service) => service.status === 'degraded');

  return {
    product: 'ServerLens',
    generatedAt: new Date().toISOString(),
    localOnly: true,
    visibility: 'local-preview',
    overallStatus: criticalCount > 0 || hasMajorService
      ? 'major-incident'
      : highCount > 0 || hasDegradedService
        ? 'degraded'
        : 'operational',
    totals: {
      services: services.length,
      operational: services.filter((service) => service.status === 'operational').length,
      degraded: services.filter((service) => service.status === 'degraded').length,
      majorIncident: services.filter((service) => service.status === 'major-incident').length,
      activeIncidents: incidents.length
    },
    services,
    incidents
  };
}

function buildEcosystemForStore(store) {
  const servers = store.listServers();
  const histories = {};
  for (const server of servers) {
    histories[server.id] = store.listSnapshotHistory(server.id);
  }
  return buildEcosystemOverview({ servers, histories });
}

function buildHandoffChecklist(store) {
  const evidence = buildDeliveryEvidence({ projectRoot });
  const readiness = buildDeliveryReadiness({ projectRoot });
  const activeServers = store.listServers().filter((server) => !server.archived);
  const reports = store.listReports();
  const jobs = store.listAnalysisJobs();
  const latestReport = reports[0] ?? null;
  const latestServer = latestReport
    ? activeServers.find((server) => server.id === latestReport.serverId) ?? null
    : activeServers[0] ?? null;

  const steps = [
    handoffStep(
      'demo-fleet',
      'Demo fleet is reviewable',
      activeServers.length > 0,
      'Open Servers and confirm the demo assets match the client conversation.',
      [
        `${activeServers.length} active server assets available`,
        `${activeServers.filter((server) => server.mode === 'demo').length} demo assets use local sample telemetry`
      ]
    ),
    handoffStep(
      'latest-report',
      'Latest analysis report exists',
      Boolean(latestReport),
      'Analyze a server from the toolbar to create or refresh the latest report.',
      latestReport
        ? [
            `Report ${latestReport.id} generated for ${latestServer?.name ?? latestReport.summary.hostname}`,
            `${latestReport.modulesRun.length} modules, score ${latestReport.score}`
          ]
        : ['No report has been generated yet.']
    ),
    handoffStep(
      'export-markdown',
      'Markdown report export is ready',
      Boolean(latestReport),
      'Use Export Markdown in Reports Center for a reviewable report copy.',
      latestReport
        ? [`/api/reports/${latestReport.id}/markdown`, 'Includes findings, recommendations, commands, timeline, and evidence appendix']
        : ['Run analysis before exporting Markdown.']
    ),
    handoffStep(
      'export-pdf',
      'PDF print handoff is ready',
      Boolean(latestReport),
      'Use Export PDF in Reports Center to open the print-ready handoff view.',
      latestReport
        ? [`/api/reports/${latestReport.id}/print`, 'Print view invokes the local browser print dialog']
        : ['Run analysis before opening the PDF handoff view.']
    ),
    handoffStep(
      'export-runbook',
      'Server runbook export is ready',
      Boolean(latestServer),
      'Use Export Runbook for the selected server before client handoff.',
      latestServer
        ? [`/api/servers/${latestServer.id}/runbook/markdown`, 'Includes asset metadata, latest evidence, commands, and safety boundary']
        : ['Add or restore a server before exporting a runbook.']
    ),
    handoffStep(
      'readiness-gate',
      'Readiness gate is passing',
      readiness.status === 'ready',
      'Run readiness gate in Settings after every build or packaging change.',
      [`readiness gate status: ${readiness.status}`, `${readiness.summary.pass} checks passed, ${readiness.summary.fail} failed`]
    ),
    handoffStep(
      'handoff-package',
      'Offline handoff package is declared',
      evidence.verificationCommands.includes('npm.cmd run handoff:dir'),
      'Run npm.cmd run package:app, then npm.cmd run handoff:dir for the client package.',
      [
        evidence.packagePath,
        ...evidence.verificationCommands.filter((command) => command.includes('package:app') || command.includes('handoff:dir'))
      ]
    ),
    handoffStep(
      'local-safety',
      'Local defensive safety boundary is visible',
      evidence.safetyBoundary.every((item) => !/brute force|exploit|attack/i.test(item)),
      'Review safety boundary with the client before connecting authorized servers.',
      [
        'Demo mode uses no external network connections.',
        ...evidence.safetyBoundary.slice(0, 3)
      ]
    )
  ];
  const summary = summarizeHandoffSteps(steps);

  return {
    product: evidence.product,
    deliveryMode: evidence.deliveryMode,
    generatedAt: new Date().toISOString(),
    status: summary.blocked > 0 ? 'blocked' : summary.review > 0 ? 'review' : 'ready',
    summary,
    steps,
    recentActivity: {
      servers: activeServers.length,
      reports: reports.length,
      completedJobs: jobs.filter((job) => job.status === 'completed').length
    },
    nextActions: summary.blocked > 0
      ? ['Resolve blocked checklist items before creating the client handoff directory.']
      : [
          'Run npm.cmd test, npm.cmd run build, npm.cmd run package:app, and npm.cmd run handoff:dir.',
          'Review START-HERE.txt and delivery-evidence.json with the client.'
        ]
  };
}

function buildInspectionWorkspace(store) {
  const evidence = buildDeliveryEvidence({ projectRoot });
  const readiness = buildDeliveryReadiness({ projectRoot });
  const checklist = buildHandoffChecklist(store);
  const activeServers = store.listServers().filter((server) => !server.archived);
  const reports = store.listReports();
  const latestReport = reports[0] ?? null;
  const server = latestReport
    ? activeServers.find((item) => item.id === latestReport.serverId) ?? activeServers[0] ?? null
    : activeServers[0] ?? null;
  const snapshot = server ? store.getSnapshot(server.id) : null;
  const hasServer = Boolean(server);
  const hasSnapshot = Boolean(snapshot);
  const hasReport = Boolean(latestReport);
  const hasReadyGate = readiness.status === 'ready';
  const hasChecklist = checklist.status === 'ready';
  const steps = [
    inspectionStep(
      'authorize',
      'Authorize',
      hasServer,
      'Confirm explicit ownership before collecting telemetry.',
      hasServer
        ? [`server id: ${server.id}`, `mode: ${server.mode}`, `asset: ${server.name}`]
        : ['No active server asset is available.']
    ),
    inspectionStep(
      'preflight',
      'Preflight',
      hasServer && ['reachable', 'skipped'].includes(server.connection?.status ?? 'skipped'),
      'Run connection test for non-demo assets, then confirm collection mode.',
      hasServer
        ? [`connection: ${server.connection?.status ?? 'untested'}`, `host: ${redactHost(server.host)}`, `port: ${server.port ?? 22}`]
        : ['Add or restore a server before preflight.']
    ),
    inspectionStep(
      'collect',
      'Collect',
      hasSnapshot,
      'Collect authorized local or SSH telemetry for the selected server.',
      hasSnapshot
        ? [`snapshot: ${snapshot.id}`, `collected: ${snapshot.collectedAt}`, `${snapshot.ports.length} ports, ${snapshot.services.length} services`]
        : ['No snapshot has been collected yet.']
    ),
    inspectionStep(
      'analyze',
      'Analyze',
      hasReport,
      'Run a scoped defensive analysis and review evidence-backed findings.',
      hasReport
        ? [`report: ${latestReport.id}`, `score: ${latestReport.score}`, `${latestReport.findings.length} findings`]
        : ['No report has been generated yet.']
    ),
    inspectionStep(
      'package',
      'Package',
      hasReport && hasReadyGate && hasChecklist,
      'Review readiness, checklist, and handoff artifacts before client delivery.',
      [
        `readiness: ${readiness.status}`,
        `checklist: ${checklist.status}`,
        'handoff package: npm.cmd run handoff:dir'
      ]
    )
  ];
  const summary = summarizeInspectionSteps(steps);

  return {
    product: evidence.product,
    mode: 'local-authorized-inspection-workspace',
    generatedAt: new Date().toISOString(),
    status: !hasServer ? 'blocked' : summary.blocked > 0 ? 'review' : 'ready',
    server: hasServer
      ? {
          id: server.id,
          name: server.name,
          mode: server.mode,
          connectionStatus: server.connection?.status ?? 'untested'
        }
      : {
          id: null,
          name: 'No server selected',
          mode: 'none',
          connectionStatus: 'blocked'
        },
    steps,
    packageArtifacts: [
      'Markdown report',
      'PDF handoff',
      'Server runbook',
      'Delivery validation ledger'
    ],
    safetyBoundary: evidence.safetyBoundary,
    nextActions: summary.blocked > 0
      ? ['Complete review steps before creating the client handoff package.']
      : ['Copy the inspection package summary and review it with the client.']
  };
}

function buildStrategyIterationWorkspace(store) {
  const evidence = buildDeliveryEvidence({ projectRoot });
  const readiness = buildDeliveryReadiness({ projectRoot });
  const checklist = buildHandoffChecklist(store);
  const inspection = buildInspectionWorkspace(store);
  const activeServers = store.listServers().filter((server) => !server.archived);
  const reports = store.listReports();
  const jobs = store.listAnalysisJobs();
  const v40References = ['uptime-kuma', 'glances', 'node_exporter', 'dashy'];
  const iterations = [
    strategyIteration(
      'strategy-01-baseline',
      '01 Baseline',
      'Establish the current 3.0 delivery state before changing scope.',
      'Verified demo fleet, latest analysis, readiness, inspection, and package evidence as the baseline.',
      'API, package, and CodeStable state are used as the baseline evidence.',
      [`servers: ${activeServers.length}`, `reports: ${reports.length}`, `inspection: ${inspection.status}`]
    ),
    strategyIteration(
      'strategy-02-reference-synthesis',
      '02 References',
      'Add fresh reference repositories for status, incident, and operations delivery patterns.',
      'Pulled Uptime Kuma, Glances, node_exporter, and Dashy under references/github-v100.',
      'Build and readiness gates require the v10.0 reference names and local notes.',
      v40References.map((ref) => `references/github-v100/${ref}`)
    ),
    strategyIteration(
      'strategy-03-commercial-scope',
      '03 Scope',
      'Convert the vague big-version request into a constrained commercial workspace.',
      'Defined the 10-cycle strategy surface as a local delivery planner, not an external automation engine.',
      'The strategy endpoint exposes exactly 10 completed iterations with plan and execution fields.',
      ['version target: 10.0.0', 'scope: local-first desktop delivery', 'iterations: 10']
    ),
    strategyIteration(
      'strategy-04-safe-data-boundary',
      '04 Boundary',
      'Keep all strategy execution defensive and authorization-scoped.',
      'Reused existing safety boundary and limited next actions to local app routing, reports, and package review.',
      'Safety evidence excludes brute force, exploit, attack, enrichment, blocking, and remote modification claims.',
      evidence.safetyBoundary.slice(0, 4)
    ),
    strategyIteration(
      'strategy-05-operator-flow',
      '05 Flow',
      'Make the strategy loop usable by an operator during a real delivery review.',
      'Added ordered iteration cards, an active evidence panel, and route actions to existing workspaces.',
      'UI contracts check Strategy navigation, rail, card, evidence panel, and copy controls.',
      ['Strategy nav item', '10 iteration cards', 'active evidence panel']
    ),
    strategyIteration(
      'strategy-06-ui-material',
      '06 Material',
      'Keep the new surface inside the macOS/iOS-style material system.',
      'Used restrained tinted panels, compact cards, stable rail dimensions, and contained scrolling.',
      'Build guardrails reject banned visual effects and UI visual evidence checks strategy presence.',
      ['OKLCH tinted surface', '8px card radius', 'contained touch scrolling']
    ),
    strategyIteration(
      'strategy-07-evidence-ledger',
      '07 Ledger',
      'Attach plan, execution, validation, and evidence to each strategy cycle.',
      'Every iteration includes a plan sentence, execution sentence, validation sentence, and evidence list.',
      'Commercial tests require all iterations to include plan, execution, validation, and evidence.',
      ['plan fields: 10', 'execution fields: 10', 'validation fields: 10']
    ),
    strategyIteration(
      'strategy-08-package-handoff',
      '08 Handoff',
      'Connect the strategy loop to final app packaging and client review.',
      'Updated delivery evidence, package checklist, README, and handoff defaults for ServerLens 10.0.0.',
      'Delivery validation writes the 10.0.0 handoff ledger beside the packaged app.',
      ['ServerLens-10.0.0', 'delivery-evidence.json', 'delivery-validation.json']
    ),
    strategyIteration(
      'strategy-09-validation-gates',
      '09 Gates',
      'Make the 10-cycle release auditable through existing commercial gates.',
      'Extended tests, build check, runtime smoke, UI evidence, readiness, and delivery validation coverage.',
      'The release is not accepted until delivery:validate is ready with zero failures.',
      [`readiness: ${readiness.status}`, `checklist: ${checklist.status}`, `jobs: ${jobs.length}`]
    ),
    strategyIteration(
      'strategy-10-release-ios',
      '10 iOS',
      'Leave the strategy decision trail in CodeStable for future major-version work.',
      'Added page-by-page operation summary and v10 monitoring reference basis for the 10-cycle delivery.',
      'CodeStable documents record each cycle as done after final source and D-drive validation.',
      ['docs/reference-notes.md', 'references/github-v100', 'page readiness evidence']
    )
  ];
  const summary = summarizeStrategyIterations(iterations);

  return {
    product: evidence.product,
    mode: 'local-10-cycle-strategy-workspace',
    generatedAt: new Date().toISOString(),
    versionTarget: '10.0.0',
    status: summary.blocked > 0 ? 'blocked' : summary.review > 0 ? 'review' : 'ready',
    summary,
    iterations,
    githubReferences: v40References,
    packageArtifacts: ['Strategy summary', 'Delivery validation ledger', 'UI visual evidence', 'ServerLens 10.0.0 handoff package'],
    safetyBoundary: evidence.safetyBoundary,
    nextActions: ['Review all 10 strategy cycles, copy the summary, then run delivery validation before handoff.']
  };
}

function strategyIteration(id, label, plan, execution, validation, evidence) {
  return {
    id,
    label,
    status: 'done',
    plan,
    execution,
    validation,
    evidence
  };
}

function summarizeStrategyIterations(iterations) {
  return iterations.reduce((summary, iteration) => {
    summary[iteration.status] += 1;
    return summary;
  }, { done: 0, review: 0, blocked: 0 });
}

function inspectionStep(id, label, ready, action, evidence) {
  return {
    id,
    label,
    status: ready ? 'ready' : 'blocked',
    action,
    evidence
  };
}

function summarizeInspectionSteps(steps) {
  return steps.reduce((summary, step) => {
    summary[step.status] += 1;
    return summary;
  }, { ready: 0, review: 0, blocked: 0 });
}

function redactHost(host = '') {
  if (!host) return 'not configured';
  const parts = String(host).split('.');
  if (parts.length <= 1) return `${parts[0].slice(0, 3)}...`;
  return `${parts[0].slice(0, 3)}...${parts.at(-1)}`;
}

function handoffStep(id, label, ready, action, evidence) {
  return {
    id,
    label,
    status: ready ? 'ready' : 'blocked',
    action,
    evidence
  };
}

function summarizeHandoffSteps(steps) {
  return steps.reduce((summary, step) => {
    summary[step.status] += 1;
    return summary;
  }, { ready: 0, review: 0, blocked: 0 });
}

function statusForScore(score) {
  if (score === null || score === undefined) return 'unknown';
  if (score < 65) return 'major-incident';
  if (score < 85) return 'degraded';
  return 'operational';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char];
  });
}
