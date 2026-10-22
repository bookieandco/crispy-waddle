import test from 'node:test'
import assert from 'node:assert/strict'
import {buildSharkShadowDecisionTwin,simulateSharkShadowExecution} from './shark-shadow-learning.js'
import {
  isRunpodShadowPointInTimeSample,
  runpodShadowSample,
  runpodShadowHorizonTarget,
  runRunpodShadowOutcomeCycle,
  type RunpodShadowCandidate,
} from './shark-shadow-runpod-runtime.js'
import type {RunpodShadowMarketSample,RunpodShadowStore} from './shark-shadow-runpod-store.js'

const origin='2026-10-01T00:00:00.000Z'
const candidate=(observedAt:string,priceUsd:number):RunpodShadowCandidate=>({
  chainId:'solana',tokenAddress:'token-pit-1',pairAddress:'pair-pit-1',dexId:'pumpfun',
  priceUsd,liquidityUsd:120000,volume24hUsd:400000,buys24h:800,sells24h:200,
  priceChange1hPct:5,discoveredAt:observedAt,
  evidenceIds:['dexscreener:pair:pair-pit-1'],
  raw:{url:'https://dexscreener.com/solana/pair-pit-1'},
})
const decision=buildSharkShadowDecisionTwin({
  runtimeRunId:'pit-run',envelopeId:'pit-env',charterId:'paper',userId:'paper-user',cofferId:'paper-coffer',
  opportunityId:'pit-opportunity',disposition:'ALLOCATED',proposedNotionalMinor:10000n,side:'BUY',
  tradeType:'new-pair-speculation',chainId:'solana',tokenAddress:'token-pit-1',
  instrumentId:'meme:solana:token-pit-1',sourceConfidence:.8,sourceRisk:.2,
  sourceGroups:['dexscreener'],informationCutoff:origin,decidedAt:origin,
  market:{chainId:'solana',tokenAddress:'token-pit-1',liquidityUsd:120000,
    volume24hUsd:400000,buys24h:800,sells24h:200,anomalyScore:.1,
    observedAt:origin,availableAt:origin,evidenceIds:['dexscreener:pair:pair-pit-1']},
  evidenceIds:['dexscreener:pair:pair-pit-1'],
})
const execution=simulateSharkShadowExecution({decision,simulatedAt:origin})
const baseline=runpodShadowSample(candidate(origin,.01))

function fakeStore(records:RunpodShadowMarketSample[]){
  const inserted:any[]=[]
  const lookedUp:any[]=[]
  const store={
    async auditLegacyGrades(){return 0},
    async listDecisions(){return [{decision,baselineSampleId:baseline.sampleId,baselinePriceUsd:.01}]},
    async loadExecution(){return execution},
    async completedHorizons(){return new Set()},
    async findMarketSampleById(){return baseline},
    async appendMarketSample(s:RunpodShadowMarketSample){records.push(s);return 'INSERTED'},
    async findMarketSampleAtOrAfter(request:any){
      lookedUp.push(request)
      return records.filter(s=>
        s.chainId===request.chainId
        && s.tokenAddress===request.tokenAddress
        && s.observedAt>=request.from
        && s.observedAt<=request.through
        && (!request.pairAddress||s.pairAddress===request.pairAddress))
        .sort((a,b)=>a.observedAt.localeCompare(b.observedAt))[0]
    },
    async appendObservation(input:any){inserted.push(input);return 'INSERTED'},
    async appendLesson(){return 'INSERTED'},
    async listLessons(){return []},
    async putRuntimeState(){},
  }
  return {store:store as unknown as RunpodShadowStore,inserted,lookedUp}
}

test('due horizon samples must match token, pair, time window, evidence and asOf',()=>{
  const valid=runpodShadowSample(candidate('2026-10-01T00:16:00.000Z',.015))
  const base={decidedAt:origin,horizon:'15M' as const,chainId:'solana',tokenAddress:'token-pit-1',expectedPairAddress:'pair-pit-1',asOf:'2026-10-01T00:30:00.000Z'}
  assert.equal(isRunpodShadowPointInTimeSample({...base,sample:valid}),true)
  assert.equal(isRunpodShadowPointInTimeSample({...base,sample:{...valid,observedAt:'2026-10-01T01:05:00.000Z'}}),false)
  assert.equal(isRunpodShadowPointInTimeSample({...base,sample:{...valid,observedAt:'2026-10-01T00:32:00.000Z'}}),false)
  assert.equal(isRunpodShadowPointInTimeSample({...base,sample:{...valid,pairAddress:'another-pair'}}),false)
  assert.equal(isRunpodShadowPointInTimeSample({...base,sample:{...valid,tokenAddress:'another-mint'}}),false)
  assert.equal(isRunpodShadowPointInTimeSample({...base,sample:{...valid,evidenceIds:[]}}),false)
  assert.equal(isRunpodShadowPointInTimeSample({...base,sample:{...valid,priceUsd:0}}),false)
})

