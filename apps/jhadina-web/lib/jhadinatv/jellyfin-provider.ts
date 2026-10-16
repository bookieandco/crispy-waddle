import type {
  AuthorizedCatalogClient,
  AuthorizedCatalogRecord,
  LiveChannel,
  LiveChannelProvider,
  LiveProgram,
  MediaRight,
  MediaSource,
  MediaSourceAuthorization,
  MediaTitle,
} from '@jhadina/tv-core';

const PROVIDER_ID = 'jellyfin';

interface JellyfinConfig {
  serverUrl: string;
  apiKey: string;
  userId: string;
  publicOrigin: string;
  rightsEvidenceIds: string[];
  rights: MediaRight[];
  territories?: string[];
  liveStreamPathTemplate: string;
  vodStreamPathTemplate: string;
}

interface JellyfinItem {
  Id?: string;
  Name?: string;
  Type?: string;
  Overview?: string;
  ProductionYear?: number;
  Genres?: string[];
  RunTimeTicks?: number;
  ChannelNumber?: string;
  ChannelType?: string;
  Country?: string;
  Language?: string;
  SeriesName?: string;
  StartDate?: string;
  EndDate?: string;
  ChannelId?: string;
}

interface JellyfinQueryResult {
  Items?: JellyfinItem[];
}

const VALID_RIGHTS: readonly MediaRight[] = [
  'playback',
  'casting',
  'download',
  'transcription',
  'subtitle-processing',
  'ai-analysis',
  'scene-extraction',
  'clipping',
  'transformation',
  'republication',
  'commercial-use',
];

