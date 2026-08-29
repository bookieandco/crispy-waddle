import type { DomainEvent, EventBus } from "../../jhadina-event-bus/src";
import type { PerceptionObservation } from "./perception-contract";

export const PERCEPTION_OBSERVED_EVENT = "jhadina.perception.observed";

export interface PerceptionObservedPayload {
  observation: PerceptionObservation;
}

export function createPerceptionObservedEvent(
  observation: PerceptionObservation,
  id: string,
  occurredAt = new Date().toISOString(),
): DomainEvent<PerceptionObservedPayload> {
  return {
    id,
    type: PERCEPTION_OBSERVED_EVENT,
    occurredAt,
    payload: { observation },
  };
}

export async function publishPerceptionObservation(
  eventBus: EventBus,
  observation: PerceptionObservation,
  id: string,
): Promise<void> {
  await eventBus.publish(createPerceptionObservedEvent(observation, id));
}
