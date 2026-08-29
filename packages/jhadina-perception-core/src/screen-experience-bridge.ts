import type { ObservationExperienceAdapter, ObservationExperienceResult } from "../../jhadina-core-spine/src";
import type { PerceptionObservation } from "./perception-contract";

export interface ScreenExperienceInput {
  observation: PerceptionObservation;
  instruction?: string;
  actor?: "user" | "jhadina" | "system" | "external";
  domain?: string;
}

/**
 * Converts the semantic result of screen perception into a canonical Spine
 * experience. The screen adapter remains responsible for capture/privacy;
 * Core Spine remains responsible for memory, personality, decision, policy,
 * action, and audit.
 */
export async function screenObservationToExperience(
  input: ScreenExperienceInput,
  experiences: ObservationExperienceAdapter,
): Promise<ObservationExperienceResult> {
  const { observation } = input;
  const summary = observation.summary ?? "Jhadina observed the user's screen.";
  const content = input.instruction
    ? `${input.instruction}\nObservation: ${summary}`
    : summary;

  const evidence = [
    {
      id: observation.event.id,
      source: observation.event.source.id,
      observedAt: observation.event.occurredAt,
      summary,
      immutable: true,
    },
  ];

  return experiences.ingest({
    id: `experience:${observation.event.id}`,
    occurredAt: observation.event.occurredAt,
    source: observation.event.source.id,
    actor: input.actor ?? "user",
    content,
    domain: input.domain ?? "perception",
    evidence,
    observation: {
      modality: "screen",
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
