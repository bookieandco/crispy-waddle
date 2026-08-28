import type { EvidenceRef } from './types.js';
import type { EvolutionPort, ImprovementInput, ImprovementProposal } from './evolution.js';
import type { PersonalityCandidate } from './taste-personality-bridge.js';

export interface TasteEvolutionInput {
  ownerId: string;
  candidates: readonly PersonalityCandidate[];
  observedAt: string;
}

export function createTasteImprovementInputs(input: TasteEvolutionInput): ImprovementInput[] {
  return input.candidates.map((candidate) => {
    const evidence: EvidenceRef[] = candidate.evidenceIds.map((id) => ({
      type: 'experience',
      reference: id,
      summary: `Media experience supporting ${candidate.trait}`,
    }));
    return {
      id: `taste:${input.ownerId}:${candidate.trait}:${candidate.evidenceIds.join(',')}`,
      source: 'observation',
      title: `Taste candidate: ${candidate.trait}`,
      content: `Observed taste signal ${candidate.trait} with value ${candidate.value} and confidence ${candidate.confidence}.`,
      receivedAt: input.observedAt,
      evidence,
    };
  });
}

export async function analyzeTasteEvolution(
  input: TasteEvolutionInput,
  evolution: EvolutionPort,
): Promise<ImprovementProposal[]> {
  const proposals: ImprovementProposal[] = [];
  for (const improvement of createTasteImprovementInputs(input)) {
    proposals.push(await evolution.analyze(improvement));
  }
  return proposals;
}
