import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const highRiskPorts = new Set([21, 23, 3306, 5432, 6379, 9200, 11211, 27017]);

export function normalizeSnapshot(input) {
  const now = new Date().toISOString();
  return {
    id: input.id ?? `snapshot-${cryptoId()}`,
    serverId: input.serverId,
    collectedAt: input.collectedAt ?? now,
    system: {
      hostname: input.system?.hostname ?? 'unknown-host',
      platform: input.system?.platform ?? os.platform(),
      uptimeSeconds: Number(input.system?.uptimeSeconds ?? os.uptime()),
      loadAverage: Array.isArray(input.system?.loadAverage) ? input.system.loadAverage : [0, 0, 0]
    },
    resources: {
      cpuPercent: percent(input.resources?.cpuPercent),
      memoryPercent: percent(input.resources?.memoryPercent),
      diskPercent: percent(input.resources?.diskPercent),
      diskReadMbps: positiveNumber(input.resources?.diskReadMbps),
      diskWriteMbps: positiveNumber(input.resources?.diskWriteMbps),
      ioWaitPercent: percent(input.resources?.ioWaitPercent),
      networkRxMbps: positiveNumber(input.resources?.networkRxMbps),
      networkTxMbps: positiveNumber(input.resources?.networkTxMbps)
    },
    ports: Array.isArray(input.ports) ? input.ports : [],
    services: Array.isArray(input.services) ? input.services : [],
    containers: Array.isArray(input.containers) ? input.containers : [],
    firewall: {
      enabled: Boolean(input.firewall?.enabled),
      defaultPolicy: String(input.firewall?.defaultPolicy ?? 'unknown'),
      allowedPublicPorts: Array.isArray(input.firewall?.allowedPublicPorts) ? input.firewall.allowedPublicPorts : [],
      exposedHighRiskPorts: Array.isArray(input.firewall?.exposedHighRiskPorts) ? input.firewall.exposedHighRiskPorts : []
    },
    processes: Array.isArray(input.processes) ? input.processes : [],
    logs: {
      errorCount1h: positiveNumber(input.logs?.errorCount1h),
      authFailures1h: positiveNumber(input.logs?.authFailures1h),
      latest: Array.isArray(input.logs?.latest) ? input.logs.latest : []
    },
    securityEvents: {
      failedSshLogins10m: positiveNumber(input.securityEvents?.failedSshLogins10m),
      suspiciousConnections: Array.isArray(input.securityEvents?.suspiciousConnections)
        ? input.securityEvents.suspiciousConnections
        : []
    }
  };
}

