import { createHash } from 'node:crypto';
import type { HttpClient } from './read-only-http-bank-adapter.js';
import type { PreciousMetalCode } from './metals-market-reality.js';

export const MONEY_METALPRICEAPI_REFERENCE_SCHEMA = 'MONEY-FINISH-06' as const;
export const METALPRICE_API_HOST = 'https://api.metalpriceapi.com' as const;
export type MetalReference = Readonly<{
  metal: PreciousMetalCode;
  baseCurrency: 'USD';
  unit: 'TROY_OUNCE';
  priceUsdPerTroyOunce: string;
  providerObservedAt: string;
  receivedAt: string;
  availableAt: string;
  observationKind: 'NON_EXECUTABLE_MIDPOINT';
  evidenceRef: string;
}>;
export type MetalReferenceSnapshot = Readonly<{
  schemaVersion: typeof MONEY_METALPRICEAPI_REFERENCE_SCHEMA;
  source: 'MetalpriceAPI';
  endpoint: 'LATEST' | 'HISTORICAL_DAY';
  entitlementEvidenceId: string;
  references: readonly MetalReference[];
  quota: Readonly<{current?:number;maximum?:number}>;
  authority: 'RESEARCH_ONLY';
  canExecute: false;
  canAuthorizeLive: false;
  provenanceHash: string;
}>;
const codes:readonly PreciousMetalCode[]=['XAU','XAG','XPT','XPD'];
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function ms(v:string,code:string):number {const t=Date.parse(v);if(!v || !Number.isFinite(t))throw new Error(code);return t;}
function finitePositive(v:unknown,code:string):number {
  if(typeof v!=='number' || !Number.isFinite(v) || v<=0)throw new Error(code);
  return v;
}
function quota(v:string|null):number|undefined {
  if(v===null)return undefined;
  if(!/^[0-9]+$/.test(v))throw new Error('MONEY_METALPRICE_QUOTA_MALFORMED');
  const n=Number(v);
  if(!Number.isSafeInteger(n))throw new Error('MONEY_METALPRICE_QUOTA_MALFORMED');
  return n;
}
export class MetalpriceApiResearchClient {
  private readonly fetchImpl:HttpClient;
  private readonly baseUrl:string;
  constructor(private readonly options: Readonly<{
    key:()=>Promise<string>|string;
    entitlementEvidenceId:string;
    fetchImpl?:HttpClient;
    baseUrl?:string;
    timeoutMs?:number;
  }>) {
    this.fetchImpl=options.fetchImpl??fetch;
    this.baseUrl=options.baseUrl??METALPRICE_API_HOST;
    const u=new URL(this.baseUrl);
    if(u.protocol!=='https:' || u.username || u.password || u.search || u.hash)throw new Error('MONEY_METALPRICE_HTTPS_OR_URL_INVALID');
  }
  async readReference(input:Readonly<{
    receivedAt:string;
    maxAgeMs:number;
    metals:readonly PreciousMetalCode[];
    historicalDate?:string;
  }>):Promise<MetalReferenceSnapshot> {
    if(!this.options.entitlementEvidenceId.trim())throw new Error('MONEY_METALPRICE_LICENSE_NOT_VERIFIED');
    const received=ms(input.receivedAt,'MONEY_METALPRICE_RECEIPT_INVALID');
    if(!Number.isSafeInteger(input.maxAgeMs) || input.maxAgeMs<=0)throw new Error('MONEY_METALPRICE_AGE_POLICY_INVALID');
    if(!input.metals.length || new Set(input.metals).size!==input.metals.length ||
        input.metals.some(m=>!codes.includes(m)))throw new Error('MONEY_METALPRICE_METALS_INVALID');
    if(input.historicalDate && (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input.historicalDate) ||
        !Number.isFinite(Date.parse(input.historicalDate+'T00:00:00Z')) ||
        Date.parse(input.historicalDate+'T00:00:00Z')>received))throw new Error('MONEY_METALPRICE_HISTORICAL_DATE_INVALID');
    const key=await this.options.key();
    if(!key?.trim())throw new Error('MONEY_METALPRICE_API_KEY_MISSING');
    const url=new URL('/v1/'+(input.historicalDate??'latest'),this.baseUrl);
    url.searchParams.set('base','USD');
    url.searchParams.set('currencies',input.metals.join(','));
    const abort=new AbortController();
    const timeout=setTimeout(()=>abort.abort(),this.options.timeoutMs??10000);
    try {
      const response=await this.fetchImpl(url,{method:'GET',headers:{
        Accept:'application/json','X-API-KEY':key},signal:abort.signal});
      if(!response.ok)throw new Error('MONEY_METALPRICE_HTTP_'+response.status);
      const current=quota(response.headers.get('X-API-CURRENT'));
      const maximum=quota(response.headers.get('X-API-QUOTA'));
      if(current!==undefined && maximum!==undefined && current>maximum)throw new Error('MONEY_METALPRICE_QUOTA_EXCEEDED');
      const payload:unknown=await response.json();
      if(!payload || typeof payload!=='object')throw new Error('MONEY_METALPRICE_PAYLOAD_INVALID');
      const obj=payload as Record<string,unknown>;
      if(obj.success!==true || obj.base!=='USD' || !obj.rates || typeof obj.rates!=='object') {
        throw new Error('MONEY_METALPRICE_PROVIDER_RESPONSE_INVALID');
      }
      const timestamp=finitePositive(obj.timestamp,'MONEY_METALPRICE_TIMESTAMP_INVALID');
      if(!Number.isSafeInteger(timestamp))throw new Error('MONEY_METALPRICE_TIMESTAMP_INVALID');
      const observed=new Date(timestamp*1000).toISOString();
      if(ms(observed,'MONEY_METALPRICE_OBSERVED_INVALID')>received)throw new Error('MONEY_METALPRICE_FUTURE_OBSERVATION');
      if(received-Date.parse(observed)>input.maxAgeMs)throw new Error('MONEY_METALPRICE_STALE');
      const rates=obj.rates as Record<string,unknown>;
      const refs=input.metals.map(m=>{
        const raw=finitePositive(rates[m],'MONEY_METALPRICE_MISSING_METAL_RATE');
        const reciprocal=1/raw;
        const providerInverse=rates['USD'+m];
        if(providerInverse!==undefined) {
          const inverse=finitePositive(providerInverse,'MONEY_METALPRICE_INVERSE_INVALID');
          if(Math.abs(inverse-reciprocal)/reciprocal>0.01)throw new Error('MONEY_METALPRICE_RECIPROCAL_CONFLICT');
        }
        if(!Number.isFinite(reciprocal))throw new Error('MONEY_METALPRICE_RECIPROCAL_INVALID');
        return Object.freeze({
          metal:m,baseCurrency:'USD' as const,unit:'TROY_OUNCE' as const,
          priceUsdPerTroyOunce:String(reciprocal),providerObservedAt:observed,
          // Research replay MUST NOT pretend a freshly fetched historical bar was
          // available historically without separately archived point-in-time evidence.
          availableAt:input.receivedAt,receivedAt:input.receivedAt,
          observationKind:'NON_EXECUTABLE_MIDPOINT' as const,
          evidenceRef:'metalpriceapi:'+sha({m,raw,providerInverse,observed,date:input.historicalDate??null})
        });
      });
      return Object.freeze({schemaVersion:MONEY_METALPRICEAPI_REFERENCE_SCHEMA,source:'MetalpriceAPI',
        endpoint:input.historicalDate?'HISTORICAL_DAY':'LATEST',
        entitlementEvidenceId:this.options.entitlementEvidenceId,
        references:Object.freeze(refs),quota:Object.freeze({current,maximum}),
        authority:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false,
        provenanceHash:sha({endpoint:input.historicalDate??'latest',observed,refs,entitlement:this.options.entitlementEvidenceId})
      });
    } finally{clearTimeout(timeout);}
  }
}
