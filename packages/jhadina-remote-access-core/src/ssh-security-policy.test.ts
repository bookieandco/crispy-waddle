import { describe, expect, it } from 'vitest';
import { evaluateSshPolicy, type SshSecurityPolicy } from './ssh-security-policy.js';

const policy: SshSecurityPolicy = {
  allowedHosts: ['server.example'],
  allowedPorts: [22],
  requireHostKeyVerification: true,
  credentialRef: { id: 'cred-1' },
  allowedCommands: ['uname -a'],
};

describe('evaluateSshPolicy', () => {
  const base = { host: 'server.example', port: 22, credentialRef: { id: 'cred-1' }, hostKeyVerified: true };

  it('allows an authorized request', () => {
    expect(evaluateSshPolicy(policy, { ...base, command: 'uname -a' })).toEqual({ allowed: true });
  });

  it('denies an unauthorized host', () => {
    expect(evaluateSshPolicy(policy, { ...base, host: 'other.example' }).reason).toBe('host-not-allowed');
  });

  it('denies an unauthorized port', () => {
    expect(evaluateSshPolicy(policy, { ...base, port: 2222 }).reason).toBe('port-not-allowed');
  });

  it('denies missing or mismatched credentials', () => {
    expect(evaluateSshPolicy(policy, { ...base, credentialRef: { id: 'other' } }).reason).toBe('credential-required');
  });

  it('denies unverified host keys when required', () => {
    expect(evaluateSshPolicy(policy, { ...base, hostKeyVerified: false }).reason).toBe('host-key-unverified');
  });

  it('denies commands outside the allowlist', () => {
    expect(evaluateSshPolicy(policy, { ...base, command: 'rm -rf /' }).reason).toBe('command-not-allowed');
  });
});
