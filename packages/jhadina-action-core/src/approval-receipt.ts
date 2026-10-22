import { createHash } from 'node:crypto';

export type ApprovalReceiptStatus = 'pending' | 'approved' | 'consumed' | 'expired';

export interface ApprovalReceipt {
  id: string;
  actionId: string;
  userId: string;
  type: string;
  fingerprint: string;
  status: ApprovalReceiptStatus;
  requestedAt: string;
  approvedAt?: string;
  expiresAt: string;
  consumedAt?: string;
}

export interface ApprovalReceiptStore {
  createPending(input: {
    actionId: string;
    userId: string;
    type: string;
    fingerprint: string;
    expiresAt: string;
  }): Promise<ApprovalReceipt>;
  approve(receiptId: string, userId: string): Promise<ApprovalReceipt>;
  consume(receiptId: string, expected: { actionId: string; userId: string; type: string; fingerprint: string }): Promise<boolean>;
}

/** A malformed expiry must never behave like an approval with no expiration. */
function isExpiredOrInvalid(expiresAt: string): boolean {
  const timestamp = Date.parse(expiresAt);
  return !Number.isFinite(timestamp) || timestamp <= Date.now();
}

/**
 * Test/development only: all data is lost on a process restart, and separate
 * server instances do not share receipts. Production must inject a durable
 * ApprovalReceiptStore with an atomic, conditional consume operation.
 */
export class InMemoryApprovalReceiptStore implements ApprovalReceiptStore {
  private readonly receipts = new Map<string, ApprovalReceipt>();

  async createPending(input: {
    actionId: string;
    userId: string;
    type: string;
    fingerprint: string;
    expiresAt: string;
  }): Promise<ApprovalReceipt> {
    if (!input.actionId || !input.userId || !input.type || !input.fingerprint) {
      throw new Error('Approval receipt binding incomplete');
    }
    if (!Number.isFinite(Date.parse(input.expiresAt))) {
      throw new Error('Approval receipt expiry invalid');
    }
    const receipt: ApprovalReceipt = {
      id: crypto.randomUUID(),
      ...input,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };
    this.receipts.set(receipt.id, receipt);
    return { ...receipt };
  }

  async approve(receiptId: string, userId: string): Promise<ApprovalReceipt> {
    const receipt = this.receipts.get(receiptId);
    if (!receipt || receipt.status !== 'pending' || receipt.userId !== userId) {
      throw new Error('Approval receipt cannot be approved');
    }
    if (isExpiredOrInvalid(receipt.expiresAt)) {
      const expired = { ...receipt, status: 'expired' as const };
      this.receipts.set(receiptId, expired);
      throw new Error('Approval receipt expired');
    }
    const approved = { ...receipt, status: 'approved' as const, approvedAt: new Date().toISOString() };
    this.receipts.set(receiptId, approved);
    return { ...approved };
  }

  async consume(receiptId: string, expected: { actionId: string; userId: string; type: string; fingerprint: string }): Promise<boolean> {
    const receipt = this.receipts.get(receiptId);
    if (!receipt || receipt.status !== 'approved') return false;
    if (isExpiredOrInvalid(receipt.expiresAt)) {
      this.receipts.set(receiptId, { ...receipt, status: 'expired' });
      return false;
    }
    if (receipt.actionId !== expected.actionId || receipt.userId !== expected.userId || receipt.type !== expected.type || receipt.fingerprint !== expected.fingerprint) {
      return false;
    }
    // This map update is synchronous, so concurrent calls within this ONE
    // process cannot consume the receipt twice. It is not a distributed lock.
    this.receipts.set(receiptId, { ...receipt, status: 'consumed', consumedAt: new Date().toISOString() });
    return true;
  }
}

export interface ApprovalRequestLike<TAction = unknown> {
  id: string;
  userId: string;
  type: string;
  action: TAction;
  requestedAt: string;
}

/**
 * Canonical encoding for JSON-like action payloads. Reject functions, cycles,
 * nonfinite numbers, unsupported object prototypes and symbols rather than
 * accidentally treating two different payloads as equal.
 */
function canonicalAction(value: unknown, ancestors: Set<object> = new Set()): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `string:${JSON.stringify(value)}`;
  if (typeof value === 'boolean') return `bool:${value}`;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Unsupported approval action number');
    return `number:${Object.is(value, -0) ? '-0' : value}`;
  }
  if (typeof value === 'bigint') return `bigint:${value.toString()}`;
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value !== 'object') throw new Error('Unsupported approval action value');
  if (ancestors.has(value)) throw new Error('Circular approval action payload');
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error('Unsupported approval action object');
  }
  if (Object.getOwnPropertySymbols(value).length) {
    throw new Error('Unsupported approval action symbol key');
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const items: string[] = [];
      for (let index = 0; index < value.length; index++) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new Error('Sparse approval action array');
        }
        items.push(canonicalAction(value[index], ancestors));
      }
      if (Object.keys(value).some((key) => !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)) {
        throw new Error('Unsupported approval action array property');
      }
      return `array:[${items.join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (!descriptor || !('value' in descriptor)) {
        throw new Error('Unsupported approval action accessor');
      }
    }
    return `object:{${keys.map((key) => `${JSON.stringify(key)}:${canonicalAction(record[key], ancestors)}`).join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Opt-in hardened fingerprint for NEW approval flows. Includes the entire
 * action payload even when the caller's domain fingerprint is accidentally
 * constant. Existing domain receipts keep their original fingerprint contract
 * until their caller-specific migrations are tested.
 */
export function createActionBoundFingerprint<TAction>(
  domainFingerprint: (request: ApprovalRequestLike<TAction>) => string,
): (request: ApprovalRequestLike<TAction>) => string {
  return (request) => {
    const domain = domainFingerprint(request);
    if (typeof domain !== 'string' || !domain) throw new Error('Approval domain fingerprint invalid');
    const payload = canonicalAction(request.action);
    return createHash('sha256')
      .update(`jhadina.action-approval.v2:${JSON.stringify([domain, payload])}`)
      .digest('hex');
  };
}

export interface ApprovalReceiptVerifier<TAction = unknown> {
  verifyAndConsume(receiptId: string, request: ApprovalRequestLike<TAction>): Promise<boolean>;
}

export function createApprovalReceiptVerifier<TAction = unknown>(
  store: ApprovalReceiptStore,
  fingerprint: (request: ApprovalRequestLike<TAction>) => string,
): ApprovalReceiptVerifier<TAction> {
  return {
    verifyAndConsume(receiptId, request) {
      return store.consume(receiptId, {
        actionId: request.id,
        userId: request.userId,
        type: request.type,
        fingerprint: fingerprint(request),
      });
    },
  };
}

export interface ApprovalRequestService<TAction = unknown> {
  requestApproval(request: ApprovalRequestLike<TAction>): Promise<ApprovalReceipt>;
  approve(receiptId: string, userId: string): Promise<ApprovalReceipt>;
}

export function createApprovalRequestService<TAction = unknown>(
  store: ApprovalReceiptStore,
  fingerprint: (request: ApprovalRequestLike<TAction>) => string,
): ApprovalRequestService<TAction> {
  return {
    async requestApproval(request) {
      return store.createPending({
        actionId: request.id,
        userId: request.userId,
        type: request.type,
        fingerprint: fingerprint(request),
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      });
    },
    approve(receiptId, userId) {
      return store.approve(receiptId, userId);
    },
  };
}
