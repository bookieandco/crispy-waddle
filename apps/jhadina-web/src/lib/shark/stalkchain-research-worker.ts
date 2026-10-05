import type {SupabaseClient} from '@supabase/supabase-js'
import {
  createStalkChainReadOnlyProvider,
  probeStalkChainProvider,
  runStalkChainTraderResearch,
  type StalkChainProviderAdmission,
  type StalkChainResearchBrief,
} from '@jhadina/shark-intelligence-core/meme-trader'

export type StalkChainProviderAdmissionResult=StalkChainProviderAdmission

export type StalkChainResearchWorkerResult=Readonly<{
  briefId:string
  generatedAt:string
  leaderboardWindow:'24h'|'7d'|'30d'|'all'
  traders:number
  emerging:number
  failures:number
  disposition:'INSERTED'|'REPLAY'
  providerCreditsRemaining?:number
  authority:'READ_ONLY_RESEARCH'
  canAuthorizeTrade:false
  canExecute:false
  canSign:false
  canBroadcast:false
}>

const windowValue=(value:string|undefined):'24h'|'7d'|'30d'|'all'=> {
  if(value===undefined||value==='')return '7d'
  if(value==='24h'||value==='7d'||value==='30d'||value==='all')return value
  throw new Error('SHARK_STALKCHAIN_WINDOW_INVALID')
}
const intValue=(value:string|undefined,fallback:number,min:number,max:number,code:string):number=>{
  if(value===undefined||value==='')return fallback
  const parsed=Number(value)
  if(!Number.isInteger(parsed)||parsed<min||parsed>max)throw new Error(code)
  return parsed
}
const boolValue=(value:string|undefined,fallback:boolean):boolean=>{
  if(value===undefined||value==='')return fallback
  if(value==='true'||value==='1')return true
  if(value==='false'||value==='0')return false
  throw new Error('SHARK_STALKCHAIN_BOOLEAN_INVALID')
}
const sortedUnique=(values:readonly string[])=>[...new Set(values.filter(Boolean))].sort()

export async function appendStalkChainResearchBrief(
  client:SupabaseClient,
  brief:StalkChainResearchBrief,
):Promise<'INSERTED'|'REPLAY'>{
  if(brief.authority!=='RESEARCH_ONLY'||brief.canExecute!==false||brief.canAuthorizeTrade!==false){
    throw new Error('SHARK_STALKCHAIN_BRIEF_AUTHORITY_INVALID')
  }
  const payload={
    briefId:brief.briefId,
    generatedAt:brief.generatedAt,
    leaderboardWindow:brief.leaderboardWindow,
    traderCount:brief.traders.length,
    emergingCount:brief.emerging.length,
    failureCount:brief.failures.length,
    providerCreditsRemaining:brief.providerCreditsRemaining,
    evidenceIds:sortedUnique(brief.providerEvidenceIds),
    source:'stalkchain-fomo-read-only',
    brief,
  }
  const {data,error}=await client.rpc('jhadina_shark_append_stalkchain_research_brief',{p_payload:payload})
  if(error)throw new Error('SHARK StalkChain brief append failed: '+error.message)
  if(data!=='INSERTED'&&data!=='REPLAY')throw new Error('SHARK_STALKCHAIN_BRIEF_APPEND_RESULT_INVALID')
  return data
}

export async function runStalkChainResearchWorker(
  client:SupabaseClient,
  input:Readonly<{
    apiKey:string
    generatedAt?:string
    leaderboardWindow?:'24h'|'7d'|'30d'|'all'
    limit?:number
    positionLimit?:number
    includeTheses?:boolean
    thesisLimit?:number
  }>,
):Promise<StalkChainResearchWorkerResult>{
  const apiKey=input.apiKey.trim()
  if(!apiKey)throw new Error('SHARK_STALKCHAIN_API_KEY_REQUIRED')
  const generatedAt=input.generatedAt??new Date().toISOString()
  const provider=createStalkChainReadOnlyProvider({apiKey})
  const brief=await runStalkChainTraderResearch(provider,{
    generatedAt,
    leaderboardWindow:input.leaderboardWindow??'7d',
    limit:input.limit??10,
    positionLimit:input.positionLimit??100,
    includeTheses:input.includeTheses??true,
    thesisLimit:input.thesisLimit??25,
  })
  const disposition=await appendStalkChainResearchBrief(client,brief)
  return Object.freeze({
    briefId:brief.briefId,
    generatedAt:brief.generatedAt,
    leaderboardWindow:brief.leaderboardWindow,
    traders:brief.traders.length,
    emerging:brief.emerging.length,
    failures:brief.failures.length,
    disposition,
    providerCreditsRemaining:brief.providerCreditsRemaining,
    authority:'READ_ONLY_RESEARCH',
    canAuthorizeTrade:false,
    canExecute:false,
    canSign:false,
    canBroadcast:false,
  })
}

export function stalkChainResearchWorkerConfig(env:NodeJS.ProcessEnv=process.env):Readonly<{
  leaderboardWindow:'24h'|'7d'|'30d'|'all'
  limit:number
  positionLimit:number
  includeTheses:boolean
  thesisLimit:number
}>{
  return Object.freeze({
    leaderboardWindow:windowValue(env.SHARK_STALKCHAIN_LEADERBOARD_WINDOW),
    limit:intValue(env.SHARK_STALKCHAIN_TRADER_LIMIT,10,1,50,'SHARK_STALKCHAIN_TRADER_LIMIT_INVALID'),
    positionLimit:intValue(env.SHARK_STALKCHAIN_POSITION_LIMIT,100,1,250,'SHARK_STALKCHAIN_POSITION_LIMIT_INVALID'),
    includeTheses:boolValue(env.SHARK_STALKCHAIN_INCLUDE_THESES,true),
    thesisLimit:intValue(env.SHARK_STALKCHAIN_THESIS_LIMIT,25,1,200,'SHARK_STALKCHAIN_THESIS_LIMIT_INVALID'),
  })
}


export async function runStalkChainProviderAdmission(
  apiKey:string,
):Promise<StalkChainProviderAdmissionResult>{
  const key=apiKey.trim()
  if(!key)throw new Error('SHARK_STALKCHAIN_API_KEY_REQUIRED')
  return probeStalkChainProvider(createStalkChainReadOnlyProvider({apiKey:key}))
}

export const STALKCHAIN_CANARY_CONFIG=Object.freeze({
  leaderboardWindow:'7d' as const,
  limit:1,
  positionLimit:10,
  includeTheses:false,
  thesisLimit:1,
})
