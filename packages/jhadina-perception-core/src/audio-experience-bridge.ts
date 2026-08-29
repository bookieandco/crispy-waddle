import type { ObservationExperienceAdapter, ObservationExperienceResult } from "../../jhadina-core-spine/src";
import type { PerceptionObservation } from "./perception-contract";

export interface AudioExperienceInput {
  observation: PerceptionObservation;
  instruction?: string;
  actor?: "user" | "jhadina" | "system" | "external";
  domain?: string;
}

/** Converts an audio/Whisper observation into the canonical Spine experience. */
export async function audioObservationToExperience(
  input: AudioExperienceInput,
  experiences: ObservationExperienceAdapter,
): Promise<ObservationExperienceResult> {
  const { observation } = input;
  const summary = observation.summary ?? "Jhadina observed audio.";
  const content = input.instruction
    ? `${input.instruction}\nAudio observation: ${summary}`
    : summary;

  const evidence = [{
    id: observation.event.id,
    source: observation.event.source.id,
    observedAt: observation.event.occurredAt,
    summary,
    immutable: true,
  }];

  return experiences.ingest({
    id: `experience:${observation.event.id}`,
    occurredAt: observation.event.occurredAt,
    source: observation.event.source.id,
    actor: input.actor ?? "user",
    content,
    domain: input.domain ?? "perception",
    evidence,
    observation: {
      modality: "audio",
      summary,
      contentRef: observation.event.contentRef,
      metadata: {
        ...observation.event.metadata,
        sensitivity: observation.event.sensitivity,
        retention: observation.event.retention,
        confidence: observation.event.confidence,
        salience: observation.salience,
        entities: observation.entities,
        changes: observation.changes,
      },
    },
  });
}
