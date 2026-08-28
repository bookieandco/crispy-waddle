import type { EvidenceRef, Experience, PersonalityTrait } from './types.js';

export interface MediaExperience {
  id: string;
  mediaType: 'movie' | 'show' | 'episode' | 'song' | 'book' | 'game';
  title: string;
  creator?: string;
  occurredAt: string;
  source: string;
  completion?: number;
  reaction?: 'loved' | 'liked' | 'mixed' | 'disliked' | 'unknown';
  notes?: string;
  evidence: EvidenceRef[];
}

export interface MediaLearningProposal {
  experience: MediaExperience;
  memory: {
    content: string;
    reason: string;
    evidence: EvidenceRef[];
  };
  personalityTraits: PersonalityTrait[];
}

export function mediaToExperience(media: MediaExperience): Experience {
  return {
    id: `media:${media.id}`,
    occurredAt: media.occurredAt,
    source: media.source,
    domain: 'media',
    actor: 'user',
    content: `${media.mediaType}: ${media.title}${media.reaction && media.reaction !== 'unknown' ? ` (${media.reaction})` : ''}${media.notes ? ` — ${media.notes}` : ''}`,
    evidence: media.evidence,
  };
}

export function proposeMediaLearning(media: MediaExperience): MediaLearningProposal {
  const evidence = media.evidence;
  const preferenceTrait: PersonalityTrait = {
    id: `media-preference:${media.id}`,
    statement: `The user may ${media.reaction === 'loved' || media.reaction === 'liked' ? 'enjoy' : media.reaction === 'disliked' ? 'dislike' : 'have an uncertain reaction to'} ${media.mediaType}s like "${media.title}".`,
    category: 'preference',
    confidence: media.reaction && media.reaction !== 'unknown' ? 55 : 20,
    stability: 15,
    evidence,
    contradictions: [],
    status: 'candidate',
  };

  return {
    experience: media,
    memory: {
      content: `Watched ${media.mediaType} "${media.title}"${media.reaction && media.reaction !== 'unknown' ? `; reaction: ${media.reaction}` : ''}.`,
      reason: 'Media experience may provide evidence about tastes, interests, and conversational context.',
      evidence,
    },
    personalityTraits: [preferenceTrait],
  };
}
