import { getSamApiKey, getSamApiUrl } from './sam-config';

export type SamSearchParams = {
  limit?: number;
  offset?: number;
  postedFrom?: string;
  postedTo?: string;
  keyword?: string;
  noticeType?: string;
  typeOfSetAside?: string;
  solicitationNumber?: string;
  noticeId?: string;
  title?: string;
  state?: string;
  zip?: string;
  naicsCode?: string;
  classificationCode?: string;
  organizationName?: string;
};

export type SamSearchPage = {
  totalRecords?: number;
  limit?: number;
  offset?: number;
  opportunitiesData?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export async function searchSamOpportunities(params: SamSearchParams = {}): Promise<SamSearchPage> {
  const apiKey = getSamApiKey();
  if (!apiKey) throw new Error('SAM_GOV_API_KEY is not configured');

  const url = new URL(getSamApiUrl());
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('limit', String(Math.max(1, Math.min(params.limit ?? 25, 1000))));
  url.searchParams.set('offset', String(Math.max(0, params.offset ?? 0)));
  if (params.postedFrom) url.searchParams.set('postedFrom', params.postedFrom);
  if (params.postedTo) url.searchParams.set('postedTo', params.postedTo);
  if (params.keyword) url.searchParams.set('q', params.keyword);
  if (params.noticeType) url.searchParams.set('ptype', params.noticeType);
  if (params.typeOfSetAside) url.searchParams.set('typeOfSetAside', params.typeOfSetAside);
  if (params.solicitationNumber) url.searchParams.set('solnum', params.solicitationNumber);
  if (params.noticeId) url.searchParams.set('noticeid', params.noticeId);
  if (params.title) url.searchParams.set('title', params.title);
  if (params.state) url.searchParams.set('state', params.state);
  if (params.zip) url.searchParams.set('zip', params.zip);
  if (params.naicsCode) url.searchParams.set('ncode', params.naicsCode);
  if (params.classificationCode) url.searchParams.set('ccode', params.classificationCode);
  if (params.organizationName) url.searchParams.set('organizationName', params.organizationName);

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`SAM.gov request failed with status ${response.status}`);
  }

  return response.json() as Promise<SamSearchPage>;
}

export async function scanSamOpportunityWindow(input: Omit<SamSearchParams, 'limit'|'offset'> & {
  pageSize?: number;
  maxPages?: number;
}): Promise<{pages:number;totalRecords:number;opportunities:Array<Record<string,unknown>>;complete:boolean;nextOffset?:number}> {
  const pageSize=Math.max(1,Math.min(input.pageSize??1000,1000));
  const maxPages=Math.max(1,Math.min(input.maxPages??100,1000));
  const opportunities:Array<Record<string,unknown>>=[];
  let totalRecords=0;
  let pages=0;
  for(let page=0;page<maxPages;page+=1){
    const data=await searchSamOpportunities({...input,limit:pageSize,offset:page*pageSize});
    const rows=Array.isArray(data.opportunitiesData)?data.opportunitiesData:[];
    totalRecords=typeof data.totalRecords==='number'?data.totalRecords:Math.max(totalRecords,opportunities.length+rows.length);
    opportunities.push(...rows);
    pages+=1;
    if(rows.length<pageSize||opportunities.length>=totalRecords)break;
  }
  const complete=opportunities.length>=totalRecords || opportunities.length===0 || pages<maxPages;
  return {pages,totalRecords,opportunities,complete,nextOffset:complete?undefined:opportunities.length};
}
