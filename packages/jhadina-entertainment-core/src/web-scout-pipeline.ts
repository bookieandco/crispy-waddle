import type { ResearchSignal } from './cultural-ingestion.js';

export interface ScoutSearchResult { url: string; title?: string; snippet?: string; source?: string; publishedAt?: string; }
export interface ScoutPage { url: string; title?: string; text: string; publishedAt?: string; metadata?: Record<string, string>; }
export interface WebScout { search(query: string, limit?: number): Promise<ScoutSearchResult[]>; crawl(url: string): Promise<ScoutPage>; }
export interface SourceAssessment { source: string; reputation: number; corroborated: boolean; }
export interface WebScoutPipelineResult { signals: ResearchSignal[]; discovered: number; crawled: number; rejected: number; }

/** Research pipeline: discovery -> crawl -> normalization -> source assessment -> ResearchSignal. */
export class WebScoutPipeline {
  constructor(private readonly scout: WebScout) {}

  async investigate(query: string, limit = 5): Promise<WebScoutPipelineResult> {
    const results = await this.scout.search(query, Math.max(1, Math.min(20, limit)));
    const signals: ResearchSignal[] = [];
    let crawled = 0;
    let rejected = 0;
    for (const result of results) {
      try {
        const page = await this.scout.crawl(result.url);
        crawled += 1;
        const text = page.text.trim();
        if (!text || text.length < 80) { rejected += 1; continue; }
        const source = page.metadata?.source ?? result.source ?? new URL(page.url).hostname;
        signals.push({
          id: `web:${Buffer.from(page.url).toString('base64url')}`,
          topic: query,
          title: page.title ?? result.title ?? page.url,
          summary: text.slice(0, 1200),
          source,
          sourceUrl: page.url,
          observedAt: new Date().toISOString(),
          publishedAt: page.publishedAt ?? result.publishedAt,
          verification: { status: 'unverified', corroborationCount: 0 },
        });
      } catch { rejected += 1; }
    }
    return { signals, discovered: results.length, crawled, rejected };
  }
}