export function createDemoSnapshot(serverId) {
  return normalizeSnapshot({
    serverId,
    system: {
      hostname: 'prod-edge-01',
      platform: 'linux',
      uptimeSeconds: 694220,
      loadAverage: [2.2, 2.5, 2.1]
    },
    resources: {
      cpuPercent: 76,
      memoryPercent: 68,
      diskPercent: 91,
      diskReadMbps: 38,
      diskWriteMbps: 118,
      ioWaitPercent: 13,
      networkRxMbps: 96,
      networkTxMbps: 142
    },
    ports: [
      { port: 22, protocol: 'tcp', process: 'sshd', exposure: 'public' },
      { port: 443, protocol: 'tcp', process: 'nginx', exposure: 'public' },
      { port: 3000, protocol: 'tcp', process: 'node', exposure: 'private' },
      { port: 3306, protocol: 'tcp', process: 'mysqld', exposure: 'public' },
      { port: 6379, protocol: 'tcp', process: 'redis', exposure: 'private' }
    ],
    services: [
      { name: 'nginx', status: 'running' },
      { name: 'mysql', status: 'degraded' },
      { name: 'redis', status: 'running' },
      { name: 'node-api', status: 'running' }
    ],
    containers: [
      { name: 'api', image: 'server-api:2026.06', status: 'running', restarts: 0 },
      { name: 'worker', image: 'jobs:2026.06', status: 'restarting', restarts: 5 },
      { name: 'collector', image: 'collector:stable', status: 'running', restarts: 1 }
    ],
    firewall: {
      enabled: true,
      defaultPolicy: 'deny-inbound',
      allowedPublicPorts: [22, 443],
      exposedHighRiskPorts: [3306]
    },
    processes: [
      { pid: 1587, name: 'nginx', cpuPercent: 2.3, memoryMb: 178.4, uptime: '12d' },
      { pid: 2468, name: 'node', cpuPercent: 5.1, memoryMb: 256.7, uptime: '7d' },
      { pid: 786, name: 'redis-server', cpuPercent: 1.2, memoryMb: 98.3, uptime: '12d' },
      { pid: 1234, name: 'sshd', cpuPercent: 0.8, memoryMb: 12.6, uptime: '23d' },
      { pid: 3072, name: 'dockerd', cpuPercent: 1.6, memoryMb: 67.2, uptime: '23d' }
    ],
    logs: {
      errorCount1h: 31,
      authFailures1h: 124,
      latest: [
        { time: '14:32:11', level: 'info', message: 'Collected CPU and memory telemetry.' },
        { time: '14:33:05', level: 'warn', message: 'Detected repeated SSH authentication failures.' },
        { time: '14:34:30', level: 'error', message: 'Worker container restarted during health check.' }
      ]
    },
    securityEvents: {
      failedSshLogins10m: 64,
      suspiciousConnections: [
        { remoteAddress: '203.0.113.77', port: 22, count: 38 },
        { remoteAddress: '198.51.100.12', port: 443, count: 12 }
      ]
    }
  });
}

export function collectSnapshotForServer(server) {
  if (server.mode === 'demo') {
    return createDemoSnapshot(server.id);
  }

  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  return normalizeSnapshot({
    serverId: server.id,
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      uptimeSeconds: os.uptime(),
      loadAverage: os.loadavg()
    },
    resources: {
      cpuPercent: estimateCpuPercent(),
      memoryPercent: ((totalMemory - freeMemory) / totalMemory) * 100,
      diskPercent: 0,
      diskReadMbps: 0,
      diskWriteMbps: 0,
      ioWaitPercent: 0,
      networkRxMbps: 0,
      networkTxMbps: 0
    },
    ports: [],
    services: [],
    containers: [],
    firewall: {
      enabled: false,
      defaultPolicy: 'unknown',
      allowedPublicPorts: [],
      exposedHighRiskPorts: []
    },
    processes: [],
    logs: {
      errorCount1h: 0,
      authFailures1h: 0,
      latest: []
    },
    securityEvents: {
      failedSshLogins10m: 0,
      suspiciousConnections: []
    }
  });
}

export async function collectSnapshotForServerAsync(server, options = {}) {
  if (server.mode === 'ssh') {
    return collectSshSnapshot(server, options);
  }
  return collectSnapshotForServer(server);
}

export async function collectSshSnapshot(server, options = {}) {
  const runner = options.runner ?? runSshCommand;
  const { stdout } = await runner(buildSshArgs(server), sshCollectionScript(), {
    timeoutMs: options.timeoutMs ?? 10000
  });
  return parseSshSnapshot(server, stdout);
}

function estimateCpuPercent() {
  const load = os.loadavg()[0] ?? 0;
  const cores = os.cpus().length || 1;
  return Math.round((load / cores) * 100);
}

async function runSshCommand(args, script, options = {}) {
  try {
    const result = await execFileAsync('ssh', [...args, 'sh', '-lc', script], {
      timeout: options.timeoutMs ?? 10000,
      maxBuffer: 1024 * 1024
    });
    return { stdout: result.stdout };
  } catch (error) {
    const wrapped = new Error(`SSH collection failed: ${error.stderr || error.message}`);
    wrapped.statusCode = 502;
    throw wrapped;
  }
}

