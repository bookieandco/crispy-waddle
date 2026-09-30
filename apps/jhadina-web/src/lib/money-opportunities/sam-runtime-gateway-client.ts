import type { SupabaseClient } from '@supabase/supabase-js'
import { getGithubOidcToken } from './github-oidc-token'

const DEFAULT_GATEWAY='https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-sam-runtime-gateway'

type Filter={op:'eq'|'neq'|'in'|'gt'|'gte'|'lt'|'lte'|'is';column:string;value:unknown}
type RequestShape={
  table:string
  method?:'select'|'insert'|'upsert'|'update'
  payload?:unknown
  options?:Record<string,unknown>
  select?:string
  count?:'exact'
  head?:boolean
  filters?:Filter[]
  order?:{column:string;ascending:boolean}
  limit?:number
  resultMode?:'single'|'maybeSingle'
}
type Result={data:unknown;error:{message:string;code?:string;details?:string;hint?:string}|null;count:number|null;status:number;statusText:string}

function endpoint(){return process.env.SAM_RUNTIME_GATEWAY_URL?.trim()||DEFAULT_GATEWAY}
async function gateway(body:Record<string,unknown>){
  const oidc=await getGithubOidcToken('jhadina-sam-runtime','SAM_RUNTIME_OIDC_TOKEN')
  const response=await fetch(endpoint(),{
    method:'POST',
    headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify(body),
    cache:'no-store',
    signal:AbortSignal.timeout(60_000),
  })
  const payload=await response.json().catch(()=>({ok:false,error:'invalid_json'})) as Record<string,unknown>
  if(!response.ok||payload.ok!==true){
    throw new Error(typeof payload.error==='string'?payload.error:`SAM runtime gateway HTTP ${response.status}`)
  }
  return payload
}

export async function samRuntimeGatewayHealth(){
  return gateway({action:'health'}) as Promise<{ok:true;serviceRoleConfigured:boolean;samKeyConfigured:boolean;contract:string}>
}

export async function samRuntimeSearch(params:Record<string,unknown>){
  const payload=await gateway({action:'sam_search',params})
  return payload.data as Record<string,unknown>
}

export async function samRuntimeEntities(params:Record<string,string>){
  const payload=await gateway({action:'sam_entities',params})
  return payload.data as Record<string,unknown>
}

class Query {
  private request:RequestShape
  private promise?:Promise<Result>
  constructor(table:string){this.request={table,filters:[]}}
  select(columns='*',options?:{count?:string;head?:boolean}){
    if(!this.request.method)this.request.method='select'
    this.request.select=columns
    if(options?.count==='exact')this.request.count='exact'
    if(options?.head)this.request.head=true
    return this
  }
  insert(payload:unknown){this.request.method='insert';this.request.payload=payload;return this}
  upsert(payload:unknown,options?:Record<string,unknown>){this.request.method='upsert';this.request.payload=payload;this.request.options=options;return this}
  update(payload:unknown){this.request.method='update';this.request.payload=payload;return this}
  eq(column:string,value:unknown){return this.filter('eq',column,value)}
  neq(column:string,value:unknown){return this.filter('neq',column,value)}
  in(column:string,value:unknown[]){return this.filter('in',column,value)}
  gt(column:string,value:unknown){return this.filter('gt',column,value)}
  gte(column:string,value:unknown){return this.filter('gte',column,value)}
  lt(column:string,value:unknown){return this.filter('lt',column,value)}
  lte(column:string,value:unknown){return this.filter('lte',column,value)}
  is(column:string,value:unknown){return this.filter('is',column,value)}
  order(column:string,options?:{ascending?:boolean}){this.request.order={column,ascending:options?.ascending!==false};return this}
  limit(value:number){this.request.limit=value;return this}
  single(){this.request.resultMode='single';return this}
  maybeSingle(){this.request.resultMode='maybeSingle';return this}
  then<TResult1=Result,TResult2=never>(
    onfulfilled?:((value:Result)=>TResult1|PromiseLike<TResult1>)|null,
    onrejected?:((reason:unknown)=>TResult2|PromiseLike<TResult2>)|null,
  ){return this.execute().then(onfulfilled??undefined,onrejected??undefined)}
  private filter(op:Filter['op'],column:string,value:unknown){this.request.filters?.push({op,column,value});return this}
  private execute(){
    if(!this.promise)this.promise=(async()=>{
      try{
        const payload=await gateway({action:'db',request:this.request})
        return payload.result as Result
      }catch(error){
        return {data:null,error:{message:error instanceof Error?error.message:'SAM runtime gateway failed'},count:null,status:502,statusText:'Bad Gateway'}
      }
    })()
    return this.promise
  }
}

export function createRemoteSamSupabaseClient():SupabaseClient{
  return {from:(table:string)=>new Query(table)} as unknown as SupabaseClient
}
