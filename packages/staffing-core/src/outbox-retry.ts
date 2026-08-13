import type { RetryPolicy } from "./outbox-worker.js";

export class ExponentialOutboxRetry implements RetryPolicy {
  constructor(
    private readonly baseSeconds = 5,
    private readonly maxSeconds = 3600,
  ) {}

  next(attempt: number, now: string): string {
    const seconds = Math.min(this.maxSeconds, this.baseSeconds * 2 ** Math.max(0, attempt - 1));
    return new Date(Date.parse(now) + seconds * 1000).toISOString();
  }
}
