export interface DailyAuditSchedulerOptions {
  run: () => Promise<void>;
  intervalMs: number;
  now?: () => number;
}

/**
 * Process-local heartbeat for the daily evolution audit.
 * Scheduling is deliberately separate from the audit itself so a deployment
 * can replace this with Supabase Cron, GitHub Actions, or another durable
 * scheduler without changing audit semantics.
 */
export class DailyAuditScheduler {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(private readonly options: DailyAuditSchedulerOptions) {
    if (!Number.isFinite(options.intervalMs) || options.intervalMs <= 0) {
      throw new Error("intervalMs must be a positive finite number");
    }
  }

  start() {
    if (this.timer) return;

    this.timer = setInterval(() => {
      void this.tick();
    }, this.options.intervalMs);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick() {
    if (this.running) return false;
    this.running = true;
    try {
      await this.options.run();
      return true;
    } finally {
      this.running = false;
    }
  }

  isRunning() {
    return this.running;
  }
}
