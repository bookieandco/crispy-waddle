import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import type { ActionRequest } from '@jhadina/action-core';
import {
  createMoneyActionCoreAuthority,
  issueActionCoreBoundExecutionPermit,
} from './action-core-authority-bridge.js';
import {
  createExecutionAttempt,
  type ExecutionAttempt,
  type ExecutionAttemptOutcome,
  type ExecutionAttemptStore,
} from './execution-attempt.js';
import {
  type ExecutionAction,
  type ExecutionPermit,
  type PermitStore,
} from './execution-permit.js';
import {
  authorizeAndConsumeMoneyPermit,
  type MoneyExecutionPermit,
} from './execution-permit-gate.js';
import {
  ExecutionReconciliationAdapterRegistry,
  type MoneyExecutionReconciliationAdapter,
} from './execution-reconciliation-adapter.js';
import type {
  ExecutionRecoveryLeaseStore,
  RecoveryLease,
} from './execution-recovery-lease.js';
import {
  MoneyExecutionRecoveryService,
} from './execution-recovery-service.js';
import type {
  ExecutionRecoveryLedger,
  RecoveryObservation,
} from './execution-recovery.js';
import {
  recoveryEvidenceHash,
} from './postgres-execution-recovery-ledger.js';
import type {
  AtomicRecoveryResolver,
} from './postgres-atomic-recovery-resolver.js';

type PaymentAction = Readonly<{
  capability: 'money.payment.create';
  provider: string;
  accountId: string;
  amount: number;
  currency: string;
  payeeId: string;
}>;

const payment: PaymentAction = Object.freeze({
  capability: 'money.payment.create',
  provider: 'cert-bank',
  accountId: 'acct-1',
  amount: 25,
  currency: 'USD',
  payeeId: 'payee-1',
});

const request: ActionRequest<PaymentAction> = Object.freeze({
  id: 'r13b-action-1',
  userId: 'user-1',
  type: payment.capability,
  action: payment,
  requestedAt: '2026-09-19T20:00:00Z',
  approvalReceiptId: 'approval-r13b-1',
});

const executionAction: ExecutionAction = Object.freeze({
  actionId: request.id,
  userId: request.userId,
  capability: payment.capability,
  provider: payment.provider,
  accountId: payment.accountId,
  payeeId: payment.payeeId,
  amount: String(payment.amount),
  currency: payment.currency,
});

function makePermit(): ExecutionPermit {
  const authority = createMoneyActionCoreAuthority(request, {
    authorityId: 'authority-r13b-1',
    decision: 'approval_required',
    policyVersion: 'money-policy-v1',
    policyHash: 'money-policy-hash-v1',
    authorizedAt: '2026-09-19T20:00:01Z',
    expiresAt: '2026-09-19T20:10:00Z',
  });

  return issueActionCoreBoundExecutionPermit(
    request,
    executionAction,
    authority,
    {
      expiresAt: '2026-09-19T20:05:00Z',
      now: '2026-09-19T20:00:02Z',
      permitId: 'permit-r13b-1',
      nonce: 'nonce-r13b-1',
      opportunityId: 'opp-r13b-1',
      riskDecisionId: 'risk-r13b-1',
      allocationDecisionId: 'allocation-r13b-1',
    },
  );
}

function permitReference(
  permit: ExecutionPermit,
): MoneyExecutionPermit {
  return Object.freeze({
    permitId: permit.permitId,
    nonce: permit.nonce,
    authorityId: permit.binding.authorityId,
    actionRequestFingerprint:
      permit.binding.actionRequestFingerprint,
    policyVersion: permit.binding.policyVersion,
    policyHash: permit.binding.policyHash,
    approvalId: permit.binding.approvalId,
    opportunityId: permit.binding.opportunityId,
    riskDecisionId: permit.binding.riskDecisionId,
    allocationDecisionId: permit.binding.allocationDecisionId,
  });
}

class AtomicPermitStore implements PermitStore {
  private readonly permits = new Map<string, ExecutionPermit>();

  issue(permit: ExecutionPermit): void {
    this.permits.set(permit.permitId, permit);
  }

  get(permitId: string): ExecutionPermit | undefined {
    return this.permits.get(permitId);
  }