test('overdue 15M and 1H grades use their own saved historical quote, not one current price',async()=>{
  const records=[
    runpodShadowSample(candidate('2026-10-01T00:18:00.000Z',.015)),
    runpodShadowSample(candidate('2026-10-01T01:08:00.000Z',.020)),
  ]
  const {store,inserted,lookedUp}=fakeStore(records)
  const now='2026-10-01T02:00:00.000Z'
  let spotLookups=0
  const provider={async marketForToken(){spotLookups++;return candidate(now,.075)}}
  const receipt=await runRunpodShadowOutcomeCycle({store,provider:provider as any,now})
  assert.equal(spotLookups,1,'capture spot once per decision only')
  assert.equal(receipt.observationsInserted,2)
  assert.equal(receipt.missingPrice,0)
  assert.deepEqual(inserted.map(x=>x.observation.horizon),['15M','1H'])
  assert.deepEqual(inserted.map(x=>x.observation.observedAt),
    ['2026-10-01T00:18:00.000Z','2026-10-01T01:08:00.000Z'])
  assert.ok(inserted.every(x=>x.observation.evidenceIds.includes('runpod-shadow-pit-verified:v2')))
  assert.deepEqual(lookedUp.map(x=>x.pairAddress),['pair-pit-1','pair-pit-1'])
})

test('missed old horizons stay unavailable rather than being fabricated from current spot price',async()=>{
  const now='2026-10-01T06:00:00.000Z'
  const {store,inserted}=fakeStore([])
  const provider={async marketForToken(){return candidate(now,.075)}}
  const receipt=await runRunpodShadowOutcomeCycle({store,provider:provider as any,now})
  assert.equal(receipt.missingPrice,2,'15M and 1H never existed')
  assert.equal(receipt.observationsInserted,1,'4H is due and spot is inside its window')
  assert.deepEqual(inserted.map(x=>x.observation.horizon),['4H'])
  assert.equal(inserted[0]!.observation.observedAt,now)
})

test('future-dated provider quote is never backdated or used for a due grade',async()=>{
  const {store,inserted}=fakeStore([])
  const now='2026-10-01T00:30:00.000Z'
  const provider={async marketForToken(){return candidate('2026-10-01T00:50:00.000Z',.075)}}
  const receipt=await runRunpodShadowOutcomeCycle({store,provider:provider as any,now})
  assert.equal(receipt.observationsInserted,0)
  assert.equal(receipt.missingPrice,1)
  assert.equal(inserted.length,0)
})


test('offline evidence-only six-horizon replay is deterministic without SWLC, RunPod or fabricated spot prices',async()=>{
  const horizons=['15M','1H','4H','24H','3D','7D'] as const
  const prices=[.011,.012,.009,.008,.014,.006]
  const saved=horizons.map((h,i)=>{
    const window=runpodShadowHorizonTarget(origin,h)
    const observed=new Date(Date.parse(window.dueAt)+3*60_000).toISOString()
    return runpodShadowSample(candidate(observed,prices[i]!))
  })
  const {store,inserted,lookedUp}=fakeStore([...saved])
  let providerCalls=0
  // An offline canary must NOT invent a current market observation.
  const provider={async marketForToken(){providerCalls++;return null}}
  const receipt=await runRunpodShadowOutcomeCycle({
    store,provider:provider as any,now:'2026-10-10T00:00:00.000Z',lookbackDays:14,
  })
  assert.equal(providerCalls,1)
  assert.equal(receipt.observationsInserted,6)
  assert.equal(receipt.lessonsInserted,6)
  assert.equal(receipt.missingPrice,0)
  assert.deepEqual(inserted.map(x=>x.observation.horizon),horizons)
  assert.deepEqual(inserted.map(x=>x.observation.observedAt),saved.map(x=>x.observedAt))
  assert.deepEqual(inserted.map(x=>x.targetSampleId),saved.map(x=>x.sampleId))
  assert.ok(lookedUp.every(x=>x.pairAddress==='pair-pit-1'))
  assert.equal(receipt.canExecute,false)
  assert.equal(receipt.canAuthorizeLive,false)
  // This is deterministic unit evidence only, NOT six genuine elapsed live windows.
})

test('missing original pair sample cannot grade token using an arbitrary pool',async()=>{
  const observed='2026-10-01T00:18:00.000Z'
  const {store,inserted,lookedUp}=fakeStore([runpodShadowSample(candidate(observed,.04))])
  ;(store as any).findMarketSampleById=async()=>undefined
  const provider={async marketForToken(){return null}}
  const receipt=await runRunpodShadowOutcomeCycle({
    store,provider:provider as any,now:'2026-10-01T00:30:00.000Z',
  })
  assert.equal(receipt.observationsInserted,0)
  assert.equal(receipt.lessonsInserted,0)
  assert.equal(receipt.missingPrice,1)
  assert.equal(inserted.length,0)
  assert.equal(lookedUp.length,0,'missing baseline must short-circuit before pair lookup')
})

test('mismatched original price cannot silently rescale historical returns',async()=>{
  const observed='2026-10-01T00:18:00.000Z'
  const {store,inserted}=fakeStore([runpodShadowSample(candidate(observed,.04))])
  ;(store as any).findMarketSampleById=async()=>({...baseline,priceUsd:.02})
  const provider={async marketForToken(){return null}}
  const receipt=await runRunpodShadowOutcomeCycle({
    store,provider:provider as any,now:'2026-10-01T00:30:00.000Z',
  })
  assert.equal(receipt.observationsInserted,0)
  assert.equal(receipt.missingPrice,1)
  assert.equal(inserted.length,0)
})
