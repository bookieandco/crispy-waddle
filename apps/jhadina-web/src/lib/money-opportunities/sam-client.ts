import { getSamApiKey, getSamApiUrl } from './sam-config';

export type SamSearchParams = {
  limit?: number;
  offset?: number;
  postedFrom?: string;
  postedTo?: string;
  keyword?: string;
  noticeType?: string;
  typeOfSetAside?: string;
};

export async function searchSamOpportunities(params: SamSearchParams = {}) {
  const apiKey = getSamApiKey();
  if (!apiKey) throw new Error('SAM_GOV_API_KEY is not configured');

  const url = new URL(getSamApiUrl());
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('limit', String(Math.max(1, Math.min(params.limit ?? 25, 100))));
  url.searchParams.set('offset', String(Math.max(0, params.offset ?? 0)));
  if (params.postedFrom) url.searchParams.set('postedFrom', params.postedFrom);
  if (params.postedTo) url.searchParams.set('postedTo', params.postedTo);
  if (params.keyword) url.searchParams.set('q', params.keyword);
  if (params.noticeType) url.searchParams.set('ptype', params.noticeType);
  if (params.typeOfSetAside) url.searchParams.set('typeOfSetAside', params.typeOfSetAside);

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`SAM.gov request failed with status ${response.status}`);
  }

  return response.json();
}