function list(value: string | undefined): string[] {
  return (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

function mediaRights(value: string | undefined): MediaRight[] {
  const valid = new Set<string>(VALID_RIGHTS);
  return list(value).filter((right): right is MediaRight => valid.has(right));
}

function productionOrigin(): string {
  const explicit = process.env.JHADINA_PUBLIC_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  return vercel ? `https://${vercel.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : '';
}

export interface JellyfinAdmissionStatus {
  configured: boolean;
  admitted: boolean;
  providerId: string;
  missing: string[];
  rights: MediaRight[];
  rightsEvidenceCount: number;
}

export function getJellyfinAdmissionStatus(): JellyfinAdmissionStatus {
  const serverUrl = process.env.JHADINA_TV_JELLYFIN_URL?.trim() ?? '';
  const apiKey = process.env.JHADINA_TV_JELLYFIN_API_KEY?.trim() ?? '';
  const userId = process.env.JHADINA_TV_JELLYFIN_USER_ID?.trim() ?? '';
  const publicOrigin = productionOrigin();
  const rightsEvidenceIds = list(process.env.JHADINA_TV_JELLYFIN_RIGHTS_EVIDENCE_IDS);
  const rights = mediaRights(process.env.JHADINA_TV_JELLYFIN_RIGHTS);
  const missing: string[] = [];

  if (!serverUrl) missing.push('JHADINA_TV_JELLYFIN_URL');
  else {
    try {
      if (new URL(serverUrl).protocol !== 'https:') missing.push('JHADINA_TV_JELLYFIN_URL(https-required)');
    } catch {
      missing.push('JHADINA_TV_JELLYFIN_URL(valid-url-required)');
    }
  }
  if (!apiKey) missing.push('JHADINA_TV_JELLYFIN_API_KEY');
  if (!userId) missing.push('JHADINA_TV_JELLYFIN_USER_ID');
  if (!publicOrigin) missing.push('JHADINA_PUBLIC_ORIGIN');
  else {
    try {
      if (new URL(publicOrigin).protocol !== 'https:') missing.push('JHADINA_PUBLIC_ORIGIN(https-required)');
    } catch {
      missing.push('JHADINA_PUBLIC_ORIGIN(valid-url-required)');
    }
  }
  if (!rights.includes('playback')) missing.push('JHADINA_TV_JELLYFIN_RIGHTS(playback-required)');
  if (!rightsEvidenceIds.length) missing.push('JHADINA_TV_JELLYFIN_RIGHTS_EVIDENCE_IDS');

  return {
    configured: Boolean(serverUrl && apiKey && userId && publicOrigin),
    admitted: missing.length === 0,
    providerId: PROVIDER_ID,
    missing,
    rights,
    rightsEvidenceCount: rightsEvidenceIds.length,
  };
}

function configFromEnvironment(): JellyfinConfig | null {
  const status = getJellyfinAdmissionStatus();
  if (!status.admitted) return null;
  return {
    serverUrl: process.env.JHADINA_TV_JELLYFIN_URL!.trim().replace(/\/$/, ''),
    apiKey: process.env.JHADINA_TV_JELLYFIN_API_KEY!.trim(),
    userId: process.env.JHADINA_TV_JELLYFIN_USER_ID!.trim(),
    publicOrigin: productionOrigin(),
    rightsEvidenceIds: list(process.env.JHADINA_TV_JELLYFIN_RIGHTS_EVIDENCE_IDS),
    rights: mediaRights(process.env.JHADINA_TV_JELLYFIN_RIGHTS),
    territories: list(process.env.JHADINA_TV_JELLYFIN_TERRITORIES),
    liveStreamPathTemplate: process.env.JHADINA_TV_JELLYFIN_LIVE_STREAM_PATH_TEMPLATE?.trim() || '/LiveTv/Channels/{id}/stream',
    vodStreamPathTemplate: process.env.JHADINA_TV_JELLYFIN_VOD_STREAM_PATH_TEMPLATE?.trim() || '/Videos/{id}/stream',
  };
}

function authorization(config: JellyfinConfig): MediaSourceAuthorization {
  return {
    status: 'authorized',
    territories: config.territories?.length ? config.territories : undefined,
    rightsEvidenceIds: config.rightsEvidenceIds,
    rights: config.rights,
  };
}

function stripMediaPrefix(mediaId: string): { id: string; mode: 'live' | 'vod' } {
  if (mediaId.startsWith('jellyfin-live:')) return { id: mediaId.slice('jellyfin-live:'.length), mode: 'live' };
  if (mediaId.startsWith('jellyfin:')) return { id: mediaId.slice('jellyfin:'.length), mode: 'vod' };
  return { id: mediaId, mode: 'vod' };
}

function itemToRecord(item: JellyfinItem): AuthorizedCatalogRecord | null {
  if (!item.Id || !item.Name) return null;
  const kind = item.Type === 'Movie' ? 'movie' : 'tv';
  return {
    id: `jellyfin:${item.Id}`,
    kind,
    title: item.Name,
    overview: item.Overview ?? '',
    year: item.ProductionYear ?? 0,
    genres: item.Genres ?? [],
    runtimeMinutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600_000_000) : undefined,
    availability: 'licensed',
  };
}

function channelToRecord(channel: LiveChannel): AuthorizedCatalogRecord {
  return {
    id: channel.mediaId,
    kind: 'tv',
    title: channel.name,
    overview: channel.group ? `Live TV · ${channel.group}` : 'Live TV channel',
    year: new Date().getUTCFullYear(),
    genres: ['Live TV', ...(channel.group ? [channel.group] : [])],
    availability: 'licensed',
  };
}

function encodeQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, value);
  const query = search.toString();
  return query ? `?${query}` : '';
}

class JellyfinAuthorizedProvider implements AuthorizedCatalogClient, LiveChannelProvider {
  readonly id = PROVIDER_ID;
  readonly name = 'Jellyfin';

  constructor(private readonly config: JellyfinConfig) {}

  private async get<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T> {
    const response = await fetch(`${this.config.serverUrl}${path}${encodeQuery(params)}`, {
      headers: {
        Accept: 'application/json',
        'X-Emby-Token': this.config.apiKey,
      },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Jellyfin request failed (${response.status}) for ${path}`);
    return response.json() as Promise<T>;
  }

  async search(query: string): Promise<AuthorizedCatalogRecord[]> {
    const response = await this.get<JellyfinQueryResult>('/Items', {
      UserId: this.config.userId,
      SearchTerm: query || undefined,
      IncludeItemTypes: 'Movie,Series,Episode',
      Recursive: 'true',
      EnableUserData: 'true',
      Fields: 'Overview,Genres,ProductionYear,RunTimeTicks',
      Limit: '100',
    });
    const library = (response.Items ?? []).map(itemToRecord).filter((item): item is AuthorizedCatalogRecord => Boolean(item));
    const needle = query.trim().toLowerCase();
    const live = (await this.listChannels())
      .filter((channel) => !needle || channel.mediaId.toLowerCase() === needle || channel.name.toLowerCase().includes(needle))
      .map(channelToRecord);
    return [...library, ...live];
  }

  async sources(mediaId: string): Promise<MediaSource[]> {
    const { id, mode } = stripMediaPrefix(mediaId);
    if (!id.trim()) return [];
    const sourceUrl = new URL('/api/jhadinatv/jellyfin/stream', this.config.publicOrigin);
    sourceUrl.searchParams.set('id', id);
    sourceUrl.searchParams.set('mode', mode);
    return [{
      id: `jellyfin:${mode}:${id}`,
      titleId: mediaId,
      kind: 'external',
      url: sourceUrl.toString(),
      label: mode === 'live' ? 'Jellyfin Live TV' : 'Jellyfin',
      authorization: authorization(this.config),
    }];
  }

  async listChannels(): Promise<LiveChannel[]> {
    const response = await this.get<JellyfinQueryResult>('/LiveTv/Channels', {
      UserId: this.config.userId,
      AddCurrentProgram: 'true',
      EnableUserData: 'true',
    });
    return (response.Items ?? [])
      .filter((item): item is JellyfinItem & { Id: string; Name: string } => Boolean(item.Id && item.Name))
      .map((item) => ({
        id: `jellyfin-live:${item.Id}`,
        providerId: PROVIDER_ID,
        providerChannelId: item.Id,
        mediaId: `jellyfin-live:${item.Id}`,
        name: item.Name,
        kind: 'broadcast' as const,
        group: item.ChannelType,
        country: item.Country,
        language: item.Language,
        channelNumber: item.ChannelNumber,
        tvgId: item.Id,
        tvgName: item.Name,
        provenance: 'jellyfin' as const,
      }));
  }

  async getPrograms(channelId: string, from?: string, to?: string): Promise<LiveProgram[]> {
    return this.getProgramsForChannels([channelId], from, to);
  }

  async getProgramsForChannels(channelIds: string[], from?: string, to?: string): Promise<LiveProgram[]> {
    const rawIds = channelIds.map((id) => stripMediaPrefix(id).id).filter(Boolean);
    if (!rawIds.length) return [];
    const response = await this.get<JellyfinQueryResult>('/LiveTv/Programs', {
      UserId: this.config.userId,
      ChannelIds: rawIds.join(','),
      MinStartDate: from,
      MaxEndDate: to,
      EnableTotalRecordCount: 'false',
      Limit: '5000',
    });
    return (response.Items ?? [])
      .filter((item): item is JellyfinItem & { Id: string; Name: string; StartDate: string; EndDate: string } =>
        Boolean(item.Id && item.Name && item.StartDate && item.EndDate),
      )
      .map((item) => ({
        id: `jellyfin-program:${item.Id}`,
        channelId: `jellyfin-live:${item.ChannelId ?? rawIds[0]}`,
        title: item.Name,
        description: item.Overview,
        startTime: item.StartDate,
        endTime: item.EndDate,
        episodeTitle: item.SeriesName ? item.Name : undefined,
        category: item.Genres?.[0],
      }));
  }
}

