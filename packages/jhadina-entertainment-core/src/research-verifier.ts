import type { ResearchSignal } from './cultural-ingestion.js';

export interface VerificationSource { id: string; fetch(url: string): Promise<ResearchSignal | null>; reputation: number; }
export interface VerifiedResearch extends ResearchSignal { verification: { status: 'verified' | 'corroborated' | 'unverified' | 'rejected'; corroborationCount: number; sources: string[]; confidence: number }; }

/** Conservative verifier: discovery never becomes trusted merely because a page was crawled. */
export class ResearchVerifier {
  constructor(private readonly sources: VerificationSource[] = []) {}

  async verify(signal: ResearchSignal): Promise<VerifiedResearch> {
    const corroborating: string[] = [];
    for (const source of this.sources) {
      try {
        const candidate = await source.fetch(signal.sourceUrl);
        if (candidate && candidate.summary.trim()) corroborating.push(source.id);
      } catch { /* one verifier failure must not fail the research job */ }
    }
    const count = corroborating.length;
    const confidence = Math.min(1, 0.35 + count * 0.2);
    const status = count >= 2 ? 'verified' : count === 1 ? 'corroborated' : 'unverified';
    return { ...signal, verification: { status, corroborationCount: count, sources: corroborating, confidence } };
  }
}
