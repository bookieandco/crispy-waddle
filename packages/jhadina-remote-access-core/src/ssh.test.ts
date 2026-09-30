import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSshEndpoint, type SshEndpoint } from './ssh.js';

test('SSH endpoint validation requires SSH protocol and credentials identity only', () => {
  const endpoint: SshEndpoint = {
    id: 'server-1',
    protocol: 'ssh',
    host: 'server.example.internal',
    port: 22,
    username: 'jhadina',
  };
  assert.deepEqual(validateSshEndpoint(endpoint), endpoint);
});

test('SSH endpoint validation rejects invalid ports', () => {
  const endpoint = {
    id: 'server-1', protocol: 'ssh' as const, host: 'server.example.internal', port: 0, username: 'jhadina',
  };
  assert.throws(() => validateSshEndpoint(endpoint), /port must be between 1 and 65535/);
});

test('SSH endpoint validation rejects missing username', () => {
  const endpoint = {
    id: 'server-1', protocol: 'ssh' as const, host: 'server.example.internal', port: 22,
  };
  assert.throws(() => validateSshEndpoint(endpoint), /username is required/);
});
