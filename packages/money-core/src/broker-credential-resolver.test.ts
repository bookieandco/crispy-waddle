import { describe, expect, it } from 'vitest';
import { CredentialBroker, EgressPolicy, InMemoryCredentialLeaseStore, InMemoryCredentialStore } from '@jhadina/security-core';
import { BrokerCredentialResolver } from './broker-credential-resolver.js';

const request = {
  requestId: 'request-1',
  actorId: 'user-1',
  workerId: 'jhadina-web',
  capability: 'money.account.read',
  provider: 'plaid',
  credentialRef: 'money/plaid/default',
  purpose: 'governed-money-account-read',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 30_000,
  nonce: 'nonce-1',
};

function broker() {
  return new CredentialBroker(
    new InMemoryCredentialStore({ 'money/plaid/default': { secret: 'never-log-me' } }),
    {
      maxTtlMs: 60_000,
      providerCapabilities: { plaid: ['money.account.read'] },
      allowedCredentialRefs: ['money/plaid/default'],
      maxUses: 1,
    },
    Date.now,
    () => 'lease-1',
    new InMemoryCredentialLeaseStore(),
  );
}

describe('BrokerCredentialResolver egress binding', () => {
  it('releases only after the exact destination is allowlisted', async () => {
    const resolver = new BrokerCredentialResolver(broker(), request, 'trusted-compute', {
      policy: new EgressPolicy([{ capability: 'money.account.read', hosts: ['sandbox.plaid.com'], protocols: ['https'], ports: [443], allowedDataClasses: ['internal'] }]),
      destination: 'https://sandbox.plaid.com',
      dataClass: 'internal',
    });
    await expect(resolver.resolve(request.credentialRef)).resolves.toMatchObject({ secret: 'never-log-me' });
  });

  it('fails closed before issuing a credential for a non-allowlisted destination', async () => {
    const resolver = new BrokerCredentialResolver(broker(), request, 'trusted-compute', {
      policy: new EgressPolicy([{ capability: 'money.account.read', hosts: ['api.example.invalid'], protocols: ['https'], ports: [443], allowedDataClasses: ['internal'] }]),
      destination: 'https://sandbox.plaid.com',
      dataClass: 'internal',
    });
    await expect(resolver.resolve(request.credentialRef)).rejects.toThrow('EGRESS_DENIED:destination_not_allowlisted');
  });

  it('never permits secret-class egress', async () => {
    const resolver = new BrokerCredentialResolver(broker(), request, 'trusted-compute', {
      policy: new EgressPolicy([{ capability: 'money.account.read', hosts: ['sandbox.plaid.com'], protocols: ['https'], ports: [443], allowedDataClasses: ['secret'] }]),
      destination: 'https://sandbox.plaid.com',
      dataClass: 'secret',
    });
    await expect(resolver.resolve(request.credentialRef)).rejects.toThrow('EGRESS_DENIED:secret_egress_denied');
  });
});
