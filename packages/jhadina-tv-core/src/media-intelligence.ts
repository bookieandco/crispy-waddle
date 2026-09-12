import type { MediaKind, MediaTitle, ViewingSignal } from './index';

export type EvidenceKind = 'catalog' | 'transcript' | 'subtitle' | 'scene' | 'external';
export type ClaimConfidence = 'high' | 'medium' | 'low' | 'unknown';

export interface EvidenceRef {
  readonly id: string;
  readonly kind: EvidenceKind;
  readonly sourceId: string;
  readonly observedAt: string;
  readonly locator?: string;
  readonly contentHash?: string;
  readonly confidence: ClaimConfidence;
}

export interface MediaClaim {
  readonly id: string;
  readonly mediaId: string;
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly evidenceIds: readonly string[];
  readonly confidence: ClaimConfidence;
}

export interface MediaSceneEvent {
  readonly id: string;
  readonly mediaId: string;
  readonly startSeconds: number;
  readonly endSeconds?: number;
  readonly label: string;
  readonly entities: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly confidence: ClaimConfidence;
}

export interface MediaKnowledge {
  readonly mediaId: string;
  readonly kind: MediaKind;
  readonly canonicalTitle: string;
  readonly entities: readonly string[];
  readonly claims: readonly MediaClaim[];
  readonly timeline: readonly MediaSceneEvent[];
  readonly evidence: readonly EvidenceRef[];
  readonly generatedAt: string;
}

export interface MediaPerceptionInput {
  readonly media: MediaTitle;
  readonly evidence: readonly EvidenceRef[];
  readonly scenes?: readonly MediaSceneEvent[];
  readonly claims?: readonly MediaClaim[];
  readonly entities?: readonly string[];
}

export interface MediaRecommendationContext {
  readonly query?: string;
  readonly signals?: readonly ViewingSignal[];
  readonly knowledge?: readonly MediaKnowledge[];
}

export interface MediaRecommendationExplanation {
  readonly titleId: string;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly evidenceIds: readonly string[];
}

export interface MediaIntelligenceSnapshot {
  readonly knowledge: MediaKnowledge[];
  readonly recommendations: MediaRecommendationExplanation[];
}

const normalize = (value: string): string => value.trim().toLowerCase();

export function buildMediaKnowledge(input: MediaPerceptionInput, generatedAt = new Date().toISOString()): MediaKnowledge {
  const evidence = [...input.evidence].sort((a, b) => a.id.localeCompare(b.id));
  const claims = [...(input.claims ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const timeline = [...(input.scenes ?? [])].sort((a, b) => a.startSeconds - b.startSeconds || a.id.localeCompare(b.id));
  const entities = [...new Set((input.entities ?? []).map(normalize).filter(Boolean))].sort();
  return { mediaId: input.media.id, kind: input.media.kind, canonicalTitle: input.media.title, entities, claims, timeline, evidence, generatedAt };
}

export function evidenceForClaim(claim: MediaClaim, evidence: readonly EvidenceRef[]): EvidenceRef[] {
  const ids = new Set(claim.evidenceIds);
  return evidence.filter((item) => ids.has(item.id));
}

export function explainRecommendation(title: MediaTitle, context: MediaRecommendationContext): MediaRecommendationExplanation {
  let score = 0;
  const reasons: string[] = [];
  const evidenceIds: string[] = [];
  const tokens = normalize(context.query ?? '').split(/\s+/).filter(Boolean);
  const searchable = normalize(`${title.title} ${title.overview} ${title.genres.join(' ')}`);
  const matches = tokens.filter((token) => searchable.includes(token));
  if (matches.length) { score += Math.min(45, matches.length * 15); reasons.push(`Matches your search for ${matches.join(', ')}`); }
  const related = context.signals?.find((signal) => signal.titleId === title.id);
  if (related?.liked) { score += related.kind === 'explicit-preference' ? 25 : 20; reasons.push(related.kind === 'explicit-preference' ? 'Builds on an explicit preference' : 'Builds on something you liked'); }
  const knowledge = context.knowledge?.find((item) => item.mediaId === title.id);
  if (knowledge) { score += Math.min(10, knowledge.evidence.length); if (knowledge.evidence.length) { reasons.push('Supported by indexed media evidence'); evidenceIds.push(...knowledge.evidence.map((item) => item.id)); } }
  return { titleId: title.id, score, reasons, evidenceIds: [...new Set(evidenceIds)].sort() };
}

export interface AskJhadinaMediaPort {
  recommend(context: MediaRecommendationContext, catalog: readonly MediaTitle[]): Promise<MediaRecommendationExplanation[]>;
}

export function createDeterministicMediaAdvisor(): AskJhadinaMediaPort {
  return { async recommend(context, catalog) { return catalog.map((title) => explainRecommendation(title, context)).filter((result) => result.score > 0).sort((a, b) => b.score - a.score || a.titleId.localeCompare(b.titleId)); } };
}

export interface ViewingSignalStore { record(signal: ViewingSignal): void; list(): ViewingSignal[]; }

export function createInMemoryViewingSignalStore(): ViewingSignalStore {
  const signals = new Map<string, ViewingSignal>();
  return { record(signal) { const existing = signals.get(signal.titleId); signals.set(signal.titleId, existing ? { ...existing, ...signal } : { ...signal }); }, list() { return [...signals.values()].sort((a, b) => a.titleId.localeCompare(b.titleId)); } };
}

export function createMediaIntelligenceSnapshot(knowledge: readonly MediaKnowledge[], catalog: readonly MediaTitle[], context: Omit<MediaRecommendationContext, 'knowledge'>): MediaIntelligenceSnapshot {
  const enriched = { ...context, knowledge };
  return { knowledge: [...knowledge].sort((a, b) => a.mediaId.localeCompare(b.mediaId)), recommendations: catalog.map((title) => explainRecommendation(title, enriched)).filter((result) => result.score > 0).sort((a, b) => b.score - a.score || a.titleId.localeCompare(b.titleId)) };
}