  async consume(
    permitId: string,
    nonce: string,
  ): Promise<boolean> {
    // Yield once so concurrent callers all have a chance to verify the same
    // ISSUED permit before competing for the one state transition.
    await Promise.resolve();

    const permit = this.permits.get(permitId);
    if (
      !permit ||
      permit.state !== 'ISSUED' ||
      permit.nonce !== nonce
    ) {
      return false;
    }

    this.permits.set(
      permitId,
      Object.freeze({ ...permit, state: 'CONSUMED' }),
    );
    return true;
  }

  revoke(permitId: string): void {
    const permit = this.permits.get(permitId);
    if (permit?.state === 'ISSUED') {
      this.permits.set(
        permitId,
        Object.freeze({ ...permit, state: 'REVOKED' }),
      );
    }
  }

  haltAll(): void {
    for (const [permitId, permit] of this.permits) {
      if (permit.state === 'ISSUED') {
        this.permits.set(
          permitId,
          Object.freeze({ ...permit, state: 'HALTED' }),
        );
      }
    }
  }
}

test('R13B: exactly one concurrent caller can consume an execution permit', async () => {
  const permit = makePermit();
  const store = new AtomicPermitStore();
  store.issue(permit);
  const ref = permitReference(permit);

  const results = await Promise.allSettled(
    Array.from({ length: 32 }, () =>
      authorizeAndConsumeMoneyPermit(
        store,
        ref,
        request,
        executionAction,
        '2026-09-19T20:00:03Z',
      ),
    ),
  );

  const fulfilled = results.filter(
    (result) => result.status === 'fulfilled',
  );
  const rejected = results.filter(
    (result) => result.status === 'rejected',
  );

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 31);
  assert.equal(store.get(permit.permitId)?.state, 'CONSUMED');

  for (const result of rejected) {
    if (result.status === 'rejected') {
      assert.match(
        String(result.reason),
        /Permit replay or invalid nonce/,
      );
    }
  }
});

test('R13B: ActionRequest mutation cannot reuse prior authority or permit', async () => {
  const permit = makePermit();
  const store = new AtomicPermitStore();
  store.issue(permit);

  const mutatedRequest: ActionRequest<PaymentAction> = {
    ...request,
    action: {
      ...payment,
      amount: 26,
    },
  };

  await assert.rejects(
    () =>
      authorizeAndConsumeMoneyPermit(
        store,
        permitReference(permit),
        mutatedRequest,
        {
          ...executionAction,
          amount: '26',
        },
        '2026-09-19T20:00:03Z',
      ),
    /REQUEST_FINGERPRINT_MISMATCH/,
  );

  assert.equal(store.get(permit.permitId)?.state, 'ISSUED');
});

test('R13B: tampered authority and policy bindings fail before permit consumption', async () => {
  const permit = makePermit();

  for (const tampered of [
    {
      ...permitReference(permit),
      authorityId: 'forged-authority',
    },
    {
      ...permitReference(permit),
      policyHash: 'forged-policy-hash',
    },
  ]) {
    const store = new AtomicPermitStore();
    store.issue(permit);

    await assert.rejects(
      () =>
        authorizeAndConsumeMoneyPermit(
          store,
          tampered,
          request,
          executionAction,
          '2026-09-19T20:00:03Z',
        ),
      /AUTHORITY_MISMATCH|Policy hash mismatch/,
    );

    assert.equal(store.get(permit.permitId)?.state, 'ISSUED');
  }
});

test('R13B: changed economic action fails its permit fingerprint', async () => {
  const permit = makePermit();
  const store = new AtomicPermitStore();
  store.issue(permit);

  await assert.rejects(
    () =>
      authorizeAndConsumeMoneyPermit(
        store,
        permitReference(permit),
        request,
        {
          ...executionAction,
          amount: '2500',
        },
        '2026-09-19T20:00:03Z',
      ),
    /Action fingerprint mismatch/,
  );

  assert.equal(store.get(permit.permitId)?.state, 'ISSUED');
});

class AttemptStore implements ExecutionAttemptStore {
  constructor(private readonly attempt: ExecutionAttempt) {}

  start(_attempt: ExecutionAttempt): void {
    throw new Error('R13B_RECOVERY_MUST_NOT_START_NEW_ATTEMPT');
  }

  complete(
    _attemptId: string,
    _outcome: ExecutionAttemptOutcome,
  ): void {
    throw new Error('R13B_RECOVERY_MUST_USE_ATOMIC_RESOLVER');
  }

  resolve(
    _attemptId: string,
    _outcome: ExecutionAttemptOutcome,
  ): void {
    throw new Error('R13B_RECOVERY_MUST_USE_ATOMIC_RESOLVER');
  }

