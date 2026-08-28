import type { GrowthId } from '../domain/types.js';
import type { TikTokTrendSignal } from './tiktok-distribution-bridge.js';
import type { TikTokTrendProvider, TikTokTrendQuery } from './tiktok-trend-provider.js';

export interface TikAPIFetcher {
  (input: string, init?: RequestInit): Promise<Response>;
}

interface TikAPIVideoStats {
  playCount?: number | string;
  diggCount?: number | string;
  shareCount?: number | string;
  commentCount?: number | string;
  collectCount?: number | string;
}

interface TikAPIVideo {
  id?: string | number;
  desc?: string;
  createTime?: number | string;
  stats?: TikAPIVideoStats;
  statsV2?: TikAPIVideoStats;
  textExtra?: Array<{ hashtagName?: string }>;
  challenges?: Array<{ title?: string; desc?: string }>;
}

interface TikAPIResponse {
  itemList?: TikAPIVideo[];
  nextCursor?: string | number;
  cursor?: string | number;
  hasMore?: boolean;
}

export interface TikAPITrendProviderOptions {
  apiKey: string;
  baseUrl?: string;
  country?: string;
  fetcher?: TikAPIFetcher;
  /** Optional deterministic defaults used until downstream classifiers are wired. */
  scoringDefaults?: Partial<Pick<TikTokTrendSignal, 'nicheRelevance' | 'repeatability' | 'creativeNovelty' | 'monetizationPotential' | 'productionDifficulty'>>;
}

const asNumber = (value: unknown): number | undefined => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

function extractStats(video: TikAPIVideo): Required<Pick<TikAPIVideoStats, 'playCount' | 'diggCount' | 'shareCount' | 'commentCount'>> {
  const stats = video.statsV2 ?? video.stats ?? {};
  return {
    playCount: stats.playCount ?? 0,
    diggCount: stats.diggCount ?? 0,
    shareCount: stats.shareCount ?? 0,
    commentCount: stats.commentCount ?? 0,
  };
}

function normalizeVideo(
  video: TikAPIVideo,
  observedAt: string,
  defaults: TikAPITrendProviderOptions['scoringDefaults'],
): TikTokTrendSignal {
  const stats = extractStats(video);
  const views = asNumber(stats.playCount) ?? 0;
  const likes = asNumber(stats.diggCount) ?? 0;
  const shares = asNumber(stats.shareCount) ?? 0;
  const comments = asNumber(stats.commentCount) ?? 0;
  const createdMs = asNumber(video.createTime);
  const ageHours = createdMs ? Math.max(0, (Date.parse(observedAt) - createdMs * 1000) / 3_600_000) : undefined;

  // Provider data gives us raw performance signals. Derived business scores stay
  // conservative until the classifier/evidence layers supply richer estimates.
  const engagementRate = views > 0 ? clamp(((likes + shares + comments) / views) * 100) : 0;
  const sharesRate = views > 0 ? clamp((shares / views) * 100) : 0;
  const commentsRate = views > 0 ? clamp((comments / views) * 100) : 0;
  const velocity = ageHours && ageHours > 0 ? clamp((views / ageHours) / 100) : clamp(views > 0 ? 100 : 0);
  const topic = video.challenges?.find((c) => c.title)?.title ?? video.textExtra?.find((t) => t.hashtagName)?.hashtagName ?? video.desc?.slice(0, 120) ?? 'TikTok trend';

  return {
    id: `tiktok:tikapi:${String(video.id ?? topic)}` as GrowthId,
    topic,
    observedAt: observedAt as TikTokTrendSignal['observedAt'],
    velocity,
    views,
    engagementRate,
    sharesRate,
    commentsRate,
    ageHours,
    format: 'short-video',
    hook: video.desc?.slice(0, 180),
    nicheRelevance: defaults?.nicheRelevance ?? 50,
    repeatability: defaults?.repeatability ?? 50,
    creativeNovelty: defaults?.creativeNovelty ?? 50,
    monetizationPotential: defaults?.monetizationPotential ?? 50,
    productionDifficulty: defaults?.productionDifficulty ?? 50,
    evidenceQuality: 70,
    source: 'tikapi',
    surfaceId: 'surface:tiktok' as GrowthId,
  };
}

/**
 * Concrete TikAPI implementation of the Growth Core provider boundary.
 *
 * Credentials remain outside Growth Core's domain model. The adapter only knows
 * how to call TikAPI's public discover endpoint and normalize its response.
 */
export class TikAPITrendProvider implements TikTokTrendProvider {
  readonly providerId = 'tikapi';

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly country?: string;
  private readonly fetcher: TikAPIFetcher;
  private readonly scoringDefaults: TikAPITrendProviderOptions['scoringDefaults'];

  constructor(options: TikAPITrendProviderOptions) {
    if (!options.apiKey) throw new Error('TikAPI API key is required');
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://api.tikapi.io').replace(/\/$/, '');
    this.country = options.country;
    this.fetcher = options.fetcher ?? fetch;
    this.scoringDefaults = options.scoringDefaults;
  }

  async discoverTrends(query: TikTokTrendQuery): Promise<readonly TikTokTrendSignal[]> {
    const keyword = query.topic ?? query.niche;
    if (!keyword) throw new Error('TikAPI trend discovery requires topic or niche');

    const url = new URL(`${this.baseUrl}/public/discover/v3`);
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('count', String(Math.min(Math.max(query.limit ?? 10, 1), 30)));
    if (this.country) url.searchParams.set('country', this.country);

    const response = await this.fetcher(url.toString(), {
      headers: { 'X-API-Key': this.apiKey, Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`TikAPI request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as TikAPIResponse;
    const observedAt = query.observedAt ?? new Date().toISOString();
    return (payload.itemList ?? []).map((video) => normalizeVideo(video, observedAt, this.scoringDefaults));
  }
}

export function createTikAPITrendProvider(options: TikAPITrendProviderOptions): TikAPITrendProvider {
  return new TikAPITrendProvider(options);
}
