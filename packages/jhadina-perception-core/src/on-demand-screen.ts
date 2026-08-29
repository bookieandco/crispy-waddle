import type { EventBus } from "../../jhadina-event-bus/src";
import type { PerceptionObservation } from "./perception-contract";
import { observeAndPublish } from "./observe";
import { PerceptionRouter } from "./perception-router";
import { SalienceEngine } from "./salience-engine";
import type { ScreenCapturePolicy, ScreenSource } from "./screen-contract";
import { frameToPerceptionEvent } from "./screen-contract";

export interface LookAtScreenResult {
  observation: PerceptionObservation | null;
  captured: boolean;
}

export async function lookAtScreen(
  source: ScreenSource,
  router: PerceptionRouter,
  salience: SalienceEngine,
  eventBus: EventBus,
  policy: ScreenCapturePolicy,
  eventId: string,
): Promise<LookAtScreenResult> {
  if (!policy.enabled) return { observation: null, captured: false };

  const frame = await source.capture({ ...policy, onDemandOnly: true });
  if (!frame) return { observation: null, captured: false };

  const event = frameToPerceptionEvent(source, frame);
  const observation = await observeAndPublish(router, salience, eventBus, event, {
    eventId,
    userRequested: true,
    changed: true,
    novelty: 1,
    taskRelevance: 1,
  });

  return { observation, captured: true };
}
