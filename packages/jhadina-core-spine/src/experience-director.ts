import type { ExperienceEvent } from './experience.js';

export interface DirectorExperienceMetadata {
  projectId: string;
  shotId?: string;
  takeId?: string;
  reaction?: 'love' | 'like' | 'neutral' | 'dislike' | 'hate';
  controls?: Record<string, string | number | boolean | null>;
}

export function getDirectorExperienceMetadata(event: ExperienceEvent): DirectorExperienceMetadata | null {
  if (event.domain !== 'directoros') return null;
  const metadata = event.metadata ?? {};
  if (typeof metadata.projectId !== 'string' || !metadata.projectId.trim()) return null;
  return {
    projectId: metadata.projectId,
    shotId: typeof metadata.shotId === 'string' ? metadata.shotId : undefined,
    takeId: typeof metadata.takeId === 'string' ? metadata.takeId : undefined,
    reaction: isReaction(metadata.reaction) ? metadata.reaction : undefined,
  };
}

function isReaction(value: unknown): value is DirectorExperienceMetadata['reaction'] {
  return value === 'love' || value === 'like' || value === 'neutral' || value === 'dislike' || value === 'hate';
}
