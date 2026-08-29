export type PerceptionModality = 'screen' | 'audio' | 'video' | 'image' | 'text';

export interface PerceptionEvent<T = unknown> {
  id: string;
  sessionId: string;
  occurredAt: string;
  modality: PerceptionModality;
  payload: T;
}

export interface MultimodalMoment {
  sessionId: string;
  startedAt: string;
  endedAt: string;
  events: PerceptionEvent[];
}

export interface PerceptionSessionOptions {
  sessionId: string;
  correlationWindowMs?: number;
  now?: () => string;
}

/** Correlates sensory events without interpreting them.
 * Interpretation remains the responsibility of Perception/Core Spine.
 */
export class PerceptionSession {
  private readonly events: PerceptionEvent[] = [];
  private readonly windowMs: number;
  private readonly now: () => string;

  constructor(private readonly options: PerceptionSessionOptions) {
    this.windowMs = options.correlationWindowMs ?? 1500;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  add<T>(event: Omit<PerceptionEvent<T>, 'sessionId'>): PerceptionEvent<T> {
    const normalized: PerceptionEvent<T> = {
      ...event,
      sessionId: this.options.sessionId,
    };
    this.events.push(normalized);
    return normalized;
  }

  eventsInWindow(at: string): PerceptionEvent[] {
    const target = Date.parse(at);
    return this.events.filter((event) => Math.abs(Date.parse(event.occurredAt) - target) <= this.windowMs);
  }

  currentMoment(at = this.now()): MultimodalMoment {
    const events = this.eventsInWindow(at);
    const timestamps = events.map((event) => Date.parse(event.occurredAt));
    const target = Date.parse(at);
    const start = timestamps.length ? Math.min(...timestamps) : target;
    const end = timestamps.length ? Math.max(...timestamps) : target;

    return {
      sessionId: this.options.sessionId,
      startedAt: new Date(start).toISOString(),
      endedAt: new Date(end).toISOString(),
      events,
    };
  }

  clear(): void {
    this.events.length = 0;
  }
}
