import { randomUUID } from 'node:crypto';

export const ANALYSIS_MODULES = ['health', 'security', 'runtime', 'ecosystem', 'logs', 'network', 'performance'];

export const ANALYSIS_PRESETS = {
  'full-report': {
    modules: ANALYSIS_MODULES,
    depth: 'deep',
    timeRange: 'last-24h'
  },
  'security-review': {
    modules: ['security', 'logs', 'network'],
    depth: 'deep',
    timeRange: 'last-1h'
  },
  'runtime-health': {
    modules: ['health', 'runtime', 'performance'],
    depth: 'standard',
    timeRange: 'last-15m'
  },
  'service-ecosystem': {
    modules: ['ecosystem', 'runtime', 'network'],
    depth: 'standard',
    timeRange: 'latest-snapshot'
  }
};

const severityRank = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const scorePenalty = {
  critical: 25,
  high: 15,
  medium: 7,
  low: 3
};

export function calculateHealthScore(findings) {
  const penalty = findings.reduce((total, finding) => {
    return total + (scorePenalty[finding.severity] ?? 0);
  }, 0);
  return clamp(100 - penalty, 0, 100);
}

export function analyzeSnapshot(snapshot, options = {}) {
  const resolvedOptions = resolveAnalysisOptions(options);
  const modulesRun = normalizeModules(resolvedOptions.modules);
  const settings = normalizeSettings(options.settings);
  const analysisScope = normalizeAnalysisScope(resolvedOptions);
  const findings = modulesRun.flatMap((moduleName) => {
    if (moduleName === 'health') return analyzeHealth(snapshot, settings);
    if (moduleName === 'security') return analyzeSecurity(snapshot);
    if (moduleName === 'runtime') return analyzeRuntime(snapshot);
    if (moduleName === 'ecosystem') return analyzeEcosystem(snapshot);
    if (moduleName === 'logs') return analyzeLogs(snapshot);
    if (moduleName === 'network') return analyzeNetwork(snapshot);
    if (moduleName === 'performance') return analyzePerformance(snapshot, settings);
    return [];
  }).sort(compareFindings);

  const score = calculateHealthScore(findings);
  const recommendations = summarizeRecommendations(findings);
  const topology = buildServiceTopology(snapshot, findings);
  const serviceCatalog = buildServiceCatalog(snapshot, findings);
  const riskEventTimeline = buildRiskEventTimeline(snapshot, findings);
  const securitySourceReview = buildSecuritySourceReview(snapshot, findings);
  const evidenceAppendix = buildEvidenceAppendix(snapshot, findings);
  const remediationPlan = buildRemediationPlan(findings);
  const executiveSummary = settings.aiSummary.enabled
    ? buildExecutiveSummary(snapshot, findings, recommendations, score, analysisScope, modulesRun)
    : null;

  return {
    id: `report-${snapshot.id}-${cryptoId()}`,
    snapshotId: snapshot.id,
    serverId: snapshot.serverId,
    generatedAt: new Date().toISOString(),
    status: score < 60 || findings.some((finding) => finding.severity === 'critical')
      ? 'attention'
      : score < 85
        ? 'watch'
        : 'healthy',
    score,
    analysisScope,
    modulesRun,
    summary: {
      hostname: snapshot.system.hostname,
      platform: snapshot.system.platform,
      collectedAt: snapshot.collectedAt,
      openPorts: snapshot.ports.length,
      runningServices: snapshot.services.filter((service) => service.status === 'running').length,
      containers: snapshot.containers.length
    },
    topology,
    serviceCatalog,
    riskEventTimeline,
    securitySourceReview,
    evidenceAppendix,
    remediationPlan,
    trends: buildTrends(snapshot, options.snapshotHistory),
    executiveSummary,
    recommendations,
    findings
  };
}

function normalizeAnalysisScope(options = {}) {
  return {
    preset: options.preset ?? 'custom',
    depth: normalizeDepth(options.depth),
    timeRange: normalizeTimeRange(options.timeRange)
  };
}

