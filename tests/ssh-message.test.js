import test from 'node:test';
import assert from 'node:assert/strict';

import { oneLine } from '../src/server/app.js';

test('oneLine skips the post-quantum warning and reports the real auth failure', () => {
  const stderr = [
    '** WARNING: connection is not using a post-quantum key exchange algorithm.',
    'liusonglin@192.168.1.45: Permission denied (publickey,password).'
  ].join('\n');
  const message = oneLine(stderr);
  assert.match(message, /Permission denied/);
  assert.doesNotMatch(message, /post-quantum/i);
  assert.doesNotMatch(message, /WARNING/i);
});

test('oneLine drops debug and banner noise lines', () => {
  const stderr = [
    'debug1: Reading configuration data /etc/ssh/ssh_config',
    'debug2: resolving "host"',
    'Banner: welcome to the server',
    'Permission denied (publickey).'
  ].join('\n');
  assert.equal(oneLine(stderr), 'Permission denied (publickey).');
});

test('oneLine prefers the meaningful line even when it is not first', () => {
  const stderr = [
    'Warning: Permanently added the host to known hosts.',
    'Connection timed out during banner exchange'
  ].join('\n');
  assert.match(oneLine(stderr), /timed out/i);
});

test('oneLine falls back to the first real line when nothing matches keywords', () => {
  assert.equal(oneLine('Some unexpected client message'), 'Some unexpected client message');
});

test('oneLine gives a safe default for empty stderr', () => {
  assert.match(oneLine(''), /SSH authentication failed/);
  assert.match(oneLine('** WARNING: connection is not using a post-quantum key exchange algorithm.'), /SSH authentication failed/);
});
