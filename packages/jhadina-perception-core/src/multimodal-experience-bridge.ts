import type { ObservationExperienceAdapter, ObservationExperienceResult } from "../../jhadina-core-spine/src";
import type { PerceptionObservation } from "./perception-contract";
import type { PerceptionSession, MultimodalMoment } from "./perception-session";

export interface MultimodalExperienceInput {
  moment: MultimodalMoment;
  observations: PerceptionObservation[];
  instruction?: string;
  actor?: "user" | "jhadina" | "system" | "external";
  domain?: string;
}

/** Converts a correlated sensory moment into one canonical Spine experience. */
export async function multimodalMomentToExperience(
  input: MultimodalExperienceInput,
  experiences: ObservationExperienceAdapter,
): Promise<ObservationExperienceResult> {
  const summaries = input.observations.map((item) => item.summary ?? `${item.event.modality} observation.`);
  const content = [
    input.instruction,
    `Multimodal observation (${input.moment.startedAt}–${input.moment.endedAt}):`,
    ...summaries.map((summary, index) => `${index + 1}. ${summary}`),
  ].filter(Boolean).join("\n");

  const evidence = input.observations.map((item) => ({
    id: item.event.id,
    source: item.event.source.id,
    observedAt: item.event.occurredAt,
    summary: item.summary ?? `${item.event.modality} observation.`,
    immutable: true,
  }));

  return experiences.ingest({
    id: `experience:multimodal:${input.moment.sessionId}:${input.moment.startedAt}`,
    occurredAt: input.moment.startedAt,
    source: `perception-session:${input.moment.sessionId}`,
    actor: input.actor ?? "user",
    content,
    domain: input.domain ?? "perception",
    evidence,
    observation: {
      modality: "video",
      summary: summaries.join(" | "),
      metadata: {
        sessionId: input.moment.sessionId,
        startedAt: input.moment.startedAt,
        endedAt: input.moment.endedAt,
        modalities: input.observations.map((item) => item.event.modality),
        eventIds: input.moment.events.map((event) => event.id),
      },
    },
  });
}

/** Selects observations belonging to the session moment without interpreting them. */
export function observationsForMoment(
  session: PerceptionSession,
  moment: MultimodalMoment,
  observations: PerceptionObservation[],
): PerceptionObservation[] {
  const ids = new Set(moment.events.map((event) => event.id));
  return observations.filter((observation) => ids.has(observation.event.id));
}
