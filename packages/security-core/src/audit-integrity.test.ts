import { JhadinaSecurityCore } from './index.js';
import { verifyAuditChain } from './audit-integrity.js';

async function main(): Promise<void> {
  const core = new JhadinaSecurityCore({
    allowedCapabilities: ['project.edit'],
    approvalCapabilities: [],
  });

  const first = await core.audit({
    id: 'audit-1',
    requestId: 'request-1',
    actorId: 'user-1',
    domain: 'test',
    capability: 'project.edit',
    decision: 'allow',
    occurredAt: '2026-08-09T00:00:00.000Z',
  });

  const second = await core.audit({
    id: 'audit-2',
    requestId: 'request-2',
    actorId: 'user-1',
    domain: 'test',
    capability: 'project.edit',
    decision: 'deny',
    occurredAt: '2026-08-09T00:00:01.000Z',
  });

  const valid = await verifyAuditChain([first, second]);
  if (!valid.valid) throw new Error(`AUDIT_CHAIN_SHOULD_PASS:${valid.reason}`);

  const tampered = await verifyAuditChain([
    first,
    { ...second, decision: 'allow' },
  ]);
  if (tampered.valid || tampered.reason !== 'tampered_event_hash') {
    throw new Error(`AUDIT_TAMPER_NOT_DETECTED:${tampered.reason ?? 'valid'}`);
  }

  const broken = await verifyAuditChain([
    first,
    { ...second, previousHash: 'forged-previous-hash' },
  ]);
  if (broken.valid || broken.reason !== 'broken_previous_hash') {
    throw new Error(`AUDIT_CHAIN_BREAK_NOT_DETECTED:${broken.reason ?? 'valid'}`);
  }

  console.log('Audit integrity passed: valid chain, tamper detection, chain-break detection');
}

void main();
