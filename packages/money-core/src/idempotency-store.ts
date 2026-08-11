export type TransactionWriteResult = {
  providerReference: string;
  status: string;
};

export type IdempotencyRecord = {
  requestId: string;
  userId: string;
  capability: string;
  status: 'processing' | 'completed';
  result?: TransactionWriteResult;
};

export interface IdempotencyStore {
  claim(record: Omit<IdempotencyRecord, 'status' | 'result'>): Promise<{ claimed: true } | { claimed: false; record: IdempotencyRecord }>;
  complete(requestId: string, result: TransactionWriteResult): Promise<void>;
  waitForCompletion(requestId: string): Promise<TransactionWriteResult>;
}

export function createInMemoryIdempotencyStore(): IdempotencyStore {
  const records = new Map<string, IdempotencyRecord>();
  const waiters = new Map<string, Array<(result: TransactionWriteResult) => void>>();
  const locks = new Map<string, Promise<void>>();

  return {
    async claim(input) {
      const previous = locks.get(input.requestId) ?? Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>((resolve) => { release = resolve; });
      const queued = previous.then(() => current);
      locks.set(input.requestId, queued);
      await previous;

      try {
        const existing = records.get(input.requestId);
        if (existing) return { claimed: false, record: existing };
        records.set(input.requestId, { ...input, status: 'processing' });
        return { claimed: true };
      } finally {
        release();
        if (locks.get(input.requestId) === queued) locks.delete(input.requestId);
      }
    },

    async complete(requestId, result) {
      const existing = records.get(requestId);
      if (!existing) throw new Error('MONEY_IDEMPOTENCY_NOT_CLAIMED');
      records.set(requestId, { ...existing, status: 'completed', result });
      const pending = waiters.get(requestId) ?? [];
      waiters.delete(requestId);
      for (const resolve of pending) resolve(result);
    },

    async waitForCompletion(requestId) {
      const existing = records.get(requestId);
      if (!existing) throw new Error('MONEY_IDEMPOTENCY_NOT_FOUND');
      if (existing.status === 'completed' && existing.result) return existing.result;
      return new Promise<TransactionWriteResult>((resolve) => {
        const pending = waiters.get(requestId) ?? [];
        pending.push(resolve);
        waiters.set(requestId, pending);
      });
    },
  };
}
