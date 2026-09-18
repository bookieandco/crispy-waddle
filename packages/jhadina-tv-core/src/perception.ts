import type { MediaTitle } from './index';
import type { EvidenceRef, MediaClaim, MediaKnowledge, MediaSceneEvent } from './media-intelligence';
import { buildMediaKnowledge } from './media-intelligence';
import type { MediaSource } from './source-adapter';
import { assertMediaRight } from './source-adapter';

export interface MediaPerceptionAdapter {
  transcript?(source: MediaSource): Promise<{ evidence: EvidenceRef[]; claims?: MediaClaim[]; entities?: string[] }>;
  scenes?(source: MediaSource): Promise<{ evidence: EvidenceRef[]; scenes: MediaSceneEvent[]; claims?: MediaClaim[]; entities?: string[] }>;
}

export async function perceiveAuthorizedMedia(media: MediaTitle, source: MediaSource, adapter: MediaPerceptionAdapter): Promise<MediaKnowledge> {
  assertMediaRight(source, 'ai-analysis');
  const transcript = adapter.transcript ? await adapter.transcript(source) : { evidence: [] as EvidenceRef[] };
  const scene = adapter.scenes ? await adapter.scenes(source) : { evidence: [] as EvidenceRef[], scenes: [] as MediaSceneEvent[] };
  return buildMediaKnowledge({
    media,
    evidence: [...transcript.evidence, ...scene.evidence],
    scenes: scene.scenes,
    claims: [...(transcript.claims ?? []), ...(scene.claims ?? [])],
    entities: [...(transcript.entities ?? []), ...(scene.entities ?? [])],
  });
}
