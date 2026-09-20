import { transitionDeadMan, type DeadManEvent, type DeadManState } from './safety-deadman.js';
import type { DurableSafetyIncident, DurableSafetyIncidentStore } from './safety-durable-runtime.js';

export interface SafetyClock {
  now(): string;
}

export interface DeadManRuntimeCommand {
  readonly incidentId: string;
  readonly event: DeadManEvent;
  readonly nextDeadlineAt?: string;
}

export class DurableDeadManRuntime {
  constructor(
    private readonly store: DurableSafetyIncidentStore,
    private readonly clock: SafetyClock,
  ) {}

  async apply(command: DeadManRuntimeCommand): Promise<DurableSafetyIncident> {
    const current = await this.store.load(command.incidentId);
    if (!current) throw new Error('Safety incident not found');
    const nextState: DeadManState = transitionDeadMan(current.deadManState, command.event);
    const next: DurableSafetyIncident = {
      ...current,
      deadManState: nextState,
      deadlineAt: command.nextDeadlineAt,
      updatedAt: this.clock.now(),
    };
    const result = await this.store.save(next, current.updatedAt);
    if (result === 'conflict') throw new Error('Safety incident update conflict');
    return next;
  }

  async due(incidentId: string): Promise<boolean> {
    const current = await this.store.load(incidentId);
    if (!current?.deadlineAt) return false;
    return Date.parse(current.deadlineAt) <= Date.parse(this.clock.now());
  }
}
