import type { ResearchSignal } from './cultural-ingestion.js';
import { JHADINA_RESEARCH_SOURCES, type ResearchSourceProfile, type SourceRole, type ResearchIntent } from '@jhadina/core-spine';
import type { ResearchSourcePerformanceStore } from '@jhadina/core-spine';

export interface ScoutSearchResult { url: string; title?: string; snippet?: string; source?: string; publishedAt?: string; }
export interface ScoutPage { url: string; title?: string; text: string; publishedAt?: string; metadata?: Record<string, string>; }
export interface WebScout { search(query: string, limit?: number): Promise<ScoutSearchResult[]>; crawl(url: string): Promise<ScoutPage>; }
export interface SourceAssessment { source: string; reputation: number; corroborated: boolean; role?: SourceRole; matchedProfile?: string; }
export interface WebScoutPipelineResult { signals: ResearchSignal[]; discovered: number; crawled: number; rejected: number; sourceAssessments: SourceAssessment[]; selectedSources: string[]; }
export interface ResearchSourceSelection { profile: ResearchSourceProfile; score: number; }

/**
 * Adaptive planner. Relevance + source role + learned performance determine routing.
 * Exploration is intentionally preserved so weak-history sources can be tested again.
 */
export function selectResearchSources(
  intentOrQuery: ResearchIntent | string,
  performance?: ResearchSourcePerformanceStore,
  explorationRate = 0.15,
): ResearchSourceSelection[] {
  const intent: ResearchIntent = typeof intentOrQuery === 'string'
    ? { query: intentOrQuery, kinds: [], primary: 'factual', freshnessRequired: /today|latest|current|recent|news|now/.test(intentOrQuery.toLowerCase()), communitySignalUseful: /trend|meme|slang|reddit|community|sentiment/.test(intentOrQuery.toLowerCase()), storedEvidenceUseful: /remember|previous|stored|our knowledge|history|evidence/.test(intentOrQuery.toLowerCase()), primarySourcesPreferred: true, verificationRequired: true, confidence: 0.5 }
    : intentOrQuery;

  const selections = JHADINA_RESEARCH_SOURCES.map(profile => {
    let relevance = 0;
    if (intent.freshnessRequired && profile.roles.includes('discovery')) relevance += 4;
    if (intent.communitySignalUseful && profile.roles.includes('community')) relevance += 5;
    if (intent.storedEvidenceUseful && (profile.roles.includes('retrieval') || profile.roles.includes('memory'))) relevance += 5;
    if (intent.primarySourcesPreferred && profile.roles.includes('verification')) relevance += 3;
    if (profile.roles.includes('discovery')) relevance += 1;
    if (profile.requiresCaution) relevance -= 0.25;

    const learned = performance?.get(profile.id)?.score ?? 0;
    const exploitation = Math.max(-2, Math.min(4, learned));
    const unexplored = performance?.get(profile.id) === undefined;
    const explorationBonus = unexplored ? 1.5 : explorationRate * (1 + Math.max(0, 2 - learned));
    return { profile, score: relevance + exploitation + explorationBonus };
  });

  return selections.sort((a, b) => b.score - a.score);
}

function hostMatchesProfile(host: string, profile: ResearchSourceProfile): boolean {
  const id = profile.id;
  return (id === 'reddit-praw' && (host === 'reddit.com' || host.endsWith('.reddit.com'))) ||
    (id === 'qdrant' && (host === 'qdrant.tech' || host.endsWith('.qdrant.tech'))) ||
    (id === 'scira' && (host === 'scira.ai' || host.endsWith('.scira.ai')));
}

/** Discovery -> crawl -> source weighting -> normalization. Verification remains downstream. */
export class WebScoutPipeline {
  constructor(private readonly scout: WebScout, private readonly performance?: ResearchSourcePerformanceStore, private readonly intentClassifier?: { classify(query: string): ResearchIntent }) {}

  async investigate(query: string, limit = 5): Promise<WebScoutPipelineResult> {
    const intent = this.intentClassifier?.classify(query);
    const rankedSources = selectResearchSources(intent ?? query, this.performance);
    const results = await this.scout.search(query, Math.max(1, Math.min(20, limit)));
    const assessments: SourceAssessment[] = [];
    const signals: ResearchSignal[] = [];
    let crawled = 0;
    let rejected = 0;
    const rankedResults = [...results].sort((a, b) => this.sourceScore(b, rankedSources) - this.sourceScore(a, rankedSources));
    for (const result of rankedResults) {
      try {
        const page = await this.scout.crawl(result.url);
        crawled += 1;
        const text = page.text.trim();
        if (!text || text.length < 80) { rejected += 1; continue; }
        const host = new URL(page.url).hostname;
        const match = rankedSources.find(({ profile }) => hostMatchesProfile(host, profile));
        const score = this.sourceScore(result, rankedSources);
        assessments.push({ source: host, reputation: score, corroborated: false, role: match?.profile.roles[0], matchedProfile: match?.profile.id });
        const source = page.metadata?.source ?? result.source ?? host;
        signals.push({ id: `web:${Buffer.from(page.url).toString('base64url')}`, topic: query, title: page.title ?? result.title ?? page.url, summary: text.slice(0, 1200), source, sourceUrl: page.url, observedAt: new Date().toISOString(), publishedAt: page.publishedAt ?? result.publishedAt, verification: { status: 'unverified', corroborationCount: 0 } });
      } catch { rejected += 1; }
    }
    return { signals, discovered: results.length, crawled, rejected, sourceAssessments: assessments, selectedSources: rankedSources.slice(0, 3).map(({ profile }) => profile.id) };
  }

  private sourceScore(result: ScoutSearchResult, rankedSources: ResearchSourceSelection[]): number {
    const host = (() => { try { return new URL(result.url).hostname; } catch { return ''; } })();
    return rankedSources.find(({ profile }) => hostMatchesProfile(host, profile))?.score ?? 0;
  }
}
