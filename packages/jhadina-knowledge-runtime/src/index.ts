export type KnowledgeTemporalState = "true_now"|"true_then"|"superseded"|"expired"|"disputed"|"unknown"
export type KnowledgeQueryMode = "exact"|"graph"|"semantic"|"hybrid"

export interface KnowledgeQuery {
  text: string
  ownerId?: string
  scope?: string
  mode?: KnowledgeQueryMode
  entityIds?: string[]
  asOf?: string
  limit?: number
  minimumScore?: number
  requireVerified?: boolean
}

export interface KnowledgeEvidence {
  id: string
  authorityScore: number
  verificationState: string
  freshnessState: string
  sourceId?: string
}

export interface KnowledgeRecord {
  id: string
  ownerId?: string
  scope: string
  subject: string
  predicate: string
  claim: string
  object: unknown
  confidence: number
  verificationState: string
  authorityScore: number
  freshnessScore: number
  freshnessState: string
  observedAt: string
  validFrom?: string
  validUntil?: string
  supersededBy?: string
  evidence: KnowledgeEvidence[]
}

export interface RankedKnowledge {
  record: KnowledgeRecord
  score: number
  temporalState: KnowledgeTemporalState
  reasons: string[]
}

export interface KnowledgeContext {
  query: KnowledgeQuery
  items: RankedKnowledge[]
  contradictions: Array<{ subject: string; recordIds: string[] }>
  gaps: KnowledgeGap[]
  provenance: string[]
  limitations: string[]
}

export interface KnowledgeGap {
  kind: "missing"|"weak"|"stale"|"contradictory"
  subject: string
  reason: string
  shouldResearch: boolean
}

export interface KnowledgeStore {
  exact(query: KnowledgeQuery): Promise<KnowledgeRecord[]>
  semantic(query: KnowledgeQuery): Promise<KnowledgeRecord[]>
  graph(query: KnowledgeQuery): Promise<KnowledgeRecord[]>
}

const words=(s:string)=>new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2))
const overlap=(a:string,b:string)=>{const A=words(a),B=words(b); if(!A.size||!B.size)return 0; let n=0; for(const x of A)if(B.has(x))n++; return n/Math.max(A.size,B.size)}

export function temporalState(record:KnowledgeRecord, asOf=new Date().toISOString()):KnowledgeTemporalState {
  if(record.supersededBy) return "superseded"
  if(record.verificationState==="disputed") return "disputed"
  const t=Date.parse(asOf)
  if(record.validFrom && t<Date.parse(record.validFrom)) return "unknown"
  if(record.validUntil && t>Date.parse(record.validUntil)) return "expired"
  if(record.freshnessState==="expired") return "expired"
  if(record.freshnessState==="stale"||record.freshnessState==="changed") return "unknown"
  if(record.verificationState==="verified") return "true_now"
  return "unknown"
}

export function rankKnowledge(query:KnowledgeQuery,record:KnowledgeRecord):RankedKnowledge {
  const temporal=temporalState(record,query.asOf)
  const relevance=Math.max(overlap(query.text,record.subject),overlap(query.text,record.claim))
  const corroboration=Math.min(1,record.evidence.filter(e=>e.verificationState==="verified").length/2)
  const verified=record.verificationState==="verified"?1:0
  const temporalWeight=temporal==="true_now"?1:temporal==="true_then"?0.7:temporal==="unknown"?0.35:0
  const score=0.30*relevance+0.18*record.confidence+0.16*record.authorityScore+0.12*record.freshnessScore+0.10*verified+0.08*corroboration+0.06*temporalWeight
  return {record,score:Number(score.toFixed(6)),temporalState:temporal,reasons:[`relevance:${relevance.toFixed(3)}`,`verification:${record.verificationState}`,`freshness:${record.freshnessState}`,`temporal:${temporal}`]}
}

export function detectContradictions(items:RankedKnowledge[]) {
  const groups=new Map<string,RankedKnowledge[]>()
  for(const item of items){const key=`${item.record.scope}|${item.record.subject.toLowerCase()}|${item.record.predicate}`; groups.set(key,[...(groups.get(key)??[]),item])}
  return [...groups.values()].filter(g=>new Set(g.map(x=>JSON.stringify(x.record.object))).size>1).map(g=>({subject:g[0].record.subject,recordIds:g.map(x=>x.record.id).sort()}))
}

export function detectKnowledgeGaps(query:KnowledgeQuery,items:RankedKnowledge[],contradictions=detectContradictions(items)):KnowledgeGap[] {
  const gaps:KnowledgeGap[]=[]
  if(!items.length) gaps.push({kind:"missing",subject:query.text,reason:"No admissible knowledge matched the query.",shouldResearch:true})
  else {
    if(items[0].score<(query.minimumScore??0.45)) gaps.push({kind:"weak",subject:items[0].record.subject,reason:"Top knowledge score is below the query threshold.",shouldResearch:true})
    for(const x of items.filter(x=>["expired","unknown"].includes(x.temporalState))) gaps.push({kind:"stale",subject:x.record.subject,reason:`Temporal/freshness state is ${x.temporalState}.`,shouldResearch:true})
  }
  for(const c of contradictions) gaps.push({kind:"contradictory",subject:c.subject,reason:"Admissible knowledge contains incompatible objects.",shouldResearch:true})
  return gaps
}

export function toResearchIntent(gap:KnowledgeGap) {
  return {intentType:gap.kind==="contradictory"?"contradiction_resolution":gap.kind==="stale"?"knowledge_revalidation":"fact_verification",objective:`Resolve knowledge gap: ${gap.subject}`,questions:[gap.reason],claimsToTest:[],trigger:"knowledge_gap"}
}

export async function retrieveKnowledge(store:KnowledgeStore,query:KnowledgeQuery):Promise<KnowledgeContext> {
  const mode=query.mode??"hybrid"
  const sets:KnowledgeRecord[][]=[]
  if(mode==="exact"||mode==="hybrid")sets.push(await store.exact(query))
  if(mode==="graph"||mode==="hybrid")sets.push(await store.graph(query))
  if(mode==="semantic"||mode==="hybrid")sets.push(await store.semantic(query))
  const byId=new Map<string,KnowledgeRecord>()
  for(const set of sets)for(const r of set)byId.set(r.id,r)
  let ranked=[...byId.values()].map(r=>rankKnowledge(query,r))
    .filter(x=>!query.requireVerified||x.record.verificationState==="verified")
    .filter(x=>!["superseded","expired"].includes(x.temporalState))
    .sort((a,b)=>b.score-a.score||a.record.id.localeCompare(b.record.id))
  ranked=ranked.slice(0,Math.max(1,Math.min(query.limit??8,50)))
  const contradictions=detectContradictions(ranked)
  return {query,items:ranked,contradictions,gaps:detectKnowledgeGaps(query,ranked,contradictions),provenance:[...new Set(ranked.flatMap(x=>x.record.evidence.map(e=>e.id)))],limitations:mode==="semantic"?["semantic retrieval is provider-defined; semantic similarity is never treated as truth"]:[]}
}

export interface MemoryObservation { id:string; userId:string; content:string; confidence:number; approved:boolean; observedAt:string }
export function proposeKnowledgeFromMemory(memory:MemoryObservation) {
  if(!memory.approved) return undefined
  return {sourceMemoryId:memory.id,ownerId:memory.userId,knowledgeType:"personal",subject:"user",predicate:"reports",claim:memory.content,object:{text:memory.content},confidence:memory.confidence,status:"candidate" as const}
}

export interface KnowledgeContextProvider { getKnowledgeContext(query:KnowledgeQuery):Promise<KnowledgeContext> }