export function buildSshArgs(server) {
  const host = safeSshHost(server.host);
  const username = safeSshUsername(server.username);
  const target = username ? `${username}@${host}` : host;
  const args = [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=5',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-p', String(server.port ?? 22)
  ];
  if (server.authType === 'ssh-key' && server.keyPath) {
    args.push('-i', safeSshKeyPath(server.keyPath));
  }
  args.push(target);
  return args;
}

function safeSshHost(value) {
  const host = String(value ?? '').trim();
  if (!host || host.startsWith('-') || /[\s@]/.test(host) || !/^[A-Za-z0-9._:-]+$/.test(host)) {
    throw validationError('SSH host must be an IP address or hostname without spaces.');
  }
  return host;
}

function safeSshUsername(value) {
  const username = String(value ?? '').trim();
  if (!username) return '';
  if (username.startsWith('-') || !/^[A-Za-z0-9._-]+$/.test(username)) {
    throw validationError('SSH username contains unsupported characters.');
  }
  return username;
}

function safeSshKeyPath(value) {
  const keyPath = String(value ?? '').trim();
  if (!keyPath || keyPath.startsWith('-') || /[\r\n]/.test(keyPath)) {
    throw validationError('SSH key path is invalid.');
  }
  return keyPath;
}

function sshCollectionScript() {
  return `
hostname_value=$(hostname 2>/dev/null || uname -n 2>/dev/null || echo unknown-host)
platform_value=$(uname -s 2>/dev/null | tr '[:upper:]' '[:lower:]' || echo linux)
uptime_value=$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo 0)
load_value=$(awk '{print $1" "$2" "$3}' /proc/loadavg 2>/dev/null || echo "0 0 0")
cpu_value=$(awk '{print int(($1*100)+0.5)}' /proc/loadavg 2>/dev/null || echo 0)
memory_value=$(free 2>/dev/null | awk '/Mem:/ { if ($2 > 0) printf("%d", (($2-$7)/$2)*100); else print 0 }' || echo 0)
disk_value=$(df -P / 2>/dev/null | awk 'NR==2 { gsub("%","",$5); print $5 }' || echo 0)
disk_read_value=0
disk_write_value=0
if command -v iostat >/dev/null 2>&1; then
  disk_io_values=$(iostat -dm 1 2 2>/dev/null | awk 'NF >= 4 && $1 !~ /Device|Linux|^$/ { read+=$3; write+=$4 } END { printf("%d %d", read, write) }')
  disk_read_value=$(echo "$disk_io_values" | awk '{print $1+0}')
  disk_write_value=$(echo "$disk_io_values" | awk '{print $2+0}')
fi
io_wait_value=0
if command -v vmstat >/dev/null 2>&1; then
  io_wait_value=$(vmstat 1 2 2>/dev/null | awk 'NR==4 {print int($16+0.5)}' || echo 0)
fi
errors_value=$(journalctl -p err --since "1 hour ago" --no-pager 2>/dev/null | wc -l | tr -d ' ' || echo 0)
auth_fail_1h=$(journalctl -u ssh -u sshd --since "1 hour ago" --no-pager 2>/dev/null | grep -Eic 'failed password|authentication failure' || echo 0)
auth_fail_10m=$(journalctl -u ssh -u sshd --since "10 minutes ago" --no-pager 2>/dev/null | grep -Eic 'failed password|authentication failure' || echo 0)
firewall_enabled=false
firewall_policy=unknown
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi active; then
  firewall_enabled=true
  firewall_policy=$(ufw status verbose 2>/dev/null | awk -F: '/Default:/ {print $2; exit}' | sed 's/^ *//;s/ *$//' || echo unknown)
elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state 2>/dev/null | grep -qi running; then
  firewall_enabled=true
  firewall_policy=firewalld-running
fi
echo __SERVERLENS_META__
echo "hostname=$hostname_value"
echo "platform=$platform_value"
echo "uptimeSeconds=$uptime_value"
echo "loadAverage=$load_value"
echo "cpuPercent=$cpu_value"
echo "memoryPercent=$memory_value"
echo "diskPercent=$disk_value"
echo "diskReadMbps=$disk_read_value"
echo "diskWriteMbps=$disk_write_value"
echo "ioWaitPercent=$io_wait_value"
echo "networkRxMbps=0"
echo "networkTxMbps=0"
echo "firewallEnabled=$firewall_enabled"
echo "firewallDefaultPolicy=$firewall_policy"
echo "errorCount1h=$errors_value"
echo "authFailures1h=$auth_fail_1h"
echo "failedSshLogins10m=$auth_fail_10m"
echo __SERVERLENS_PORTS__
ss -tulnp -H 2>/dev/null | head -n 40 || true
echo __SERVERLENS_CONNECTIONS__
ss -tanH state established 2>/dev/null | head -n 200 || true
echo __SERVERLENS_SERVICES__
systemctl list-units --type=service --state=running,failed --no-legend --no-pager 2>/dev/null | head -n 30 || true
echo __SERVERLENS_CONTAINERS__
docker ps -a --format '{{.Names}}|{{.Image}}|{{.State}}|{{.Status}}' 2>/dev/null | head -n 30 || true
echo __SERVERLENS_PROCESSES__
ps -eo pid=,comm=,%cpu=,rss=,etime= --sort=-%cpu 2>/dev/null | head -n 6 || true
echo __SERVERLENS_LOGS__
journalctl -p warning --since "1 hour ago" -n 5 --no-pager 2>/dev/null || true
`;
}

