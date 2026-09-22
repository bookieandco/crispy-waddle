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

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))

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

  let lastStatus=0;
  for(let attempt=0;attempt<3;attempt+=1){
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    if(response.ok)return response.json() as Promise<SamSearchPage>;

    lastStatus=response.status;
    const retryable=response.status===429||response.status===408||response.status>=500;
    const retryAfter=Number(response.headers.get('retry-after')??'');
    await response.body?.cancel().catch(() => undefined);
    if(!retryable||attempt===2)break;
    const retryMs=Number.isFinite(retryAfter)&&retryAfter>0
      ? Math.min(retryAfter*1000,10_000)
      : Math.min(500*(2**attempt),2_000);
    await sleep(retryMs);
  }
  throw new Error(`SAM.gov request failed with status ${lastStatus||'unknown'}`);
}

export async function scanSamOpportunityWindow(input: Omit<SamSearchParams, 'limit'|'offset'> & {
  pageSize?: number;
  maxPages?: number;
}): Promise<{pages:number;totalRecords:number;opportunities:Array<Record<string,unknown>>;truncated:boolean}> {
  const pageSize=Math.max(1,Math.min(input.pageSize??1000,1000));
  const maxPages=Math.max(1,Math.min(input.maxPages??100,1000));
  const opportunities:Array<Record<string,unknown>>=[];
  let totalRecords=0;
  let totalRecordsKnown=false;
  let exhausted=false;
  let pages=0;
  for(let page=0;page<maxPages;page+=1){
    // SAM.gov defines offset as the page index, not a record displacement.
    const data=await searchSamOpportunities({...input,limit:pageSize,offset:page});
    const rows=Array.isArray(data.opportunitiesData)?data.opportunitiesData:[];
    if(typeof data.totalRecords==='number'){
      totalRecords=data.totalRecords;
      totalRecordsKnown=true;
    }else{
      totalRecords=Math.max(totalRecords,opportunities.length+rows.length);
    }
    opportunities.push(...rows);
    pages+=1;
    if(rows.length<pageSize){
      exhausted=true;
      break;
    }
    if(totalRecordsKnown&&opportunities.length>=totalRecords){
      exhausted=true;
      break;
    }
  }
  // If SAM omitted totalRecords and every fetched page was full, the only
  // safe conclusion at the page budget is that the window may be incomplete.
  const truncated=totalRecordsKnown?opportunities.length<totalRecords:!exhausted;
  return {pages,totalRecords,opportunities,truncated};
}
