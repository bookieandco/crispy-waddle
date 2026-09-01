import { describe, expect, it } from 'vitest';
import { CredentialBroker, CredentialBrokerError, InMemoryCredentialStore, credentialGrantSafeAudit } from './credential-broker.js';
import { InMemoryCredentialLeaseStore } from './credential-lease-store.js';

const base = () => ({ requestId: 'req-1', actorId: 'actor-1', workerId: 'worker-1', workerTrust: 'trusted-compute' as const, capability: 'research.run', provider: 'research', credentialRef: 'research/webscout', purpose: 'approved research', resourceId: 'job-1', issuedAt: Date.now(), expiresAt: Date.now() + 10_000, nonce: 'nonce-1' });
const policy = { maxTtlMs: 60_000, providerCapabilities: { research: ['research.run'] }, allowedCredentialRefs: ['research/webscout'], maxUses: 1 };
function broker() { return new CredentialBroker(new InMemoryCredentialStore({ 'research/webscout': { secret: 'TOP-SECRET' } }), policy, Date.now, () => crypto.randomUUID(), new InMemoryCredentialLeaseStore()); }
async function expectCode(fn: () => Promise<unknown>, code: string) { await expect(fn).rejects.toMatchObject({ code }); }

describe('CredentialBroker', () => {
  it('issues a scoped grant without returning secret material', async () => { const grant = await broker().issue(base()); expect(grant).not.toHaveProperty('secret'); expect(JSON.stringify(grant)).not.toContain('TOP-SECRET'); expect(grant.maxUses).toBe(1); });
  it('rejects unknown credential references', async () => { await expectCode(() => broker().issue({ ...base(), credentialRef: 'money/arbitrary/master' }), 'CREDENTIAL_REF_DENIED'); });
  it('rejects provider/capability mismatch', async () => { await expectCode(() => broker().issue({ ...base(), provider: 'payments', capability: 'financial.execute' }), 'CAPABILITY_PROVIDER_MISMATCH'); });
  it('rejects untrusted workers', async () => { await expectCode(() => broker().issue({ ...base(), workerTrust: 'quarantined' as const }), 'WORKER_NOT_TRUSTED'); });
  it('requires a purpose and bounded lifetime', async () => { await expectCode(() => broker().issue({ ...base(), purpose: ' ' }), 'PURPOSE_REQUIRED'); await expectCode(() => broker().issue({ ...base(), expiresAt: Date.now() + 120_000 }), 'TTL_EXCEEDED'); });
  it('binds use to actor, worker, capability, provider, purpose and resource', async () => { const b = broker(); const grant = await b.issue(base()); await expectCode(() => b.use(grant, { ...base(), actorId: 'actor-2' }), 'ACTOR_MISMATCH'); await expectCode(() => b.use(grant, { ...base(), workerId: 'worker-2' }), 'WORKER_MISMATCH'); await expectCode(() => b.use(grant, { ...base(), purpose: 'different' }), 'PURPOSE_MISMATCH'); await expectCode(() => b.use(grant, { ...base(), resourceId: 'job-2' }), 'RESOURCE_MISMATCH'); });
  it('allows one use and rejects replay/second use', async () => { const b = broker(); const grant = await b.issue(base()); const material = await b.use(grant, base()); expect(material.secret).toBe('TOP-SECRET'); await expectCode(() => b.use(grant, base()), 'LEASE_EXHAUSTED'); });
  it('does not permit an in-memory broker without a lease store to use credentials', async () => { const b = new CredentialBroker(new InMemoryCredentialStore({ 'research/webscout': { secret: 'TOP-SECRET' } }), policy); const grant = await b.issue(base()); await expectCode(() => b.use(grant, base()), 'DURABLE_LEASE_STORE_REQUIRED'); });
  it('never exposes credential reference in the safe audit projection', async () => { const grant = await broker().issue(base()); const safe = credentialGrantSafeAudit(grant); expect(safe.credentialRef).toBe('[REDACTED]'); expect(JSON.stringify(safe)).not.toContain('research/webscout'); expect(JSON.stringify(safe)).not.toContain('TOP-SECRET'); });
  it('rejects expired grants', async () => { let now = Date.now(); const b = new CredentialBroker(new InMemoryCredentialStore({ 'research/webscout': { secret: 'TOP-SECRET' } }), policy, () => now, () => crypto.randomUUID(), new InMemoryCredentialLeaseStore()); const grant = await b.issue({ ...base(), issuedAt: now, expiresAt: now + 1_000 }); now += 1_001; await expectCode(() => b.use(grant, base()), 'GRANT_EXPIRED'); });
  it('uses typed security errors', async () => { const b = broker(); await expect(b.issue({ ...base(), workerTrust: 'untrusted' as const })).rejects.toBeInstanceOf(CredentialBrokerError); });
});
