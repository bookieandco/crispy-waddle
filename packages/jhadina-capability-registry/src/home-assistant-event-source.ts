import type { HomeAssistantEventPublisher } from './home-assistant-event-publisher.js';
import { normalizeHomeAssistantStateChanged, type HomeAssistantStateChangedInput } from './home-assistant-state-events.js';

export interface HomeAssistantEventSource {
  subscribe(handler: (event: HomeAssistantStateChangedInput) => void | Promise<void>): () => void;
}

/** Transport-neutral ingestion boundary. A WebSocket/HTTP implementation belongs outside this package contract. */
export class HomeAssistantStateEventIngestor {
  constructor(
    private readonly source: HomeAssistantEventSource,
    private readonly publisher: HomeAssistantEventPublisher,
  ) {}

  start(): () => void {
    return this.source.subscribe(async (input) => {
      const canonical = normalizeHomeAssistantStateChanged(input);
      await this.publisher.publishStateChanged(canonical);
    });
  }
}
