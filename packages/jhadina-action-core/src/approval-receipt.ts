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

export class InMemoryApprovalReceiptStore implements ApprovalReceiptStore {
  private readonly receipts = new Map<string, ApprovalReceipt>();

  async createPending(input: {
    actionId: string;
    userId: string;
    type: string;
    fingerprint: string;
    expiresAt: string;
  }): Promise<ApprovalReceipt> {
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
    if (Date.parse(receipt.expiresAt) <= Date.now()) {
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
    if (Date.parse(receipt.expiresAt) <= Date.now()) {
      this.receipts.set(receiptId, { ...receipt, status: 'expired' });
      return false;
    }
    if (receipt.actionId !== expected.actionId || receipt.userId !== expected.userId || receipt.type !== expected.type || receipt.fingerprint !== expected.fingerprint) {
      return false;
    }
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
