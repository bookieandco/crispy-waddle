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
      locks.set(input.requestId, previous.then(() => current));
      await previous;
      try {
        const existing = records.get(input.requestId);
        if (existing) return { claimed: false, record: existing };
        records.set(input.requestId, { ...input, status: 'processing' });
        return { claimed: true };
      } finally {
        release();
        if (locks.get(input.requestId) === current) locks.delete(input.requestId);
      }
    },

    async complete(requestId, result) {
      const existing = records.get(requestId);
      if (!existing) throw new Error('MONEY_IDEMPOTENCY_NOT_CLAIMED');
      records.set(requestId, { ...existing, status: 'completed', result });
      for (const resolve of waiters.get(requestId) ?? []) resolve(result);
      waiters.delete(requestId);
    },

    async waitForCompletion(requestId) {
      const existing = records.get(requestId);
      if (existing?.status === 'completed' && existing.result) return existing.result;
      if (!existing) throw new Error('MONEY_IDEMPOTENCY_NOT_FOUND');
      return new Promise((resolve) => {
        const current = waiters.get(requestId) ?? [];
        current.push(resolve);
        waiters.set(requestId, current);
      });
    },
  };
}
