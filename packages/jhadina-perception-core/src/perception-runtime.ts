import type { ObservationExperienceAdapter, ObservationExperienceResult } from "../../jhadina-core-spine/src";
import type { PerceptionObservation } from "./perception-contract";
import type { PerceptionSession, MultimodalMoment } from "./perception-session";
import { multimodalMomentToExperience, observationsForMoment } from "./multimodal-experience-bridge";

export type PerceptionRuntimeMode = "observe" | "observe_and_respond" | "observe_and_act" | "observe_and_learn";

export interface PerceptionRuntimeRequest {
  mode: PerceptionRuntimeMode;
  instruction?: string;
  at?: string;
}

export interface PerceptionRuntimeResult {
  mode: PerceptionRuntimeMode;
  moment: MultimodalMoment;
  observations: PerceptionObservation[];
  experience?: ObservationExperienceResult;
}

export interface PerceptionRuntimeDependencies {
  session: PerceptionSession;
  observations: PerceptionObservation[];
  experiences: ObservationExperienceAdapter;
}

/** Orchestrates perception without implementing reasoning, action, or learning policy. */
export async function runPerceptionRuntime(
  request: PerceptionRuntimeRequest,
  deps: PerceptionRuntimeDependencies,
): Promise<PerceptionRuntimeResult> {
  const moment = deps.session.currentMoment(request.at);
  const observations = observationsForMoment(deps.session, moment, deps.observations);

  if (request.mode === "observe") {
    return { mode: request.mode, moment, observations };
  }

  const experience = await multimodalMomentToExperience(
    { moment, observations, instruction: request.instruction },
    deps.experiences,
  );

  return { mode: request.mode, moment, observations, experience };
}
