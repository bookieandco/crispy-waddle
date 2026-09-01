import { describe, expect, it } from 'vitest';
import { EgressPolicy, JHADINA_DEFAULT_EGRESS_RULES } from './egress-policy';

const base = {
  requestId: 'r1', actorId: 'user-1', capability: 'research.run',
  issuedAt: Date.now(), expiresAt: Date.now() + 10_000,
  dataClass: 'public' as const,
};

describe('EgressPolicy', () => {
  it('allows an exact HTTPS allowlisted destination', async () => {
    const result = await new EgressPolicy(JHADINA_DEFAULT_EGRESS_RULES).authorize({ ...base, destination: 'https://api.github.com/repos' });
    expect(result.decision).toBe('allow');
  });

  it.each([
    'http://127.0.0.1:8080/',
    'http://localhost/',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'http://[::1]/',
    'http://[fc00::1]/',
    'http://[fe80::1]/',
  ])('denies private or local destination %s', async (destination) => {
    const result = await new EgressPolicy([{ ...JHADINA_DEFAULT_EGRESS_RULES[0], hosts: ['127.0.0.1', 'localhost', '169.254.169.254', '10.0.0.1', '192.168.1.1', '172.16.0.1', '::1', 'fc00::1', 'fe80::1'] }]).authorize({ ...base, destination });
    expect(result.decision).toBe('deny');
  });

  it('denies userinfo destination tricks', async () => {
    const result = await new EgressPolicy(JHADINA_DEFAULT_EGRESS_RULES).authorize({ ...base, destination: 'https://api.github.com@127.0.0.1/' });
    expect(result.decision).toBe('deny');
  });

  it('denies non-HTTPS and non-allowlisted ports', async () => {
    const http = await new EgressPolicy([{ capability: 'research.run', hosts: ['api.github.com'], protocols: ['https'], ports: [443] }]).authorize({ ...base, destination: 'http://api.github.com/' });
    const port = await new EgressPolicy([{ capability: 'research.run', hosts: ['api.github.com'], protocols: ['https'], ports: [443] }]).authorize({ ...base, destination: 'https://api.github.com:8443/' });
    expect(http.decision).toBe('deny');
    expect(port.decision).toBe('deny');
  });

  it('denies secret data and oversized payloads', async () => {
    const policy = new EgressPolicy([{ ...JHADINA_DEFAULT_EGRESS_RULES[0], maxPayloadBytes: 10 }]);
    expect((await policy.authorize({ ...base, destination: 'https://api.github.com/', dataClass: 'secret' })).decision).toBe('deny');
    expect((await policy.authorize({ ...base, destination: 'https://api.github.com/', payloadBytes: 11 })).decision).toBe('deny');
  });

  it('fails closed when DNS resolves to a private address', async () => {
    const policy = new EgressPolicy(JHADINA_DEFAULT_EGRESS_RULES, { resolve: async () => ['10.1.2.3'] });
    const result = await policy.authorize({ ...base, destination: 'https://api.github.com/' });
    expect(result.decision).toBe('deny');
  });

  it('fails closed on resolver errors', async () => {
    const policy = new EgressPolicy(JHADINA_DEFAULT_EGRESS_RULES, { resolve: async () => { throw new Error('dns down'); } });
    const result = await policy.authorize({ ...base, destination: 'https://api.github.com/' });
    expect(result.decision).toBe('deny');
  });
});
