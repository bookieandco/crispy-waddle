import { describe,expect,it } from 'vitest'
import type { EvidenceEnvelope,MarketObservation } from '@jhadina/shark-intelligence-core/meme-trader'
import { buildPersistedActorGraph,createActorAwareAssessmentFromPersistedContext,mapPersistedActorHistory } from './actor-aware-assessment-service'

const launch={launch_id:'l1',chain_id:'solana-mainnet',token_address:'TOKEN',launched_at:'2026-09-21T19:00:00Z',evidence_ids:['launch:e1']}
const edge={edge_id:'deployed:1',actor_id:'DEV1',actor_kind:'wallet' as const,role:'deployed' as const,confidence:1,observed_at:'2026-09-21T19:00:00Z',evidence_ids:['edge:e1']}
const history={actor_key:'wallet:DEV1',actor_id:'DEV1',actor_kind:'wallet' as const,launches:10,healthy_launches:1,bad_launches:8,failed_launches:1,rug_rate:.6,pump_and_dump_rate:.2,outcome_coverage:1,confidence:1,association_confidence:1,evidence_ids:['history:e1']}
const market:EvidenceEnvelope<MarketObservation>={observationId:'market:e1',source:'dexscreener',observedAt:'2026-09-21T20:00:00Z',receivedAt:'2026-09-21T20:00:01Z',chainId:'solana-mainnet',subjectId:'TOKEN',payload:{liquidityUsd:100000,volume24hUsd:200000,buys24h:100,sells24h:50,anomalyScore:.1}}

describe('persisted actor-aware assessment orchestration',()=>{
 it('reconstructs token/actor graph with persisted association confidence',()=>{
  const graph=buildPersistedActorGraph(launch,[edge])
  expect(graph.nodes.some(n=>n.id==='wallet:DEV1')).toBe(true)
  expect(graph.edges[0]?.confidence).toBe(1)
 })
 it('maps durable actor history without inventing confidence',()=>{
  const records=mapPersistedActorHistory([history])
  expect(records[0]?.actorKey).toBe('wallet:DEV1')
  expect(records[0]?.rugRate).toBe(.6)
  expect(records[0]?.associationConfidence).toBe(1)
 })
 it('feeds durable bad-actor history into the canonical assessment',()=>{
  const result=createActorAwareAssessmentFromPersistedContext({
   launch,edges:[edge],histories:[history],
   assessment:{
    assessmentId:'a1',assessedAt:'2026-09-21T20:00:02Z',market,tradeType:'new-pair-speculation',
    strategyFit:{score:.7,matchedSignals:['flow'],conflicts:[]},thesis:'test durable actor risk',
    invalidation:{conditions:['liquidity collapses'],severity:'high'},
    positionPlan:{maxPositionFraction:.01,entryConditions:[],profitTakingConditions:[],exitConditions:[]},confidence:.7,
   },
  })
  expect(result.supplyControl.deployerRisk).toBeGreaterThan(0)
  expect(result.evidenceIds).toContain('history:e1')
 })
 it('fails closed when assessment identity does not match persisted launch',()=>{
  expect(()=>createActorAwareAssessmentFromPersistedContext({
   launch:{...launch,token_address:'OTHER'},edges:[edge],histories:[history],
   assessment:{assessmentId:'a1',assessedAt:'2026-09-21T20:00:02Z',market,tradeType:'new-pair-speculation',strategyFit:{score:.7,matchedSignals:[],conflicts:[]},thesis:'x',invalidation:{conditions:['x'],severity:'high'},positionPlan:{maxPositionFraction:.01,entryConditions:[],profitTakingConditions:[],exitConditions:[]},confidence:.5}
  })).toThrow('identity mismatch')
 })
 it('canonicalizes Base wallet casing when reconstructing persisted actor graphs',()=>{
  const baseLaunch={...launch,chain_id:'base-mainnet',token_address:'0xAbCdEf0000000000000000000000000000001234'}
  const baseEdge={...edge,actor_id:'0xFfEeDd0000000000000000000000000000005678'}
  const graph=buildPersistedActorGraph(baseLaunch,[baseEdge])
  expect(graph.nodes.some(n=>n.id==='token:base-mainnet:0xabcdef0000000000000000000000000000001234')).toBe(true)
  expect(graph.nodes.some(n=>n.id==='wallet:0xffeedd0000000000000000000000000000005678')).toBe(true)
 })

 it('preserves Solana wallet casing in persisted graph reconstruction',()=>{
  const graph=buildPersistedActorGraph(launch,[{...edge,actor_id:'AbC123'}])
  expect(graph.nodes.some(n=>n.id==='wallet:AbC123')).toBe(true)
  expect(graph.nodes.some(n=>n.id==='wallet:abc123')).toBe(false)
 })
})
