import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSnapshot, createDemoSnapshot, collectSnapshotForServerAsync } from '../src/server/collector.js';

test('normalizeSnapshot clamps percentages and fills required collections', () => {
  const snapshot = normalizeSnapshot({
    serverId: 'server-1',
    system: { hostname: 'example', platform: 'linux' },
    resources: {
      cpuPercent: 124,
      memoryPercent: -4,
      diskPercent: 81,
      diskReadMbps: 41.8,
      diskWriteMbps: 128.2,
      ioWaitPercent: 17.6
    },
    ports: undefined,
    services: [{ name: 'nginx', status: 'running' }]
  });

  assert.equal(snapshot.resources.cpuPercent, 100);
  assert.equal(snapshot.resources.memoryPercent, 0);
  assert.equal(snapshot.resources.diskPercent, 81);
  assert.equal(snapshot.resources.diskReadMbps, 42);
  assert.equal(snapshot.resources.diskWriteMbps, 128);
  assert.equal(snapshot.resources.ioWaitPercent, 18);
  assert.deepEqual(snapshot.ports, []);
  assert.deepEqual(snapshot.containers, []);
  assert.equal(snapshot.firewall.enabled, false);
  assert.equal(snapshot.firewall.defaultPolicy, 'unknown');
  assert.deepEqual(snapshot.firewall.allowedPublicPorts, []);
  assert.equal(snapshot.securityEvents.failedSshLogins10m, 0);
  assert.ok(snapshot.id.startsWith('snapshot-'));
  assert.ok(snapshot.collectedAt.endsWith('Z'));
});

test('createDemoSnapshot returns realistic data for local delivery demos', () => {
  const snapshot = createDemoSnapshot('demo-server');

  assert.equal(snapshot.serverId, 'demo-server');
  assert.ok(snapshot.system.hostname.length > 0);
  assert.ok(snapshot.ports.length >= 3);
  assert.ok(snapshot.services.length >= 3);
  assert.ok(snapshot.containers.length >= 2);
  assert.ok(snapshot.resources.diskReadMbps >= 0);
  assert.ok(snapshot.resources.diskWriteMbps >= 0);
  assert.ok(snapshot.resources.ioWaitPercent >= 0);
  assert.equal(snapshot.firewall.enabled, true);
  assert.ok(snapshot.firewall.allowedPublicPorts.includes(443));
  assert.ok(snapshot.firewall.exposedHighRiskPorts.includes(3306));
});

test('collectSnapshotForServerAsync parses authorized SSH telemetry from an injected runner', async () => {
  const snapshot = await collectSnapshotForServerAsync({
    id: 'server-ssh',
    mode: 'ssh',
    host: 'edge.example.local',
    port: 2222,
    username: 'ops',
    authType: 'agent'
  }, {
    runner: async (args) => {
      assert.ok(args.includes('ops@edge.example.local'));
      assert.ok(args.includes('2222'));
      return {
        stdout: `
__SERVERLENS_META__
hostname=edge-ssh-01
platform=linux
uptimeSeconds=12345
loadAverage=0.2 0.4 0.5
cpuPercent=12
memoryPercent=44
diskPercent=71
diskReadMbps=12
diskWriteMbps=96
ioWaitPercent=14
networkRxMbps=0
networkTxMbps=0
firewallEnabled=true
firewallDefaultPolicy=deny-inbound
errorCount1h=2
authFailures1h=9
failedSshLogins10m=3
__SERVERLENS_PORTS__
tcp LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=88,fd=3))
tcp LISTEN 0 128 127.0.0.1:6379 0.0.0.0:* users:(("redis",pid=89,fd=3))
tcp LISTEN 0 128 0.0.0.0:3306 0.0.0.0:* users:(("mysqld",pid=90,fd=3))
__SERVERLENS_CONNECTIONS__
ESTAB 0 0 10.0.0.5:22 203.0.113.77:51122
ESTAB 0 0 10.0.0.5:22 203.0.113.77:51123
ESTAB 0 0 10.0.0.5:443 198.51.100.12:53340
__SERVERLENS_SERVICES__
nginx.service loaded active running nginx
mysql.service loaded failed failed mysql
__SERVERLENS_CONTAINERS__
api|server-api:latest|running|Up 2 hours
worker|worker:latest|restarting|Restarting (1) 10 seconds ago
__SERVERLENS_PROCESSES__
123 nginx 2.3 10240 1-02:00:00
__SERVERLENS_LOGS__
Jun 06 warning nginx test
`
      };
    }
  });

  assert.equal(snapshot.serverId, 'server-ssh');
  assert.equal(snapshot.system.hostname, 'edge-ssh-01');
  assert.equal(snapshot.resources.memoryPercent, 44);
  assert.equal(snapshot.resources.diskReadMbps, 12);
  assert.equal(snapshot.resources.diskWriteMbps, 96);
  assert.equal(snapshot.resources.ioWaitPercent, 14);
  assert.equal(snapshot.firewall.enabled, true);
  assert.ok(snapshot.firewall.allowedPublicPorts.includes(22));
  assert.ok(snapshot.firewall.exposedHighRiskPorts.includes(3306));
  assert.equal(snapshot.ports.find((port) => port.port === 6379).exposure, 'private');
  assert.equal(snapshot.services.find((service) => service.name === 'mysql').status, 'failed');
  assert.equal(snapshot.containers.find((container) => container.name === 'worker').restarts, 1);
  assert.equal(snapshot.logs.authFailures1h, 9);
  assert.equal(snapshot.securityEvents.failedSshLogins10m, 3);
  assert.deepEqual(snapshot.securityEvents.suspiciousConnections, [
    { remoteAddress: '203.0.113.77', port: 22, count: 2 },
    { remoteAddress: '198.51.100.12', port: 443, count: 1 }
  ]);
});
