import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildEntityGraph,
  createActorAwareMemeTradeAssessment,
  type ActorAwareAssessmentInput,
  type EntityGraph,
  type EntityGraphEdge,
  type EntityGraphNode,
  type GraphNodeKind,
  type GraphRelationKind,
  type MemeTradeAssessment,
  type PersistedActorOutcomeRecord,
} from '@jhadina/shark-intelligence-core/meme-trader'

type LaunchRow=Readonly<{
 launch_id:string
 chain_id:string
 token_address:string
 launched_at:string
 evidence_ids:string[]
}>

type EdgeRow=Readonly<{
 edge_id:string
 actor_id:string
 actor_kind:'wallet'|'developer'|'organization'|'cluster'
 role:GraphRelationKind
 confidence:number|null
 observed_at:string
 evidence_ids:string[]
}>

type HistoryRow=Readonly<{
 actor_key:string
 actor_id:string
 actor_kind:'wallet'|'developer'|'cluster'
 launches:number
 healthy_launches:number
 bad_launches:number
 failed_launches:number
 rug_rate:number|string
 pump_and_dump_rate:number|string
 outcome_coverage:number|string
 confidence:number|string
 association_confidence:number|string
 evidence_ids:string[]
}>

export type PersistedActorAwareAssessmentInput=Omit<
 ActorAwareAssessmentInput,
 'actorGraph'|'persistedActorOutcomeHistory'|'historicalLaunches'
>

const finite=(value:number|string|null|undefined,field:string):number=>{
 const n=typeof value==='number'?value:Number(value)
 if(!Number.isFinite(n))throw new Error(`SHARK persisted actor ${field} is invalid`)
 return n
}

function nodeId(kind:GraphNodeKind,id:string):string{return `${kind}:${id}`}

export function buildPersistedActorGraph(launch:LaunchRow,edges:readonly EdgeRow[]):EntityGraph{
 if(!launch.launch_id||!launch.chain_id||!launch.token_address||!launch.launched_at||!launch.evidence_ids?.length)throw new Error('SHARK persisted launch graph identity/evidence is incomplete')
 const tokenId=`token:${launch.chain_id}:${launch.token_address}`
 const nodes:EntityGraphNode[]=[{id:tokenId,kind:'token',chainId:launch.chain_id,observedAt:launch.launched_at,confidence:1,evidenceIds:[...launch.evidence_ids]}]
 const graphEdges:EntityGraphEdge[]=[]
 const seenNodes=new Set([tokenId])
 for(const row of edges){
  if(!row.edge_id||!row.actor_id||!row.actor_kind||!row.role||!row.observed_at||!row.evidence_ids?.length)throw new Error('SHARK persisted actor edge is incomplete')
  const id=nodeId(row.actor_kind,row.actor_id)
  if(!seenNodes.has(id)){
   nodes.push({id,kind:row.actor_kind,chainId:launch.chain_id,observedAt:row.observed_at,confidence:1,evidenceIds:[...row.evidence_ids]})
   seenNodes.add(id)
  }
  graphEdges.push({
   id:row.edge_id,
   from:id,
   to:tokenId,
   relation:row.role,
   observedAt:row.observed_at,
   confidence:finite(row.confidence??0,'edge confidence'),
   evidenceIds:[...row.evidence_ids],
  })
 }
 return buildEntityGraph(nodes,graphEdges)
}

export function mapPersistedActorHistory(rows:readonly HistoryRow[]):PersistedActorOutcomeRecord[]{
 return rows.map(row=>{
  if(!row.actor_key||!row.actor_id||!row.actor_kind||!row.evidence_ids?.length)throw new Error('SHARK persisted actor history identity/evidence is incomplete')
  if(row.actor_key!==`${row.actor_kind}:${row.actor_id}`)throw new Error('SHARK persisted actor history key mismatch')
  return {
   actorKey:row.actor_key,
   actorId:row.actor_id,
   actorKind:row.actor_kind,
   launches:row.launches,
   healthyLaunches:row.healthy_launches,
   badLaunches:row.bad_launches,
   failedLaunches:row.failed_launches,
   rugRate:finite(row.rug_rate,'rug rate'),
   pumpAndDumpRate:finite(row.pump_and_dump_rate,'pump-and-dump rate'),
   outcomeCoverage:finite(row.outcome_coverage,'outcome coverage'),
   confidence:finite(row.confidence,'confidence'),
   associationConfidence:finite(row.association_confidence,'association confidence'),
   evidenceIds:[...row.evidence_ids],
  }
 })
}

export function createActorAwareAssessmentFromPersistedContext(input:{
 assessment:PersistedActorAwareAssessmentInput
 launch:LaunchRow
 edges:readonly EdgeRow[]
 histories:readonly HistoryRow[]
}):MemeTradeAssessment{
 if(input.assessment.market.chainId!==input.launch.chain_id||input.assessment.market.subjectId!==input.launch.token_address)throw new Error('SHARK assessment/persisted launch identity mismatch')
 const actorGraph=buildPersistedActorGraph(input.launch,input.edges)
 const persistedActorOutcomeHistory=mapPersistedActorHistory(input.histories)
 return createActorAwareMemeTradeAssessment({
  ...input.assessment,
  actorGraph,
  persistedActorOutcomeHistory,
 })
}

export async function createPersistedActorAwareMemeTradeAssessment(
 client:SupabaseClient,
 assessment:PersistedActorAwareAssessmentInput,
):Promise<MemeTradeAssessment>{
 const chainId=assessment.market.chainId,tokenAddress=assessment.market.subjectId
 const {data:launch,error:launchError}=await client
  .from('jhadina_token_launches')
  .select('launch_id,chain_id,token_address,launched_at,evidence_ids')
  .eq('chain_id',chainId)
  .eq('token_address',tokenAddress)
  .maybeSingle()
 if(launchError)throw new Error(`SHARK persisted launch load failed: ${launchError.message}`)
 if(!launch)throw new Error('SHARK persisted launch required before actor-aware assessment')

 const {data:edges,error:edgeError}=await client
  .from('jhadina_token_actor_edges')
  .select('edge_id,actor_id,actor_kind,role,confidence,observed_at,evidence_ids')
  .eq('launch_id',launch.launch_id)
 if(edgeError)throw new Error(`SHARK persisted actor edge load failed: ${edgeError.message}`)

 const graph=buildPersistedActorGraph(launch as LaunchRow,(edges??[]) as EdgeRow[])
 const actorKeys=graph.nodes
  .filter(node=>node.kind==='wallet'||node.kind==='developer'||node.kind==='cluster')
  .map(node=>`${node.kind}:${node.id.replace(/^(wallet|developer|cluster):/,'')}`)
 const histories:HistoryRow[]=[]
 if(actorKeys.length){
  const {data,error}=await client
   .from('jhadina_actor_outcome_history')
   .select('actor_key,actor_id,actor_kind,launches,healthy_launches,bad_launches,failed_launches,rug_rate,pump_and_dump_rate,outcome_coverage,confidence,association_confidence,evidence_ids')
   .in('actor_key',[...new Set(actorKeys)])
  if(error)throw new Error(`SHARK persisted actor history load failed: ${error.message}`)
  histories.push(...((data??[]) as HistoryRow[]))
 }
 return createActorAwareAssessmentFromPersistedContext({
  assessment,
  launch:launch as LaunchRow,
  edges:(edges??[]) as EdgeRow[],
  histories,
 })
}
