export type SourceRole = 'discovery' | 'community' | 'retrieval' | 'verification' | 'memory';

export interface ResearchSourceProfile {
  id: string;
  name: string;
  roles: SourceRole[];
  strengths: string[];
  limitations: string[];
  trustClass: 'primary' | 'secondary' | 'community' | 'infrastructure';
  requiresCaution: boolean;
}

/** Curated source guidance: discovery tools find evidence; they do not become evidence merely by being trusted. */
export const JHADINA_RESEARCH_SOURCES: readonly ResearchSourceProfile[] = [
  {
    id: 'reddit-praw', name: 'PRAW / Reddit', roles: ['community', 'discovery'],
    strengths: ['community sentiment', 'emerging slang', 'lived experience', 'fast-moving cultural discussion'],
    limitations: ['anecdotal', 'community-specific bias', 'not authoritative for factual claims'],
    trustClass: 'community', requiresCaution: true,
  },
  {
    id: 'qdrant', name: 'Qdrant', roles: ['retrieval', 'memory'],
    strengths: ['semantic retrieval', 'hybrid search', 'metadata filtering', 'evidence recall'],
    limitations: ['retrieval infrastructure is not a source of truth', 'quality depends on indexed material'],
    trustClass: 'infrastructure', requiresCaution: true,
  },
  {
    id: 'scira', name: 'Scira', roles: ['discovery', 'verification'],
    strengths: ['multi-query web research', 'source discovery', 'cross-checking', 'citation-oriented retrieval'],
    limitations: ['search results require source-level verification', 'aggregator output is not itself authoritative'],
    trustClass: 'secondary', requiresCaution: true,
  },
];

export function researchSourceProfile(id: string): ResearchSourceProfile | undefined {
  return JHADINA_RESEARCH_SOURCES.find(source => source.id === id);
}
