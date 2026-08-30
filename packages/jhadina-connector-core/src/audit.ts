export interface AuditReceipt {
  readonly id: string;
  readonly correlationId: string;
  readonly actorId: string;
  readonly sessionId: string;
  readonly connectorId: string;
  readonly operation: string;
  readonly capability: string;
  readonly policyDecision: 'allow' | 'deny' | 'approval_required';
  readonly outcome: 'succeeded' | 'failed' | 'blocked';
  readonly verified: boolean;
  readonly timestamp: string;
}

export interface AuditSink {
  append(receipt: AuditReceipt): Promise<void>;
}

export class InMemoryAuditSink implements AuditSink {
  readonly receipts: AuditReceipt[] = [];

  async append(receipt: AuditReceipt): Promise<void> {
    this.receipts.push(Object.freeze({ ...receipt }));
  }
}