function parseSshSnapshot(server, stdout) {
  const sections = splitSections(stdout);
  const meta = parseMeta(sections.__SERVERLENS_META__);
  const ports = parsePorts(sections.__SERVERLENS_PORTS__);
  const publicPorts = ports.filter((port) => port.exposure === 'public').map((port) => port.port);
  return normalizeSnapshot({
    serverId: server.id,
    system: {
      hostname: meta.hostname ?? server.host,
      platform: meta.platform ?? 'linux',
      uptimeSeconds: numberFrom(meta.uptimeSeconds),
      loadAverage: String(meta.loadAverage ?? '0 0 0').split(/\s+/).map(Number).filter(Number.isFinite).slice(0, 3)
    },
    resources: {
      cpuPercent: numberFrom(meta.cpuPercent),
      memoryPercent: numberFrom(meta.memoryPercent),
      diskPercent: numberFrom(meta.diskPercent),
      diskReadMbps: numberFrom(meta.diskReadMbps),
      diskWriteMbps: numberFrom(meta.diskWriteMbps),
      ioWaitPercent: numberFrom(meta.ioWaitPercent),
      networkRxMbps: numberFrom(meta.networkRxMbps),
      networkTxMbps: numberFrom(meta.networkTxMbps)
    },
    ports,
    services: parseServices(sections.__SERVERLENS_SERVICES__),
    containers: parseContainers(sections.__SERVERLENS_CONTAINERS__),
    firewall: {
      enabled: String(meta.firewallEnabled).trim() === 'true',
      defaultPolicy: meta.firewallDefaultPolicy ?? 'unknown',
      allowedPublicPorts: [...new Set(publicPorts)].sort((left, right) => left - right),
      exposedHighRiskPorts: [...new Set(publicPorts.filter((port) => highRiskPorts.has(port)))].sort((left, right) => left - right)
    },
    processes: parseProcesses(sections.__SERVERLENS_PROCESSES__),
    logs: {
      errorCount1h: numberFrom(meta.errorCount1h),
      authFailures1h: numberFrom(meta.authFailures1h),
      latest: parseLogs(sections.__SERVERLENS_LOGS__)
    },
    securityEvents: {
      failedSshLogins10m: numberFrom(meta.failedSshLogins10m),
      suspiciousConnections: parseSuspiciousConnections(sections.__SERVERLENS_CONNECTIONS__)
    }
  });
}

function splitSections(stdout) {
  const sections = {};
  let current = null;
  for (const line of String(stdout ?? '').split(/\r?\n/)) {
    if (line.startsWith('__SERVERLENS_')) {
      current = line.trim();
      sections[current] = [];
    } else if (current) {
      sections[current].push(line);
    }
  }
  return sections;
}

