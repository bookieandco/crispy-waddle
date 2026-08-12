import type { CoreMemoryAdapter } from './core-adapters';
import type { JhadinaEvent } from './contracts';
import type { EventBus } from './event-bus';

export class MemoryCoreEventAdapter {
  constructor(
    private readonly memory: CoreMemoryAdapter,
    private readonly events: EventBus,
  ) {}

  register(): () => void {
    const unsubscribe = this.events.subscribe('MEMORY_CANDIDATE_CREATED', async (event: JhadinaEvent<{
      userId: string;
      content: string;
      type: 'PREFERENCE' | 'IDENTITY' | 'GOAL' | 'CONTEXT';
      confidence: number;
      reasoningEventId: string;
    }>) => {
      await this.memory.memory.createCandidate(event.payload);
    });

    return unsubscribe;
  }
}