export function resolveAnalysisOptions(options = {}) {
  const presetName = options.preset && options.preset !== 'custom' ? String(options.preset) : null;
  if (!presetName) return { ...options, preset: 'custom' };
  const preset = ANALYSIS_PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown analysis preset: ${presetName}`);
  }
  return {
    ...options,
    preset: presetName,
    modules: Array.isArray(options.modules) && options.modules.length > 0 ? options.modules : preset.modules,
    depth: options.depth ?? preset.depth,
    timeRange: options.timeRange ?? preset.timeRange
  };
}

function normalizeDepth(depth) {
  if (['quick', 'standard', 'deep'].includes(depth)) return depth;
  return 'standard';
}

function normalizeTimeRange(timeRange) {
  if (['latest-snapshot', 'last-15m', 'last-1h', 'last-24h'].includes(timeRange)) {
    return timeRange;
  }
  return 'latest-snapshot';
}

export function normalizeModules(modules = ANALYSIS_MODULES) {
  const requested = Array.isArray(modules) && modules.length > 0 ? modules : ANALYSIS_MODULES;
  const unknown = requested.filter((moduleName) => !ANALYSIS_MODULES.includes(moduleName));
  if (unknown.length > 0) {
    throw new Error(`Unknown analysis module: ${unknown.join(', ')}`);
  }
  return [...new Set(requested)];
}

function analyzeHealth(snapshot, settings) {
  const findings = [];
  const { cpuPercent, memoryPercent, diskPercent } = snapshot.resources;

  if (cpuPercent >= settings.thresholds.cpuHigh) {
    findings.push(createFinding({
      id: 'health.cpu-high',
      category: 'health',
      severity: 'high',
      title: 'CPU pressure is above the operating threshold',
      evidence: [`CPU usage is ${cpuPercent}%.`],
      recommendation: 'Review top processes, recent deployments, and scheduled jobs before scaling capacity.'
    }));
  }

  if (memoryPercent >= settings.thresholds.memoryHigh) {
    findings.push(createFinding({
      id: 'health.memory-high',
      category: 'health',
      severity: 'medium',
      title: 'Memory pressure may reduce service stability',
      evidence: [`Memory usage is ${memoryPercent}%.`],
      recommendation: 'Check resident process growth and restart leaking services during a maintenance window.'
    }));
  }

  if (diskPercent >= settings.thresholds.diskCritical) {
    findings.push(createFinding({
      id: 'health.disk-critical',
      category: 'health',
      severity: 'critical',
      title: 'Disk capacity is close to exhaustion',
      evidence: [`Disk usage is ${diskPercent}%.`],
      recommendation: 'Archive logs, expand the volume, and verify database free space before write failures occur.'
    }));
  }

  return findings;
}

function analyzeSecurity(snapshot) {
  const findings = [];
  const failedLogins = snapshot.securityEvents.failedSshLogins10m;

  if (failedLogins >= 50) {
    findings.push(createFinding({
      id: 'security.ssh-bruteforce',
      category: 'security',
      severity: 'critical',
      title: 'SSH authentication failures indicate a brute-force pattern',
      evidence: [`${failedLogins} failed SSH logins were observed in the last 10 minutes.`],
      recommendation: 'Confirm the source IPs, enable fail2ban, disable password login, and prefer key-only access.'
    }));
  }

  for (const connection of snapshot.securityEvents.suspiciousConnections) {
    if (connection.count >= 25) {
      findings.push(createFinding({
        id: `security.connection-spike.${connection.remoteAddress}`,
        category: 'security',
        severity: 'high',
        title: 'Repeated remote connections require review',
        evidence: [
          `${connection.remoteAddress} opened ${connection.count} connections to port ${connection.port}.`
        ],
        recommendation: 'Compare the source with allowlists, CDN ranges, and recent access logs before blocking.'
      }));
    }
  }

  return findings;
}

function analyzeRuntime(snapshot) {
  const findings = [];
  const unhealthyServices = snapshot.services.filter((service) => service.status !== 'running');

  for (const service of unhealthyServices) {
    findings.push(createFinding({
      id: 'runtime.service-degraded',
      category: 'runtime',
      severity: service.status === 'stopped' ? 'high' : 'medium',
      title: `${service.name} is ${service.status}`,
      evidence: [`Service ${service.name} reported status ${service.status}.`],
      recommendation: `Inspect system logs for ${service.name}, then restart or roll back the owning deployment.`
    }));
  }

  if (snapshot.resources.networkRxMbps + snapshot.resources.networkTxMbps >= 350) {
    findings.push(createFinding({
      id: 'runtime.network-saturation',
      category: 'runtime',
      severity: 'medium',
      title: 'Network throughput is elevated',
      evidence: [
        `RX ${snapshot.resources.networkRxMbps} Mbps and TX ${snapshot.resources.networkTxMbps} Mbps.`
      ],
      recommendation: 'Check traffic sources and confirm whether the increase matches expected workloads.'
    }));
  }

  return findings;
}

function analyzeEcosystem(snapshot) {
  const findings = [];
  const publicDatabasePorts = new Set([3306, 5432, 6379, 27017]);
  const exposedDatabase = snapshot.ports.find((port) => {
    return port.exposure === 'public' && publicDatabasePorts.has(port.port);
  });

  if (exposedDatabase) {
    findings.push(createFinding({
      id: 'ecosystem.public-database',
      category: 'ecosystem',
      severity: 'high',
      title: 'Database-like service is exposed publicly',
      evidence: [
        `${exposedDatabase.process} is listening on public ${exposedDatabase.protocol}/${exposedDatabase.port}.`
      ],
      recommendation: 'Restrict the port with firewall rules or bind it to a private network interface.'
    }));
  }

  for (const container of snapshot.containers) {
    if (container.restarts >= 3 || container.status !== 'running') {
      findings.push(createFinding({
        id: 'ecosystem.container-restarts',
        category: 'ecosystem',
        severity: 'medium',
        title: `${container.name} container is unstable`,
        evidence: [
          `${container.name} is ${container.status} with ${container.restarts} restarts.`
        ],
        recommendation: 'Inspect container logs, recent image changes, health checks, and dependency availability.'
      }));
    }
  }

  return findings;
}

function analyzeLogs(snapshot) {
  const findings = [];
  const logSummary = snapshot.logs ?? {};

  if ((logSummary.errorCount1h ?? 0) >= 20) {
    findings.push(createFinding({
      id: 'logs.error-burst',
      category: 'logs',
      severity: 'medium',
      title: 'Application and system logs show elevated errors',
      evidence: [`${logSummary.errorCount1h} errors were observed in the last hour.`],
      recommendation: 'Open the related service logs, group by message, and compare against recent deploys.'
    }));
  }

  if ((logSummary.authFailures1h ?? 0) >= 100) {
    findings.push(createFinding({
      id: 'logs.auth-failures',
      category: 'logs',
      severity: 'high',
      title: 'Authentication logs show repeated failures',
      evidence: [`${logSummary.authFailures1h} authentication failures were observed in the last hour.`],
      recommendation: 'Review authentication sources, rotate exposed credentials, and tighten login policy.'
    }));
  }

  return findings;
}

function analyzeNetwork(snapshot) {
  const findings = [];
  const publicPorts = snapshot.ports.filter((port) => port.exposure === 'public');
  const highRiskPorts = publicPorts.filter((port) => [22, 3306, 5432, 6379, 27017, 9200].includes(port.port));
  const unknownPublicListeners = publicPorts.filter((port) => isUnknownListenerProcess(port.process));

  if (publicPorts.length >= 4) {
    findings.push(createFinding({
      id: 'network.public-surface',
      category: 'network',
      severity: 'medium',
      title: 'Public network surface is larger than expected',
      evidence: [`${publicPorts.length} public listening ports were collected.`],
      recommendation: 'Confirm every public listener has an owner, firewall rule, and business justification.'
    }));
  }

  if (highRiskPorts.length > 0) {
    findings.push(createFinding({
      id: 'network.high-risk-public-ports',
      category: 'network',
      severity: 'high',
      title: 'High-risk infrastructure ports are reachable',
      evidence: highRiskPorts.map((port) => `${port.protocol}/${port.port} ${port.process} is public.`),
      recommendation: 'Move infrastructure services behind private networking, VPN, or a bastion host.'
    }));
  }

  if (unknownPublicListeners.length > 0) {
    findings.push(createFinding({
      id: 'network.unknown-public-listener',
      category: 'network',
      severity: 'medium',
      title: 'Unknown process is listening on a public port',
      evidence: unknownPublicListeners.map((port) => {
        return `${port.protocol}/${port.port} is public but process ownership is ${port.process || 'unknown'}.`;
      }),
      recommendation: 'Identify the owning process, confirm the service owner and business purpose, then close or firewall the listener if it is not expected.'
    }));
  }

  return findings;
}

function analyzePerformance(snapshot, settings) {
  const findings = [];
  const load1m = snapshot.system.loadAverage[0] ?? 0;
  const processCount = snapshot.processes?.length ?? 0;
  const diskReadMbps = snapshot.resources.diskReadMbps ?? 0;
  const diskWriteMbps = snapshot.resources.diskWriteMbps ?? 0;
  const ioWaitPercent = snapshot.resources.ioWaitPercent ?? 0;
  const diskIoMbps = diskReadMbps + diskWriteMbps;

  if (load1m >= settings.thresholds.loadHigh) {
    findings.push(createFinding({
      id: 'performance.load-high',
      category: 'performance',
      severity: 'medium',
      title: 'System load is above the review threshold',
      evidence: [`1 minute load average is ${load1m}.`],
      recommendation: 'Compare load with CPU cores, queue depth, and top process CPU consumption.'
    }));
  }

  if (processCount >= 5 && snapshot.resources.memoryPercent >= settings.thresholds.memoryHigh - 20) {
    findings.push(createFinding({
      id: 'performance.process-pressure',
      category: 'performance',
      severity: 'low',
      title: 'Process table suggests memory pressure concentration',
      evidence: [`${processCount} top processes were collected while memory is ${snapshot.resources.memoryPercent}%.`],
      recommendation: 'Sort top processes by RSS and confirm worker counts match capacity planning.'
    }));
  }

  if (ioWaitPercent >= 15 || diskIoMbps >= 250) {
    findings.push(createFinding({
      id: 'performance.disk-io-pressure',
      category: 'performance',
      severity: 'medium',
      title: 'Disk IO pressure may be slowing workloads',
      evidence: [
        `Disk read is ${diskReadMbps} MB/s, write is ${diskWriteMbps} MB/s, and iowait is ${ioWaitPercent}%.`
      ],
      recommendation: 'Identify IO-heavy processes, check database and log write volume, and confirm disk latency before restarting services.'
    }));
  }

  return findings;
}

function createFinding(finding) {
  return {
    ...finding,
    evidence: finding.evidence.filter(Boolean),
    recommendation: finding.recommendation,
    commands: finding.commands ?? commandsForFinding(finding)
  };
}

function commandsForFinding(finding) {
  if (finding.id === 'health.cpu-high') {
    return [
      'ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head',
      'uptime'
    ];
  }
  if (finding.id === 'health.memory-high') {
    return [
      'free -m',
      'ps -eo pid,comm,rss,%mem --sort=-rss | head'
    ];
  }
  if (finding.id === 'health.disk-critical') {
    return [
      'df -h',
      'du -xh /var/log | sort -h | tail'
    ];
  }
  if (finding.id === 'security.ssh-bruteforce') {
    return [
      'journalctl -u ssh --since "10 minutes ago" | grep "Failed password"',
      'fail2ban-client status sshd'
    ];
  }
  if (finding.id.startsWith('security.connection-spike')) {
    return [
      'ss -Htn state established',
      'journalctl --since "30 minutes ago" | grep "203.0.113.77"'
    ];
  }
  if (finding.id === 'runtime.service-degraded') {
    const serviceName = finding.title.split(' is ')[0];
    return [
      `systemctl status ${serviceName}`,
      `journalctl -u ${serviceName} -n 100`
    ];
  }
  if (finding.id === 'runtime.network-saturation') {
    return [
      'ss -s',
      'ip -s link'
    ];
  }
  if (finding.id === 'ecosystem.public-database') {
    return [
      'ss -tulpen | grep -E ":(3306|5432|6379|27017)"',
      'ufw status numbered'
    ];
  }
  if (finding.id === 'ecosystem.container-restarts') {
    const containerName = finding.title.split(' container ')[0];
    return [
      `docker ps --filter name=${containerName}`,
      `docker logs --tail 100 ${containerName}`
    ];
  }
  if (finding.id === 'logs.error-burst') {
    return [
      'journalctl -p err --since "1 hour ago"',
      'journalctl --since "1 hour ago" | tail -n 200'
    ];
  }
  if (finding.id === 'logs.auth-failures') {
    return [
      'journalctl _COMM=sshd --since "1 hour ago"',
      'lastb | head'
    ];
  }
  if (finding.id === 'network.public-surface') {
    return [
      'ss -tulpen',
      'ufw status verbose'
    ];
  }
  if (finding.id === 'network.high-risk-public-ports') {
    return [
      'ss -tulpen | grep -E ":(22|3306|5432|6379|27017|9200)"',
      'iptables -S'
    ];
  }
  if (finding.id === 'network.unknown-public-listener') {
    return [
      'ss -tulpen',
      'lsof -i -P -n | grep LISTEN',
      'ps -eo pid,ppid,user,comm,args --sort=comm'
    ];
  }
  if (finding.id === 'performance.load-high') {
    return [
      'uptime',
      'ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head'
    ];
  }
  if (finding.id === 'performance.process-pressure') {
    return [
      'ps -eo pid,comm,rss,%mem --sort=-rss | head',
      'vmstat 1 5'
    ];
  }
  if (finding.id === 'performance.disk-io-pressure') {
    return [
      'iostat -dx 1 5',
      'iotop -oPa',
      'pidstat -d 1 5'
    ];
  }
  return ['journalctl -n 100'];
}

function compareFindings(left, right) {
  return (severityRank[right.severity] ?? 0) - (severityRank[left.severity] ?? 0)
    || left.category.localeCompare(right.category)
    || left.title.localeCompare(right.title);
}

function isUnknownListenerProcess(processName) {
  const value = String(processName ?? '').trim().toLowerCase();
  if (!value) return true;
  if (['-', '?', 'unknown', 'n/a', 'none', 'null'].includes(value)) return true;
  if (/^\d+$/.test(value)) return true;
  if (/^(tmp|debug|test|nc|socat)(-|$|\d)/.test(value)) return true;
  return false;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSettings(settings = {}) {
  return {
    thresholds: {
      cpuHigh: Number(settings.thresholds?.cpuHigh ?? 90),
      memoryHigh: Number(settings.thresholds?.memoryHigh ?? 85),
      diskCritical: Number(settings.thresholds?.diskCritical ?? 90),
      loadHigh: Number(settings.thresholds?.loadHigh ?? 4)
    },
    aiSummary: {
      enabled: Boolean(settings.aiSummary?.enabled),
      mode: settings.aiSummary?.mode ?? 'local-rule-summary'
    }
  };
}

function summarizeRecommendations(findings) {
  return findings.slice(0, 5).map((finding) => ({
    severity: finding.severity,
    title: finding.title,
    action: finding.recommendation
  }));
}

function buildRiskEventTimeline(snapshot, findings) {
  const logs = snapshot.logs ?? {};
  const highRiskPorts = snapshot.ports.filter((port) => {
    return port.exposure === 'public' && [22, 3306, 5432, 6379, 27017, 9200].includes(port.port);
  });
  const unknownPublicListeners = snapshot.ports.filter((port) => {
    return port.exposure === 'public' && isUnknownListenerProcess(port.process);
  });
  const events = [];

  if ((snapshot.securityEvents?.failedSshLogins10m ?? 0) > 0) {
    const failedLogins = snapshot.securityEvents.failedSshLogins10m;
    events.push(createRiskEvent({
      id: 'risk-event-ssh-failures',
      timestamp: offsetTime(snapshot.collectedAt, -10),
      window: 'last 10 minutes',
      category: 'security',
      severity: failedLogins >= 50 ? 'critical' : 'medium',
      source: 'ssh',
      title: 'SSH failure spike needs review',
      evidence: [`${failedLogins} failed SSH logins were observed.`],
      recommendation: 'Confirm source addresses, verify key-only access, and review rate limiting.',
      findingIds: matchingFindingIds(findings, ['security.ssh-bruteforce'])
    }));
  }

  if ((logs.authFailures1h ?? 0) > 0) {
    const failures = logs.authFailures1h;
    events.push(createRiskEvent({
      id: 'risk-event-auth-failures',
      timestamp: offsetTime(snapshot.collectedAt, -60),
      window: 'last hour',
      category: 'logs',
      severity: failures >= 100 ? 'high' : 'medium',
      source: 'auth logs',
      title: 'Authentication failure volume is elevated',
      evidence: [`${failures} authentication failures were observed.`],
      recommendation: 'Review authentication logs, source ranges, and recent account changes.',
      findingIds: matchingFindingIds(findings, ['logs.auth-failures'])
    }));
  }

  for (const connection of snapshot.securityEvents?.suspiciousConnections ?? []) {
    if ((connection.count ?? 0) > 0) {
      events.push(createRiskEvent({
        id: `risk-event-connection-spike-${eventIdSlug(connection.remoteAddress)}`,
        timestamp: offsetTime(snapshot.collectedAt, -30),
        window: 'last 30 minutes',
        category: 'security',
        severity: connection.count >= 25 ? 'high' : 'medium',
        source: connection.remoteAddress,
        title: 'Repeated remote connection pattern observed',
        evidence: [
          `${connection.remoteAddress} opened ${connection.count} connections to port ${connection.port}.`
        ],
        recommendation: 'Compare the source with allowlists, expected clients, CDN ranges, and access logs.',
        findingIds: matchingFindingIds(findings, [`security.connection-spike.${connection.remoteAddress}`])
      }));
    }
  }

  if (highRiskPorts.length > 0) {
    events.push(createRiskEvent({
      id: 'risk-event-high-risk-public-ports',
      timestamp: snapshot.collectedAt,
      window: 'latest snapshot',
      category: 'network',
      severity: 'high',
      source: 'firewall',
      title: 'High-risk public listener exposure observed',
      evidence: highRiskPorts.map((port) => `${port.protocol}/${port.port} ${port.process} is public.`),
      recommendation: 'Move infrastructure listeners behind private networking, VPN, or a bastion host.',
      findingIds: matchingFindingIds(findings, ['network.high-risk-public-ports', 'ecosystem.public-database'])
    }));
  }

  if (unknownPublicListeners.length > 0) {
    events.push(createRiskEvent({
      id: 'risk-event-unknown-public-listeners',
      timestamp: snapshot.collectedAt,
      window: 'latest snapshot',
      category: 'network',
      severity: 'medium',
      source: 'listener inventory',
      title: 'Unknown public listener ownership requires confirmation',
      evidence: unknownPublicListeners.map((port) => {
        return `${port.protocol}/${port.port} is public with process ${port.process || 'unknown'}.`;
      }),
      recommendation: 'Identify the owning process and close or firewall listeners without a business owner.',
      findingIds: matchingFindingIds(findings, ['network.unknown-public-listener'])
    }));
  }

  if ((logs.errorCount1h ?? 0) > 0) {
    const errors = logs.errorCount1h;
    events.push(createRiskEvent({
      id: 'risk-event-error-burst',
      timestamp: offsetTime(snapshot.collectedAt, -60),
      window: 'last hour',
      category: 'logs',
      severity: errors >= 20 ? 'medium' : 'low',
      source: 'system logs',
      title: 'Error log volume is elevated',
      evidence: [`${errors} error log entries were observed.`],
      recommendation: 'Group recent errors by service and compare with deployments or dependency changes.',
      findingIds: matchingFindingIds(findings, ['logs.error-burst'])
    }));
  }

  const sortedEvents = events.sort(compareRiskEvents);
  const summary = sortedEvents.reduce((counts, event) => {
    counts.total += 1;
    counts[event.severity] += 1;
    return counts;
  }, { total: 0, critical: 0, high: 0, medium: 0, low: 0 });

  return {
    mode: 'local-evidence-timeline',
    generatedAt: new Date().toISOString(),
    summary,
    events: sortedEvents
  };
}

function buildSecuritySourceReview(snapshot, findings) {
  const sources = [];
  const failedLogins = snapshot.securityEvents?.failedSshLogins10m ?? 0;
  const authFailures = snapshot.logs?.authFailures1h ?? 0;

  if (failedLogins > 0 || authFailures > 0) {
    const severity = failedLogins >= 50 || authFailures >= 100 ? 'critical' : 'medium';
    sources.push(createSecuritySource({
      id: 'security-source-ssh-auth',
      remoteAddress: 'ssh-auth-sources',
      label: 'SSH/auth source review',
      severity,
      ports: [22],
      signals: [
        `${failedLogins} failed SSH logins in the last 10 minutes`,
        `${authFailures} authentication failures in the last hour`
      ],
      evidence: [
        'Authentication failure counts are aggregated from authorized local telemetry.',
        'Review auth logs to identify source addresses before changing firewall policy.'
      ],
      recommendation: 'Review source addresses in auth logs, confirm key-only access, and tune rate limiting or fail2ban rules.'
    }));
  }

  for (const connection of snapshot.securityEvents?.suspiciousConnections ?? []) {
    const count = connection.count ?? 0;
    if (count <= 0) continue;
    const severity = count >= 25 ? 'high' : 'medium';
    sources.push(createSecuritySource({
      id: `security-source-${eventIdSlug(connection.remoteAddress)}-${connection.port}`,
      remoteAddress: connection.remoteAddress,
      label: connection.remoteAddress,
      severity,
      ports: [connection.port],
      signals: [`${count} repeated connections to port ${connection.port}`],
      evidence: [
        `${connection.remoteAddress} opened ${count} connections to port ${connection.port}.`
      ],
      recommendation: 'Compare this source with allowlists, CDN ranges, expected clients, and access logs before blocking.'
    }));
  }

  const sortedSources = sources.sort((a, b) => {
    return (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0) ||
      b.signals.length - a.signals.length ||
      a.remoteAddress.localeCompare(b.remoteAddress);
  });
  const summary = sortedSources.reduce((counts, source) => {
    counts.totalSources += 1;
    counts[source.severity] += 1;
    if (['critical', 'high'].includes(source.severity)) counts.highRisk += 1;
    return counts;
  }, { totalSources: 0, critical: 0, high: 0, medium: 0, low: 0, highRisk: 0 });

  return {
    mode: 'local-security-source-review',
    generatedAt: new Date().toISOString(),
    summary,
    sources: sortedSources,
    boundary: 'Source review uses collected authentication counts and connection summaries only; it does not attribute activity, scan networks, enrich IPs, block traffic, or modify servers.',
    relatedFindingIds: matchingFindingIds(findings, ['security.ssh-bruteforce', 'logs.auth-failures'])
  };
}

function createSecuritySource(input) {
  return {
    id: input.id,
    remoteAddress: input.remoteAddress,
    label: input.label,
    severity: input.severity,
    ports: [...new Set(input.ports.filter((port) => Number.isFinite(port)))],
    signals: input.signals.filter(Boolean),
    evidence: input.evidence.filter(Boolean),
    recommendation: input.recommendation
  };
}

function buildEvidenceAppendix(snapshot, findings) {
  const items = findings.map((finding, index) => ({
    id: `evidence-${index + 1}-${slug(finding.id)}`,
    findingId: finding.id,
    category: finding.category,
    severity: finding.severity,
    source: evidenceSourceForFinding(finding, snapshot),
    title: finding.title,
    evidence: sanitizeEvidenceList(finding.evidence),
    recommendation: finding.recommendation,
    commands: (finding.commands ?? []).slice(0, 4),
    redaction: 'safe-summary'
  }));
  const commandCount = items.reduce((total, item) => total + item.commands.length, 0);

  return {
    mode: 'local-redacted-evidence',
    generatedAt: new Date().toISOString(),
    redaction: {
      policy: 'metadata-and-rule-evidence-only',
      note: 'Passwords, private keys, raw logs, and secret values are not included in the evidence appendix.'
    },
    summary: {
      totalItems: items.length,
      commandCount,
      categories: [...new Set(items.map((item) => item.category))]
    },
    items
  };
}

function evidenceSourceForFinding(finding, snapshot) {
  if (finding.category === 'security') return 'securityEvents';
  if (finding.category === 'logs') return 'logs';
  if (finding.category === 'network') return 'ports';
  if (finding.category === 'ecosystem') {
    return finding.id.includes('container') ? 'containers' : 'ports/services';
  }
  if (finding.category === 'runtime') return 'services/resources';
  if (finding.category === 'performance' || finding.category === 'health') return 'system/resources';
  return snapshot.id;
}

function sanitizeEvidenceList(evidence = []) {
  return evidence.map((item) => {
    return String(item)
      .replace(/password\s*[:=]\s*\S+/gi, 'password=[redacted]')
      .replace(/private\s+key\s*[:=]\s*\S+/gi, 'private key=[redacted]')
      .replace(/-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----/gi, '[redacted private key]');
  });
}

function createRiskEvent(event) {
  return {
    ...event,
    evidence: event.evidence.filter(Boolean),
    findingIds: event.findingIds.filter(Boolean)
  };
}

function matchingFindingIds(findings, ids) {
  return findings
    .filter((finding) => ids.some((id) => finding.id === id || finding.id.startsWith(id)))
    .map((finding) => finding.id);
}

function compareRiskEvents(left, right) {
  return (severityRank[right.severity] ?? 0) - (severityRank[left.severity] ?? 0)
    || new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
    || left.title.localeCompare(right.title);
}

function offsetTime(value, minutes) {
  return new Date(new Date(value).getTime() + minutes * 60_000).toISOString();
}

function eventIdSlug(value) {
  return String(value ?? 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}

function buildRemediationPlan(findings) {
  const phaseDefinitions = [
    {
      id: 'contain',
      label: 'Contain exposure',
      intent: 'Reduce immediate security and availability risk before deeper changes.'
    },
    {
      id: 'stabilize',
      label: 'Stabilize service',
      intent: 'Restore reliable runtime behavior and protect capacity headroom.'
    },
    {
      id: 'investigate',
      label: 'Investigate evidence',
      intent: 'Review telemetry and confirm ownership before permanent changes.'
    },
    {
      id: 'prevent',
      label: 'Prevent recurrence',
      intent: 'Turn one-off fixes into operating controls and follow-up checks.'
    }
  ];
  const phases = phaseDefinitions.map((definition) => ({ ...definition, items: [] }));

  findings.slice(0, 12).forEach((finding, index) => {
    const phase = phases.find((item) => item.id === remediationPhaseForFinding(finding));
    phase.items.push({
      id: `remediation-${index + 1}-${slug(finding.id)}`,
      findingId: finding.id,
      severity: finding.severity,
      category: finding.category,
      title: finding.title,
      action: finding.recommendation,
      owner: ownerForFinding(finding),
      evidence: finding.evidence.slice(0, 2),
      commands: (finding.commands ?? []).slice(0, 3),
      acceptance: acceptanceForFinding(finding)
    });
  });

  return {
    mode: 'local-rule-checklist',
    generatedAt: new Date().toISOString(),
    totalActions: phases.reduce((total, phase) => total + phase.items.length, 0),
    phases
  };
}

function remediationPhaseForFinding(finding) {
  if (finding.severity === 'critical') return 'contain';
  if (finding.category === 'security') return 'contain';
  if (finding.id === 'ecosystem.public-database' || finding.id === 'network.unknown-public-listener') {
    return 'contain';
  }
  if (['health', 'runtime', 'performance'].includes(finding.category) && ['high', 'medium'].includes(finding.severity)) {
    return 'stabilize';
  }
  if (finding.severity === 'low') return 'prevent';
  return 'investigate';
}

function ownerForFinding(finding) {
  if (finding.category === 'security' || finding.category === 'network') return 'Operations / Security';
  if (finding.category === 'runtime' || finding.category === 'ecosystem') return 'Service Owner / Operations';
  if (finding.category === 'performance' || finding.category === 'health') return 'Operations / Platform';
  return 'Operations';
}

function acceptanceForFinding(finding) {
  if (finding.category === 'security') {
    return 'Evidence reviewed, source or exposure decision recorded, and the next collection no longer shows the same high-risk signal.';
  }
  if (finding.category === 'network' || finding.category === 'ecosystem') {
    return 'Listener ownership is documented, intended exposure is confirmed, and service catalog risk is reduced or explicitly accepted.';
  }
  if (finding.category === 'runtime') {
    return 'Service state is running or intentionally disabled, with recent logs showing no repeated failures.';
  }
  if (finding.category === 'performance' || finding.category === 'health') {
    return 'Resource pressure returns below threshold in fresh telemetry evidence after the change window.';
  }
  return 'Finding evidence is reviewed and the follow-up analysis records the expected state.';
}

function buildExecutiveSummary(snapshot, findings, recommendations, score, analysisScope, modulesRun) {
  const counts = countFindingsBySeverity(findings);
  const topFindings = findings.slice(0, 4);
  const criticalPhrase = counts.critical > 0
    ? `${counts.critical} critical`
    : counts.high > 0
      ? `${counts.high} high-risk`
      : `${findings.length} total`;
  const hostname = snapshot.system.hostname;

  return {
    mode: 'local-rule-summary',
    generatedAt: new Date().toISOString(),
    headline: `${hostname} needs ${score < 85 ? 'operator review' : 'routine monitoring'}: ${criticalPhrase} finding${criticalPhrase.startsWith('1 ') ? '' : 's'} detected.`,
    overview: [
      `${hostname} scored ${score}/100 after running ${modulesRun.length} module${modulesRun.length === 1 ? '' : 's'} at ${analysisScope.depth} depth.`,
      `The strongest signals are ${topFindings.map((finding) => finding.title.toLowerCase()).join('; ') || 'within normal operating thresholds'}.`,
      'This summary is generated locally from collected telemetry and rule evidence; no external AI service is called.'
    ].join(' '),
    keyRisks: topFindings.map((finding) => ({
      severity: finding.severity,
      title: finding.title,
      category: finding.category,
      evidence: finding.evidence[0] ?? 'No evidence recorded.'
    })),
    nextActions: recommendations.slice(0, 4).map((item) => item.action),
    evidence: [
      `${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low findings.`,
      `Analysis scope: ${analysisScope.depth} / ${analysisScope.timeRange}.`,
      `Open ports: ${snapshot.ports.length}; services: ${snapshot.services.length}; containers: ${snapshot.containers.length}.`
    ]
  };
}

function countFindingsBySeverity(findings) {
  return findings.reduce((counts, finding) => {
    counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
    return counts;
  }, {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  });
}

const TREND_MIN_POINTS = 3;
const TREND_MAX_POINTS = 48;

// Honest trend series built from real collected snapshot history.
// When fewer than TREND_MIN_POINTS snapshots exist, the series still carries the
// real points collected so far and an explicit `status: 'insufficient-history'`
// flag so the UI can show a "collect more" placeholder instead of a fabricated
// curve. No synthetic/sine-wave data is generated in this build.
function buildTrends(snapshot, history = []) {
  const ordered = [...history]
    .filter((entry) => entry && entry.resources)
    .sort((left, right) => String(left.collectedAt).localeCompare(String(right.collectedAt)));
  if (!ordered.some((entry) => entry.id === snapshot.id)) {
    ordered.push(snapshot);
  }
  const series = ordered.slice(-TREND_MAX_POINTS);
  const dataPoints = series.length;
  const diskIoValue = (entry) => Math.min(100, ((entry.resources.diskReadMbps ?? 0) + (entry.resources.diskWriteMbps ?? 0)) / 4);
  const networkValue = (entry) => Math.min(100, ((entry.resources.networkRxMbps ?? 0) + (entry.resources.networkTxMbps ?? 0)) / 4);

  return {
    mode: 'local-snapshot-history',
    status: dataPoints >= TREND_MIN_POINTS ? 'ready' : 'insufficient-history',
    dataPoints,
    minPoints: TREND_MIN_POINTS,
    collectedAt: series.map((entry) => entry.collectedAt),
    cpu: series.map((entry) => clamp(Math.round(entry.resources.cpuPercent ?? 0), 0, 100)),
    memory: series.map((entry) => clamp(Math.round(entry.resources.memoryPercent ?? 0), 0, 100)),
    disk: series.map((entry) => clamp(Math.round(entry.resources.diskPercent ?? 0), 0, 100)),
    diskIo: series.map((entry) => clamp(Math.round(diskIoValue(entry)), 0, 100)),
    network: series.map((entry) => clamp(Math.round(networkValue(entry)), 0, 100))
  };
}

function buildServiceTopology(snapshot, findings) {
  const root = {
    id: `server-${slug(snapshot.system.hostname)}`,
    kind: 'server',
    label: snapshot.system.hostname,
    status: 'observed'
  };
  const nodes = [root];
  const edges = [];
  const risks = [];

  for (const service of snapshot.services) {
    const node = {
      id: `service-${slug(service.name)}`,
      kind: 'service',
      label: service.name,
      status: service.status
    };
    nodes.push(node);
    edges.push({ from: root.id, to: node.id, label: 'runs service' });
    if (service.status !== 'running') {
      risks.push({
        nodeId: node.id,
        severity: service.status === 'stopped' ? 'high' : 'medium',
        title: `${service.name} is ${service.status}`
      });
    }
  }

  for (const port of snapshot.ports) {
    const node = {
      id: `port-${port.port}`,
      kind: 'port',
      label: `${port.protocol}/${port.port}`,
      status: port.exposure,
      owner: port.process
    };
    nodes.push(node);
    const owningService = findServiceForPort(port, snapshot.services);
    edges.push({
      from: owningService ? `service-${slug(owningService.name)}` : root.id,
      to: node.id,
      label: 'listens on'
    });
    if (port.exposure === 'public' && [22, 3306, 5432, 6379, 27017, 9200].includes(port.port)) {
      risks.push({
        nodeId: node.id,
        severity: [3306, 5432, 6379, 27017, 9200].includes(port.port) ? 'high' : 'medium',
        title: `${port.protocol}/${port.port} is public`
      });
    }
  }

  for (const container of snapshot.containers) {
    const node = {
      id: `container-${slug(container.name)}`,
      kind: 'container',
      label: container.name,
      status: container.status,
      image: container.image
    };
    nodes.push(node);
    edges.push({ from: root.id, to: node.id, label: 'runs container' });
    if (container.status !== 'running' || container.restarts >= 3) {
      risks.push({
        nodeId: node.id,
        severity: 'medium',
        title: `${container.name} container is unstable`
      });
    }
  }

  for (const finding of findings) {
    const matchingNode = nodes.find((node) => {
      return finding.evidence.join(' ').toLowerCase().includes(node.label.toLowerCase())
        || (node.owner && finding.evidence.join(' ').toLowerCase().includes(node.owner.toLowerCase()));
    });
    if (matchingNode && !risks.some((risk) => risk.nodeId === matchingNode.id && risk.title === finding.title)) {
      risks.push({
        nodeId: matchingNode.id,
        severity: finding.severity,
        title: finding.title
      });
    }
  }

  return { root, nodes, edges, risks, map: buildTopologyMap(root, nodes, edges, risks) };
}

function buildTopologyMap(root, nodes, edges, risks) {
  const severityByNode = new Map();
  for (const risk of risks) {
    const current = severityByNode.get(risk.nodeId);
    if (!current || (severityRank[risk.severity] ?? 0) > (severityRank[current] ?? 0)) {
      severityByNode.set(risk.nodeId, risk.severity);
    }
  }

  const lanes = [
    { kind: 'server', x: 10 },
    { kind: 'service', x: 34 },
    { kind: 'port', x: 62 },
    { kind: 'container', x: 86 }
  ];
  const mapNodes = [];
  for (const lane of lanes) {
    const laneNodes = lane.kind === 'server'
      ? [root]
      : nodes.filter((node) => node.kind === lane.kind);
    const spacing = laneNodes.length <= 1 ? 0 : 72 / (laneNodes.length - 1);
    laneNodes.forEach((node, index) => {
      mapNodes.push({
        id: node.id,
        kind: node.kind,
        label: node.label,
        status: node.status,
        x: lane.x,
        y: laneNodes.length <= 1 ? 50 : 14 + spacing * index,
        severity: severityByNode.get(node.id) ?? 'low'
      });
    });
  }

  return {
    mode: 'local-service-topology-map',
    nodes: mapNodes,
    edges: edges.filter((edge) => {
      return mapNodes.some((node) => node.id === edge.from) && mapNodes.some((node) => node.id === edge.to);
    }),
    legend: ['server', 'service', 'port', 'container']
  };
}

function buildServiceCatalog(snapshot, findings) {
  const entries = new Map();

  for (const service of snapshot.services) {
    const key = catalogKey(service.name);
    entries.set(key, {
      id: `service-catalog-${slug(service.name)}`,
      name: service.name,
      role: inferServiceRole(service.name),
      health: normalizeCatalogHealth(service.status),
      exposure: 'internal',
      ports: [],
      backing: [{ kind: 'service', name: service.name, status: service.status }],
      risks: [],
      recommendation: ''
    });
  }

  for (const port of snapshot.ports) {
    const service = findServiceForPort(port, snapshot.services);
    const key = service ? catalogKey(service.name) : catalogKey(port.process || `${port.protocol}-${port.port}`);
    const entry = entries.get(key) ?? {
      id: `service-catalog-${slug(port.process || `${port.protocol}-${port.port}`)}`,
      name: port.process || `${port.protocol}/${port.port}`,
      role: inferServiceRole(port.process, port.port),
      health: 'observed',
      exposure: 'internal',
      ports: [],
      backing: [],
      risks: [],
      recommendation: ''
    };

    entry.role = strongestRole(entry.role, inferServiceRole(port.process, port.port));
    entry.exposure = strongestExposure(entry.exposure, port.exposure);
    entry.ports.push({
      port: port.port,
      protocol: port.protocol,
      process: port.process,
      exposure: port.exposure
    });
    if (!entry.backing.some((item) => item.kind === 'listener' && item.port === port.port)) {
      entry.backing.push({
        kind: 'listener',
        name: port.process || 'unknown',
        status: port.exposure,
        port: port.port
      });
    }
    entries.set(key, entry);
  }

  for (const container of snapshot.containers) {
    const matchingKey = findCatalogKeyForContainer(container, entries);
    const key = matchingKey ?? catalogKey(container.name);
    const entry = entries.get(key) ?? {
      id: `service-catalog-${slug(container.name)}`,
      name: container.name,
      role: inferServiceRole(container.name),
      health: normalizeCatalogHealth(container.status),
      exposure: 'internal',
      ports: [],
      backing: [],
      risks: [],
      recommendation: ''
    };

    entry.role = strongestRole(entry.role, 'container-workload');
    entry.health = strongestHealth(entry.health, normalizeCatalogHealth(container.status));
    entry.backing.push({
      kind: 'container',
      name: container.name,
      status: container.status,
      image: container.image,
      restarts: container.restarts
    });
    if (container.status !== 'running' || container.restarts >= 3) {
      entry.risks.push({
        severity: 'medium',
        title: `${container.name} container is unstable`
      });
    }
    entries.set(key, entry);
  }

  for (const entry of entries.values()) {
    const matchedFindings = findings.filter((finding) => findingMatchesServiceCatalogEntry(finding, entry));
    for (const finding of matchedFindings) {
      if (!entry.risks.some((risk) => risk.title === finding.title)) {
        entry.risks.push({
          severity: finding.severity,
          title: finding.title
        });
      }
    }
    if (entry.risks.some((risk) => ['critical', 'high'].includes(risk.severity))) {
      entry.health = strongestHealth(entry.health, 'degraded');
    }
    entry.risks.sort(compareCatalogRisks);
    entry.recommendation = recommendForCatalogEntry(entry);
  }

  return [...entries.values()].sort(compareCatalogEntries);
}

function inferServiceRole(value, port) {
  const name = normalizeName(value);
  if ([3306, 5432, 27017, 9200].includes(port) || /mysql|mysqld|mariadb|postgres|postgresql|mongo|elastic/.test(name)) {
    return 'database';
  }
  if ([6379, 11211].includes(port) || /redis|memcached|cache/.test(name)) {
    return 'cache';
  }
  if ([80, 443, 8080, 8443].includes(port) || /nginx|apache|httpd|caddy|traefik|haproxy/.test(name)) {
    return 'web-proxy';
  }
  if (port === 22 || /sshd|ssh/.test(name)) {
    return 'remote-access';
  }
  if (/node|api|app|server|pm2|gunicorn|uwsgi|java|dotnet|worker|queue|job/.test(name)) {
    return 'application';
  }
  return 'service';
}

function strongestRole(current, candidate) {
  const rank = {
    database: 6,
    cache: 5,
    'web-proxy': 4,
    application: 3,
    'remote-access': 2,
    'container-workload': 1,
    service: 0
  };
  return (rank[candidate] ?? 0) > (rank[current] ?? 0) ? candidate : current;
}

function normalizeCatalogHealth(status) {
  if (status === 'running') return 'running';
  if (['degraded', 'restarting', 'stopped', 'failed'].includes(status)) return 'degraded';
  return status || 'observed';
}

function strongestHealth(current, candidate) {
  const rank = {
    degraded: 3,
    stopped: 3,
    failed: 3,
    observed: 2,
    running: 1,
    unknown: 0
  };
  return (rank[candidate] ?? 0) > (rank[current] ?? 0) ? candidate : current;
}

function strongestExposure(current, candidate) {
  const rank = { public: 3, private: 2, internal: 1 };
  return (rank[candidate] ?? 0) > (rank[current] ?? 0) ? candidate : current;
}

function findCatalogKeyForContainer(container, entries) {
  const containerName = normalizeName(container.name);
  return [...entries.entries()].find(([, entry]) => {
    const entryName = normalizeName(entry.name);
    return entryName.includes(containerName) || containerName.includes(entryName);
  })?.[0] ?? null;
}

function findingMatchesServiceCatalogEntry(finding, entry) {
  const haystack = [
    finding.title,
    finding.category,
    ...(finding.evidence ?? []),
    finding.recommendation
  ].join(' ').toLowerCase();
  const names = [
    entry.name,
    entry.role,
    ...entry.ports.map((port) => `${port.protocol}/${port.port} ${port.process}`),
    ...entry.backing.map((item) => `${item.kind} ${item.name} ${item.port ?? ''}`)
  ].map((value) => String(value ?? '').toLowerCase());
  return names.some((name) => name && haystack.includes(name));
}

function recommendForCatalogEntry(entry) {
  if (entry.exposure === 'public' && ['database', 'cache'].includes(entry.role)) {
    return 'Move this infrastructure service behind private network access and restrict the listener with firewall policy.';
  }
  if (entry.role === 'remote-access' && entry.exposure === 'public') {
    return 'Keep remote access behind a bastion or allowlist and verify key-only authentication.';
  }
  if (entry.health === 'degraded') {
    return 'Inspect the owning service logs, recent deployments, and container health checks before restarting.';
  }
  if (entry.exposure === 'public') {
    return 'Confirm the public listener has an owner, TLS posture, rate limiting, and monitoring coverage.';
  }
  return 'Keep ownership, health checks, and dependency notes current for this service.';
}

function compareCatalogRisks(left, right) {
  return (severityRank[right.severity] ?? 0) - (severityRank[left.severity] ?? 0)
    || left.title.localeCompare(right.title);
}

function compareCatalogEntries(left, right) {
  const exposureRank = { public: 3, private: 2, internal: 1 };
  const healthRank = { degraded: 2, observed: 1, running: 0 };
  return (exposureRank[right.exposure] ?? 0) - (exposureRank[left.exposure] ?? 0)
    || (healthRank[right.health] ?? 0) - (healthRank[left.health] ?? 0)
    || left.role.localeCompare(right.role)
    || left.name.localeCompare(right.name);
}

function findServiceForPort(port, services) {
  const processName = normalizeName(port.process);
  return services.find((service) => {
    const serviceName = normalizeName(service.name);
    return processName.includes(serviceName) || serviceName.includes(processName);
  }) ?? null;
}

function normalizeName(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function catalogKey(value) {
  return normalizeName(value) || 'unknown';
}

function slug(value) {
  return normalizeName(value) || 'unknown';
}

function cryptoId() {
  return randomUUID();
}