function parseMeta(lines = []) {
  const meta = {};
  for (const line of lines) {
    const index = line.indexOf('=');
    if (index === -1) continue;
    meta[line.slice(0, index)] = line.slice(index + 1);
  }
  return meta;
}

function parsePorts(lines = []) {
  return lines.map((line) => {
    const fields = line.trim().split(/\s+/);
    const protocol = fields[0] ?? 'tcp';
    const local = fields.find((field) => /:\d+$/.test(field)) ?? '';
    const port = Number((local.match(/:(\d+)$/) ?? [])[1] ?? 0);
    const address = local.replace(/:\d+$/, '');
    const process = (line.match(/users:\(\("([^"]+)"/) ?? [])[1] ?? 'unknown';
    if (!port) return null;
    return {
      port,
      protocol,
      process,
      exposure: isPublicAddress(address) ? 'public' : 'private'
    };
  }).filter(Boolean);
}

function parseServices(lines = []) {
  return lines.map((line) => {
    const fields = line.trim().split(/\s+/);
    if (!fields[0]) return null;
    return {
      name: fields[0].replace(/\.service$/, ''),
      status: fields.includes('failed') ? 'failed' : 'running'
    };
  }).filter(Boolean);
}

function parseContainers(lines = []) {
  return lines.map((line) => {
    const [name, image, state, status] = line.split('|');
    if (!name) return null;
    return {
      name,
      image: image || 'unknown',
      status: state || status || 'unknown',
      restarts: /Restarting/i.test(status ?? '') ? 1 : 0
    };
  }).filter(Boolean);
}

function parseProcesses(lines = []) {
  return lines.map((line) => {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 4) return null;
    return {
      pid: Number(fields[0]),
      name: fields[1],
      cpuPercent: Number(fields[2]),
      memoryMb: Math.round(Number(fields[3]) / 1024),
      uptime: fields.slice(4).join(' ') || 'unknown'
    };
  }).filter((item) => item && Number.isFinite(item.pid));
}

function parseLogs(lines = []) {
  return lines.filter(Boolean).slice(0, 5).map((line) => ({
    time: 'remote',
    level: /error|failed/i.test(line) ? 'error' : 'warn',
    message: line.slice(0, 240)
  }));
}

function parseSuspiciousConnections(lines = []) {
  const groups = new Map();
  for (const line of lines) {
    const endpoints = line.trim().split(/\s+/).map(parseEndpoint).filter(Boolean);
    if (endpoints.length < 2) continue;
    const [local, remote] = endpoints;
    if (!local.port || !remote.address || isLoopbackAddress(remote.address)) continue;
    const key = `${remote.address}:${local.port}`;
    const current = groups.get(key) ?? { remoteAddress: remote.address, port: local.port, count: 0 };
    current.count += 1;
    groups.set(key, current);
  }
  return [...groups.values()]
    .sort((left, right) => right.count - left.count || left.port - right.port || left.remoteAddress.localeCompare(right.remoteAddress))
    .slice(0, 20);
}

function parseEndpoint(value) {
  const match = String(value ?? '').match(/^\[?(.+?)\]?:(\d+)$/);
  if (!match) return null;
  return {
    address: match[1].replace(/^::ffff:/, ''),
    port: Number(match[2])
  };
}

function isPublicAddress(address) {
  const value = String(address ?? '');
  return !['127.0.0.1', '::1', 'localhost'].includes(value) && !value.startsWith('127.');
}

function isLoopbackAddress(address) {
  const value = String(address ?? '').toLowerCase();
  return value === 'localhost' || value === '::1' || value.startsWith('127.') || value === '0.0.0.0' || value === '*';
}

function numberFrom(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function percent(value) {
  return Math.min(100, Math.max(0, Math.round(Number(value ?? 0))));
}

function positiveNumber(value) {
  return Math.max(0, Math.round(Number(value ?? 0)));
}

function cryptoId() {
  return randomUUID();
}
