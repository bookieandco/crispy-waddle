import type { CulturalReference, CulturalStatus } from './cultural-context.js';

export interface ResearchSignal {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  observedAt: string;
  publishedAt?: string;
  domain?: CulturalReference['domain'];
  aliases?: string[];
  relevance?: number;
  verification?: { status: 'unverified' | 'corroborated' | 'verified' | 'rejected'; corroborationCount: number; sources?: string[]; confidence?: number };
}

export interface CulturalIngestionPolicy { currentTtlHours: number; fadingAfterHours: number; minimumRelevance: number; minimumVerificationConfidence: number; }
export interface CulturalIngestionResult { reference: CulturalReference; action: 'discovered' | 'refreshed' | 'faded'; }
const clamp = (n: number) => Math.max(0, Math.min(1, n));

export class CulturalIngestion {
  constructor(private readonly policy: CulturalIngestionPolicy = { currentTtlHours: 72, fadingAfterHours: 168, minimumRelevance: 0.35, minimumVerificationConfidence: 0.35 }) {}

  ingest(signal: ResearchSignal, now = new Date().toISOString()): CulturalIngestionResult | null {
    const relevance = clamp(signal.relevance ?? 0.5);
    if (relevance < this.policy.minimumRelevance || signal.verification?.status === 'rejected') return null;
    const confidence = signal.verification?.confidence ?? 0;
    const verificationBoost = signal.verification?.status === 'verified' ? 0.15 : signal.verification?.status === 'corroborated' ? 0.08 : 0;
    const observed = Date.parse(signal.observedAt), current = Date.parse(now);
    const ageHours = Number.isFinite(observed) ? Math.max(0, current - observed) / 36e5 : Infinity;
    const status: CulturalStatus = ageHours <= this.policy.currentTtlHours ? 'current' : ageHours <= this.policy.fadingAfterHours ? 'fading' : 'unknown';
    if (status === 'current' && confidence < this.policy.minimumVerificationConfidence) return null;
    const expiresAt = Number.isFinite(observed) ? new Date(observed + this.policy.currentTtlHours * 36e5).toISOString() : undefined;
    const reference: CulturalReference = { id: `culture:${signal.id}`, label: signal.title, aliases: signal.aliases ?? [], domain: signal.domain ?? 'other', status, relevance: clamp(relevance + verificationBoost), familiarity: clamp(0.4 + verificationBoost + relevance * 0.4), lastVerifiedAt: signal.verification?.status === 'verified' || signal.verification?.status === 'corroborated' ? now : signal.observedAt, expiresAt };
    return { reference, action: status === 'current' ? 'discovered' : 'faded' };
  }
}
