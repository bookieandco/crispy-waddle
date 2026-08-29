import type { EventBus } from "../../jhadina-event-bus/src";
import type { PerceptionEvent, PerceptionObservation } from "./perception-contract";
import { publishPerceptionObservation } from "./event-adapter";
import { PerceptionRouter } from "./perception-router";
import { SalienceEngine } from "./salience-engine";

export interface ObserveOptions {
  eventId: string;
  userRequested?: boolean;
  changed?: boolean;
  novelty?: number;
  taskRelevance?: number;
}

export async function observeAndPublish(
  router: PerceptionRouter,
  salience: SalienceEngine,
  eventBus: EventBus,
  event: PerceptionEvent,
  options: ObserveOptions,
): Promise<PerceptionObservation> {
  const observation = await router.observe(event);
  observation.salience = salience.score({
    userRequested: options.userRequested,
    changed: options.changed,
    confidence: observation.event.confidence,
    novelty: options.novelty,
    taskRelevance: options.taskRelevance,
  });

  await publishPerceptionObservation(eventBus, observation, options.eventId);
  return observation;
}
