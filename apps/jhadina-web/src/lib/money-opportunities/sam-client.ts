import { getSamApiKey, getSamApiUrl } from './sam-config';
import type { SamNoticeType, SamOpportunity } from './sam-types';

export type SamSearchParams = {
  limit?: number;
  offset?: number;
  postedFrom?: string;
  postedTo?: string;
  keyword?: string;
  noticeType?: string;
  typeOfSetAside?: string;
};

type SamPayload = {
  opportunitiesData?: Array<Record<string, unknown>>;
  totalRecords?: number;
};

const stringValue = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const numberValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
};

function normalizeNoticeType(value: unknown): SamNoticeType {
  const raw = String(value ?? '').toUpperCase();
  if (raw.includes('SOLICITATION') || raw.includes('COMBINED SYNOPSIS')) return 'SOLICITATION';
  if (raw.includes('SOURCES SOUGHT') || raw.includes('REQUEST FOR INFORMATION')) return 'SOURCES_SOUGHT';
  if (raw.includes('SPECIAL NOTICE')) return 'SPECIAL_NOTICE';
  if (raw.includes('PRESOLICITATION')) return 'PRESOLICITATION';
  if (raw.includes('AWARD')) return 'AWARD_NOTICE';
  return 'OTHER';
}

function normalize(item: Record<string, unknown>): SamOpportunity {
  return {
    noticeId: stringValue(item.noticeId) ?? stringValue(item.noticeIdNumber) ?? stringValue(item.solicitationNumber) ?? '',
    title: stringValue(item.title) ?? stringValue(item.subject) ?? 'Untitled SAM.gov opportunity',
    noticeType: normalizeNoticeType(item.type ?? item.noticeType),
    agency: stringValue(item.fullParentPathName) ?? stringValue(item.departmentIndAgency) ?? stringValue(item.agency),
    office: stringValue(item.officeAddress) ?? stringValue(item.office),
    postedDate: stringValue(item.postedDate) ?? stringValue(item.publishDate),
    responseDeadline: stringValue(item.responseDeadLine) ?? stringValue(item.responseDeadline),
    naics: stringValue(item.naicsCode) ?? stringValue(item.naics),
    setAside: stringValue(item.typeOfSetAsideDescription) ?? stringValue(item.typeOfSetAside),
    placeOfPerformance: stringValue(item.placeOfPerformance) ?? stringValue(item.placeOfPerformanceCityName),
    estimatedValue: numberValue(item.awardAmount) ?? numberValue(item.estimatedValue),
    description: stringValue(item.description),
    sourceUrl: stringValue(item.uiLink) ?? stringValue(item.link),
  };
}

export async function searchSamOpportunities(params: SamSearchParams = {}): Promise<{ opportunities: SamOpportunity[]; totalRecords?: number }> {
  const apiKey = getSamApiKey();
  if (!apiKey) throw new Error('SAM_GOV_API_KEY is not configured');

  const url = new URL(getSamApiUrl());
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('limit', String(Math.min(Math.max(params.limit ?? 25, 1), 100)));
  url.searchParams.set('offset', String(Math.max(params.offset ?? 0, 0)));
  if (params.postedFrom) url.searchParams.set('postedFrom', params.postedFrom);
  if (params.postedTo) url.searchParams.set('postedTo', params.postedTo);
  if (params.keyword) url.searchParams.set('q', params.keyword);
  if (params.noticeType) url.searchParams.set('ptype', params.noticeType);
  if (params.typeOfSetAside) url.searchParams.set('typeOfSetAside', params.typeOfSetAside);

  const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`SAM.gov request failed (${response.status}): ${detail.slice(0, 500)}`);
  }

  const payload = await response.json() as SamPayload;
  const opportunities = (payload.opportunitiesData ?? []).map(normalize).filter((item) => item.noticeId);
  return { opportunities, totalRecords: payload.totalRecords };
}
