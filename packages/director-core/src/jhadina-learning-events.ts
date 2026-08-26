import type { Observation } from './observation-bus.js';

export type LearningDomain = 'universal' | 'filmmaking' | 'music' | 'communication' | 'business' | 'design' | 'science' | 'technology' | 'custom';

export type LearningEvent = {
  id: string;
  studyId: string;
  sourceUrl?: string;
  domain: LearningDomain;
  concept: string;
  evidence: Observation[];
  confidence: number;
  status: 'observed' | 'candidate' | 'corroborated' | 'approved';
  createdAt: string;
};

export function createLearningEvent(input: Omit<LearningEvent, 'id' | 'createdAt'>): LearningEvent {
  return {
    ...input,
    id: `learning:${input.studyId}:${input.evidence[0]?.id ?? 'event'}`,
    createdAt: new Date().toISOString(),
  };
}

export function shouldPromoteLearning(event: LearningEvent): boolean {
  return event.status === 'approved' || (event.status === 'corroborated' && event.confidence >= 0.8 && event.evidence.length >= 2);
}
