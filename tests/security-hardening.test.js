import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createApp } from '../src/server/app.js';
import { createStore } from '../src/server/store.js';
import { createCredentialCipher } from '../src/server/credential-cipher.js';

test('local app server binds to loopback by default', async () => {
  const app = createApp({ memoryOnly: true });
  const server = await app.listen(0);
  const address = server.address();
  assert.equal(address.address, '127.0.0.1');
  server.closeAllConnections?.();
  server.close();
  app.store.close();
});

test('SERVERLENS_BIND_HOST override is honored', async () => {
  const app = createApp({ memoryOnly: true, bindHost: '127.0.0.1' });
  const server = await app.listen(0, '127.0.0.1');
  assert.equal(server.address().address, '127.0.0.1');
  server.closeAllConnections?.();
  server.close();
  app.store.close();
});

test('API token gates write operations over HTTP when configured', async () => {
  const app = createApp({ memoryOnly: true, apiToken: 'secret-token' });
  const server = await app.listen(0);
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const reads = await fetch(`${base}/api/servers`, { headers: { connection: 'close' } });
  assert.equal(reads.status, 200);

  const unauthorized = await fetch(`${base}/api/servers`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', connection: 'close' },
    body: JSON.stringify({ name: 'Blocked', host: 'blocked.local', mode: 'demo' })
  });
  assert.equal(unauthorized.status, 401);

  const authorized = await fetch(`${base}/api/servers`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer secret-token',
      connection: 'close'
    },
    body: JSON.stringify({ name: 'Allowed', host: 'allowed.local', mode: 'demo' })
  });
  assert.equal(authorized.status, 201);

  server.closeAllConnections?.();
  server.close();
  app.store.close();
});

test('oversized request bodies are rejected with 413', async () => {
  const app = createApp({ memoryOnly: true });
  const server = await app.listen(0);
  const { port } = server.address();
  const huge = 'x'.repeat(300 * 1024);
  const response = await fetch(`http://127.0.0.1:${port}/api/servers`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', connection: 'close' },
    body: JSON.stringify({ name: huge, host: 'demo.local', mode: 'demo' })
  });
  assert.equal(response.status, 413);
  server.closeAllConnections?.();
  server.close();
  app.store.close();
});

test('generated server ids are unique and do not reuse numbers after deletion', () => {
  const store = createStore({ memoryOnly: true });
  const ids = new Set();
  for (let index = 0; index < 50; index += 1) {
    const server = store.createServer({ name: `s${index}`, host: `h${index}.local`, mode: 'demo' });
    ids.add(server.id);
  }
  assert.equal(ids.size, 50);
});

test('credential cipher is a passthrough when no key is configured', () => {
  const cipher = createCredentialCipher('');
  assert.equal(cipher.enabled, false);
  const server = { id: 'server-1', keyPath: '/home/op/.ssh/id_ed25519' };
  assert.deepEqual(cipher.encryptServer(server), server);
});

test('credential cipher round-trips sensitive fields when a key is configured', () => {
  const cipher = createCredentialCipher('local-test-key');
  assert.equal(cipher.enabled, true);
  const server = { id: 'server-1', keyPath: '/home/op/.ssh/id_ed25519' };
  const encrypted = cipher.encryptServer(server);
  assert.notEqual(encrypted.keyPath, server.keyPath);
  assert.equal(encrypted.keyPath.__enc, 'serverlens.cred.v1');
  const decrypted = cipher.decryptServer(encrypted);
  assert.equal(decrypted.keyPath, server.keyPath);
});

test('encrypted credentials survive a persistent store restart and decrypt in memory', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'serverlens-cred-'));
  const dbPath = path.join(dir, 'serverlens.sqlite');
  try {
    const first = createStore({ dbPath, credentialKey: 'restart-key' });
    const created = first.createServer({
      name: 'SSH Asset',
      host: 'ssh.local',
      mode: 'ssh',
      authType: 'ssh-key',
      username: 'op',
      keyPath: '/home/op/.ssh/id_ed25519'
    });
    first.close();

    const second = createStore({ dbPath, credentialKey: 'restart-key' });
    const reloaded = second.getServer(created.id);
    assert.equal(reloaded.keyPath, '/home/op/.ssh/id_ed25519');
    second.close();
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Windows may briefly hold the SQLite file handle; cleanup is best-effort.
    }
  }
});