  get(attemptId: string): ExecutionAttempt | undefined {
    return attemptId === this.attempt.attemptId
      ? this.attempt
      : undefined;
  }
}

class LeaseStore implements ExecutionRecoveryLeaseStore {
  claims = 0;
  renewals = 0;
  releases = 0;

  async claim(
    executionId: string,
    leaseId: string,
    _leaseSeconds: number,
  ): Promise<RecoveryLease> {
    this.claims += 1;
    return {
      executionId,
      leaseId,
      leaseExpiresAt: '2026-09-19T20:10:00Z',
      state: 'recovery_required',
    };
  }

  async renew(
    executionId: string,
    leaseId: string,
    _leaseSeconds: number,
  ): Promise<RecoveryLease> {
    this.renewals += 1;
    return {
      executionId,
      leaseId,
      leaseExpiresAt: '2026-09-19T20:10:00Z',
      state: 'recovery_required',
    };
  }

  async release(
    _executionId: string,
    _leaseId: string,
  ): Promise<boolean> {
    this.releases += 1;
    return true;
  }
}

function ambiguousAttempt(): ExecutionAttempt {
  const started = createExecutionAttempt({
    attemptId: 'attempt-r13b-1',
    requestId: request.id,
    permitId: 'permit-r13b-1',
    action: executionAction,
    operation: payment.capability,
    now: '2026-09-19T20:00:04Z',
  });

  return {
    ...started,
    state: 'UNKNOWN',
    errorCode: 'MONEY_PROVIDER_OUTCOME_UNKNOWN',
    errorMessage: 'provider timeout',
    recoveryRequired: true,
    completedAt: '2026-09-19T20:00:05Z',
  };
}

function observationFor(
  attempt: ExecutionAttempt,
  state: RecoveryObservation['observedState'],
): RecoveryObservation {
  const withoutHash = {
    executionId: attempt.attemptId,
    proposalHash: attempt.actionFingerprint,
    providerOperation: attempt.operation,
    providerReference:
      state === 'SUCCEEDED' ? 'provider-ref-1' : undefined,
    observedState: state,
    evidence: {
      provider: attempt.provider,
      requestId: attempt.requestId,
    },
    adapterId: 'cert-reconciler',
    adapterVersion: 1,
    checkedAt: '2026-09-19T20:01:00Z',
  } satisfies Omit<RecoveryObservation, 'evidenceHash'>;

  return {
    ...withoutHash,
    evidenceHash: recoveryEvidenceHash(withoutHash),
  };
}

test('R13B: confirmed recovery resolves only through the atomic resolver', async () => {
  const attempt = ambiguousAttempt();
  const leases = new LeaseStore();
  const observations: RecoveryObservation[] = [];
  const atomicCalls: Array<Parameters<AtomicRecoveryResolver['resolve']>[0]> =
    [];

  const ledger: ExecutionRecoveryLedger & {
    ensureExecutionLedger(
      attemptToEnsure: ExecutionAttempt,
    ): Promise<void>;
  } = {
    async ensureExecutionLedger(attemptToEnsure) {
      assert.equal(attemptToEnsure.attemptId, attempt.attemptId);
    },
    async recordObservation(observation) {
      observations.push(observation);
    },
    async markAttemptResolved() {
      throw new Error('R13B_NON_ATOMIC_RECOVERY_RESOLUTION');
    },
  };

  const atomicResolver: AtomicRecoveryResolver = {
    async resolve(input) {
      atomicCalls.push(input);
    },
  };

  const service = new MoneyExecutionRecoveryService({
    attempts: new AttemptStore(attempt),
    reconciler: {
      async reconcile() {
        return observationFor(attempt, 'SUCCEEDED');
      },
    },
    ledger,
    atomicResolver,
    leases,
    leaseIdFactory: () => 'lease-r13b-1',
    now: () => Date.parse('2026-09-19T20:00:30Z'),
  });

  const result = await service.recover(attempt.attemptId);

  assert.equal(result.disposition, 'RESOLVED_SUCCEEDED');
  assert.equal(observations.length, 1);
  assert.equal(atomicCalls.length, 1);
  assert.equal(atomicCalls[0]?.attemptId, attempt.attemptId);
  assert.equal(atomicCalls[0]?.outcome.state, 'SUCCEEDED');
  assert.equal(
    atomicCalls[0]?.outcome.providerReference,
    'provider-ref-1',
  );
  assert.equal(leases.claims, 1);
  assert.equal(leases.renewals, 2);
  assert.equal(leases.releases, 1);
});

