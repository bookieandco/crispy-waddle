import { getSamApiKey, getSamApiUrl } from './sam-config';

export interface SamOpportunityRaw {
  noticeId?: string;
  title?: string;
  solicitationNumber?: string;
  fullParentPathName?: string;
  department?: string;
  subtier?: string;
  office?: string;
  postedDate?: string;
  responseDeadLine?: string;
  type?: string;
  baseType?: string;
  archiveDate?: string;
  naicsCode?: string;
  classificationCode?: string;
  active?: string;
  description?: string;
  uiLink?: string;
  placeOfPerformance?: unknown;
  [key: string]: unknown;
}

export interface SamSearchResponse {
  totalRecords?: number;
  opportunitiesData?: SamOpportunityRaw[];
}

export interface SamSearchParams {
  limit?: number;
  offset?: number;
  postedFrom?: string;
  postedTo?: string;
  noticeType?: string;
  keyword?: string;
  naics?: string;
  state?: string;
}

export async function searchSamOpportunities(
  params: SamSearchParams = {},
): Promise<SamSearchResponse> {
  const apiKey = getSamApiKey();
  if (!apiKey) {
    throw new Error('SAM_GOV_API_KEY is not configured on the server.');
  }

  const url = new URL(getSamApiUrl());
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('limit', String(Math.min(Math.max(params.limit ?? 25, 1), 1000)));
  url.searchParams.set('offset', String(Math.max(params.offset ?? 0, 0)));

  if (params.postedFrom) url.searchParams.set('postedFrom', params.postedFrom);
  if (params.postedTo) url.searchParams.set('postedTo', params.postedTo);
  if (params.noticeType) url.searchParams.set('ptype', params.noticeType);
  if (params.keyword) url.searchParams.set('q', params.keyword);
  if (params.naics) url.searchParams.set('ncode', params.naics);
  if (params.state) url.searchParams.set('state', params.state);

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`SAM.gov request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  return (await response.json()) as SamSearchResponse;
}
