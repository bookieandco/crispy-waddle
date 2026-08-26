import type { Observation, ObservationSubscriber } from './observation-bus.js';
import type { LearningCandidate } from './jhadina-learning-gateway.js';
import type { CinematicStudyNote } from './cinematic-study.js';

export type StudyObservationSource = {
  watch(): AsyncIterable<Observation>;
};

export type LearningSink = {
  submit(candidate: LearningCandidate): Promise<void>;
};

export type NoteSink = {
  write(note: CinematicStudyNote): Promise<void>;
};

export type LearningStudyRunner = {
  run(source: StudyObservationSource): Promise<void>;
  stop(): void;
};

function candidateFromObservation(observation: Observation): LearningCandidate {
  return {
    id: `learning:${observation.id}`,
    concept: observation.text ?? observation.label ?? observation.kind,
    domain: 'general',
    evidence: [{ sourceId: observation.assetId, time: observation.time, observationId: observation.id }],
    confidence: observation.confidence ?? 0.5,
    status: 'candidate',
    provenance: { source: observation.source, modality: observation.modality },
  };
}

export function createLearningStudyRunner(deps: {
  learning: LearningSink;
  notes: NoteSink;
  meaningful?: (observation: Observation) => boolean;
}): LearningStudyRunner {
  let stopped = false;
  const meaningful = deps.meaningful ?? ((observation) => (observation.confidence ?? 1) >= 0.7);

  return {
    async run(source) {
      stopped = false;
      for await (const observation of source.watch()) {
        if (stopped || !meaningful(observation)) continue;
        const candidate = candidateFromObservation(observation);
        await deps.learning.submit(candidate);
        await deps.notes.write({
          id: `note:${observation.id}`,
          sourceId: observation.assetId,
          time: observation.time,
          type: observation.modality === 'audio' ? 'sound' : observation.modality === 'transcript' ? 'performance' : 'shot',
          observation: candidate.concept,
          tags: [observation.modality, observation.kind],
          createdAt: new Date().toISOString(),
        });
      }
    },
    stop() {
      stopped = true;
    },
  };
}
