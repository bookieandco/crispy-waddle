import { createSharkExperienceProvenance, type SharkExperienceProvenance } from './experience-provenance'
import type { SharkExperienceWeight } from './experience-ledger'

export type SharkProvenancedExperience = SharkExperienceWeight & {
  provenance: SharkExperienceProvenance
}

export function attachSharkExperienceProvenance(
  experience: SharkExperienceWeight,
  provenance: SharkExperienceProvenance,
): SharkProvenancedExperience {
  if (experience.experienceId !== provenance.experienceId) {
    throw new Error('experience and provenance ids must match')
  }
  return {
    ...experience,
    provenance: createSharkExperienceProvenance(provenance),
  }
}

export function provenanceCompletenessScore(experience: SharkProvenancedExperience): number {
  const evidence = experience.provenance.evidenceIds.length > 0 ? 1 : 0
  const causal = experience.provenance.causalHypotheses.length > 0 ? 1 : 0
  const observations = experience.provenance.observationCount > 0 ? 1 : 0
  return (evidence + causal + observations) / 3
}