test('R13B: forged reconciliation evidence fails closed and releases the lease', async () => {
  const attempt = ambiguousAttempt();
  const leases = new LeaseStore();
  let atomicCalls = 0;

  const service = new MoneyExecutionRecoveryService({
    attempts: new AttemptStore(attempt),
    reconciler: {
      async reconcile() {
        return {
          ...observationFor(attempt, 'SUCCEEDED'),
          evidenceHash: 'forged-evidence-hash',
        };
      },
    },
    ledger: {
      async recordObservation() {
        throw new Error('R13B_FORGED_EVIDENCE_MUST_NOT_BE_RECORDED');
      },
      async markAttemptResolved() {
        throw new Error('R13B_FORGED_EVIDENCE_MUST_NOT_RESOLVE');
      },
    },
    atomicResolver: {
      async resolve() {
        atomicCalls += 1;
      },
    },
    leases,
    leaseIdFactory: () => 'lease-r13b-forged',
    now: () => Date.parse('2026-09-19T20:00:30Z'),
  });

  await assert.rejects(
    () => service.recover(attempt.attemptId),
    /EVIDENCE_HASH_MISMATCH/,
  );

  assert.equal(atomicCalls, 0);
  assert.equal(leases.releases, 1);
});

test('R13B: reconciliation registry fails closed for missing or unsupported provider recovery', () => {
  const attempt = ambiguousAttempt();
  const registry = new ExecutionReconciliationAdapterRegistry();

  assert.throws(
    () => registry.getReconciler(attempt.provider, attempt),
    /ADAPTER_NOT_REGISTERED/,
  );

  const adapter: MoneyExecutionReconciliationAdapter = {
    provider: attempt.provider,
    adapterId: 'rejecting-adapter',
    adapterVersion: 1,
    canReconcile() {
      return false;
    },
    async reconcile() {
      return observationFor(attempt, 'UNKNOWN');
    },
  };

  registry.register(adapter);

  assert.throws(
    () => registry.getReconciler(attempt.provider, attempt),
    /UNSUPPORTED_EXECUTION/,
  );
});

test('R13B: Money migration numbers are unique and authority migration is fail-closed', () => {
  const migrationsDirectory = fileURLToPath(
    new URL('../migrations/', import.meta.url),
  );
  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const numbers = migrationFiles.map((name) => {
    const match = /^(\d+)_/.exec(name);
    assert.ok(match, `Unnumbered Money migration: ${name}`);
    return match[1]!;
  });

  assert.equal(
    new Set(numbers).size,
    numbers.length,
    `Duplicate Money migration number: ${migrationFiles.join(', ')}`,
  );

  const authorityMigration = migrationFiles.find((name) =>
    name.endsWith('_bind_permits_to_action_core_authority.sql'),
  );
  assert.equal(
    authorityMigration,
    '005_bind_permits_to_action_core_authority.sql',
  );

  const sql = readFileSync(
    `${migrationsDirectory}/${authorityMigration}`,
    'utf8',
  );
  assert.match(sql, /action_request_fingerprint/);
  assert.match(sql, /authority_id/);
  assert.match(sql, /state = 'REVOKED'/);
  assert.match(sql, /SET NOT NULL/);
});


test('R13B: recovery lineage migration requires fresh authority and canonical retry-safe evidence', () => {
  const migrationsDirectory = fileURLToPath(
    new URL('../migrations/', import.meta.url),
  );
  const sql = readFileSync(
    `${migrationsDirectory}/006_recovery_execution_lineage.sql`,
    'utf8',
  );

  assert.match(sql, /recovery_of_execution_id/);
  assert.match(sql, /MONEY_RECOVERY_FRESH_PERMIT_REQUIRED/);
  assert.match(sql, /MONEY_RECOVERY_PERMIT_NOT_CONSUMED/);
  assert.match(sql, /MONEY_RECOVERY_RETRY_EVIDENCE_REQUIRED/);
  assert.match(sql, /MONEY_RECOVERY_RETRY_NOT_SAFE/);
  assert.match(sql, /MONEY_RECOVERY_GENERATION_LIMIT/);
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /REVOKE ALL[\s\S]*authenticated/);
});