export interface JellyfinProviderBundle {
  catalogClient: AuthorizedCatalogClient;
  liveProvider: LiveChannelProvider;
}

export function createJellyfinProviderBundle(): JellyfinProviderBundle | null {
  const config = configFromEnvironment();
  if (!config) return null;
  const provider = new JellyfinAuthorizedProvider(config);
  return { catalogClient: provider, liveProvider: provider };
}

export function getJellyfinProxyConfig(): Pick<JellyfinConfig, 'serverUrl' | 'apiKey' | 'userId' | 'rights' | 'rightsEvidenceIds' | 'territories' | 'liveStreamPathTemplate' | 'vodStreamPathTemplate'> | null {
  const config = configFromEnvironment();
  if (!config) return null;
  return {
    serverUrl: config.serverUrl,
    apiKey: config.apiKey,
    userId: config.userId,
    rights: config.rights,
    rightsEvidenceIds: config.rightsEvidenceIds,
    territories: config.territories,
    liveStreamPathTemplate: config.liveStreamPathTemplate,
    vodStreamPathTemplate: config.vodStreamPathTemplate,
  };
}

/**
 * Exact, owner-gated title resolution. Never treat opaque Jellyfin item IDs as
 * free-text search strings. No media is exposed without configured admission.
 */
export async function getAuthorizedJellyfinTitle(mediaId: string, kind: 'movie' | 'tv'): Promise<MediaTitle | null> {
  const config = configFromEnvironment();
  if (!config || !/^jellyfin(?:-live)?:[A-Za-z0-9._:-]{1,160}$/.test(mediaId)) return null;
  const { id, mode } = stripMediaPrefix(mediaId);
  try {
    let record: AuthorizedCatalogRecord | null = null;
    const provider = new JellyfinAuthorizedProvider(config);
    if (mode === 'live') {
      const channel = (await provider.listChannels()).find(item => item.mediaId === mediaId);
      if (channel) record = channelToRecord(channel);
    } else {
      const base = new URL(config.serverUrl);
      if (base.protocol !== 'https:') return null;
      const prefix = base.pathname.replace(/\/$/, '');
      const url = new URL(`${prefix}/Users/${encodeURIComponent(config.userId)}/Items/${encodeURIComponent(id)}`, base.origin);
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'X-Emby-Token': config.apiKey },
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return null;
      const item = await response.json() as JellyfinItem;
      if (item.Id !== id || !['Movie', 'Series', 'Episode'].includes(item.Type ?? '')) return null;
      record = itemToRecord(item);
    }
    if (!record || record.kind !== kind || record.id !== mediaId) return null;
    return {
      id: record.id, kind: record.kind, title: record.title,
      overview: record.overview, year: record.year,
      genres: record.genres ?? [], runtimeMinutes: record.runtimeMinutes,
      availability: record.availability, providerId: 'jellyfin',
    };
  } catch { return null; }
}
