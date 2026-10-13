import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {Pool} from 'pg'
import {createRunpodShadowStore} from './shark-shadow-runpod-store.js'
import {buildSharkShadowDecisionTwin,simulateSharkShadowExecution,observeSharkShadowOutcome,buildSharkShadowCounterfactual} from './shark-shadow-learning.js'

// Dedicated disposable test database only; production URLs are never inferred.
const url=process.env.SHADOW_TEST_DATABASE_URL
const embedded=process.env.SHADOW_TEST_PGLITE==='1'
test('Shadow ledger crash recovery and outbox atomicity', {skip:!url&&!embedded},async t=>{
  const schema='shadow_recovery_'+process.pid
  let pool:Pool
  let close:()=>Promise<void>
  let migrate:(sql:string)=>Promise<unknown>
  if(embedded){
    const moduleName='@electric-sql/pglite'
    const {PGlite}=await import(moduleName)
    const db=new PGlite()
    const query=async(sql:string,values?:unknown[])=>{
      const r=await db.query(sql,values)
      return {...r,rowCount:r.rows.length||r.affectedRows||0}
    }
    pool={query,connect:async()=>({query,release(){}})} as unknown as Pool
    close=()=>db.close()
    migrate=sql=>db.exec(sql)
  }else{
    pool=new Pool({connectionString:url,max:1,options:`-c search_path=${schema}`})
    close=()=>pool.end()
    migrate=sql=>pool.query(sql)
  }
  try{
    await pool.query(`create schema ${schema}`)
    await pool.query(`set search_path to ${schema}`)
    for(const filename of ['032_shark_shadow_runpod_final.sql','033_shark_shadow_grade_review.sql']){
      const sql=await readFile(new URL('../migrations/'+filename,import.meta.url),'utf8')
      await migrate(sql)
    }
    const store=createRunpodShadowStore(pool)
    const at='2026-10-01T00:00:00.000Z'
    const market={chainId:'solana',tokenAddress:'test',liquidityUsd:100000,volume24hUsd:300000,buys24h:700,sells24h:300,anomalyScore:0,observedAt:at,availableAt:at,evidenceIds:['fixture']}
    const decision=buildSharkShadowDecisionTwin({runtimeRunId:'recovery-test',envelopeId:'env',charterId:'charter',userId:'user',cofferId:'coffer',tradeType:'new-pair-speculation',chainId:'solana',tokenAddress:'test',instrumentId:'meme:test',disposition:'ALLOCATED',proposedNotionalMinor:10000n,sourceConfidence:.7,sourceRisk:.2,sourceGroups:['fixture'],informationCutoff:at,decidedAt:at,market,evidenceIds:['fixture']})
    const execution=simulateSharkShadowExecution({decision,simulatedAt:at})
    await store.appendMarketSample({sampleId:'baseline',chainId:'solana',tokenAddress:'test',pairAddress:'pair',priceUsd:1,liquidityUsd:100000,volume24hUsd:300000,buys24h:700,sells24h:300,observedAt:at,evidenceIds:['fixture'],raw:{}})
    const count=async(table:string)=>(await pool.query(`select count(*)::int as n from ${table}`)).rows[0].n
    await t.test('queue failure rolls back decision; retry commits exactly once',async()=>{
      await pool.query("alter table runpod_shark_shadow_sync_queue add constraint inject_failure check(record_type <> 'DECISION')")
      await assert.rejects(store.appendDecision({decision,baselineSampleId:'baseline',baselinePriceUsd:1}))
      assert.equal(await count('runpod_shark_shadow_decisions'),0)
      await pool.query('alter table runpod_shark_shadow_sync_queue drop constraint inject_failure')
      assert.equal(await store.appendDecision({decision,baselineSampleId:'baseline',baselinePriceUsd:1}),'INSERTED')
      assert.equal(await store.appendDecision({decision,baselineSampleId:'baseline',baselinePriceUsd:1}),'REPLAY')
      assert.equal(await count('runpod_shark_shadow_decisions'),1)
      assert.equal(await count('runpod_shark_shadow_sync_queue'),1)
    })
    await store.appendExecution(execution)
    const observation=observeSharkShadowOutcome({decision,horizon:'15M',observedAt:'2026-10-01T00:16:00.000Z',baselineLaunchReturnPct:0,observedLaunchReturnPct:20,evidenceIds:['runpod-shadow-pit-verified:v2']})
    const lesson=buildSharkShadowCounterfactual({decision,execution,observation})
    const input={observation,targetSampleId:'baseline',lesson}
    await t.test('lesson queue failure rolls back observation, lesson and both outbox entries',async()=>{
      await pool.query("alter table runpod_shark_shadow_sync_queue add constraint inject_failure check(record_type <> 'LESSON')")
      await assert.rejects(store.appendOutcome(input))
      assert.equal(await count('runpod_shark_shadow_observations'),0)
      assert.equal(await count('runpod_shark_shadow_lessons'),0)
      assert.equal(await count('runpod_shark_shadow_sync_queue'),2)
      assert.equal((await store.completedHorizons(decision.decisionId)).size,0)
      await pool.query('alter table runpod_shark_shadow_sync_queue drop constraint inject_failure')
    })
    await t.test('pre-repair observation-only row stays retryable and preserves its evidence',async()=>{
      await store.appendObservation(input)
      assert.equal((await store.completedHorizons(decision.decisionId)).size,0)
      const saved=await store.loadStoredObservation(decision.decisionId,'15M')
      assert.deepEqual(saved,JSON.parse(JSON.stringify({observation,targetSampleId:'baseline'})))
      assert.deepEqual(await store.appendOutcome(input),{observation:'REPLAY',lesson:'INSERTED'})
      assert.deepEqual(await store.appendOutcome(input),{observation:'REPLAY',lesson:'REPLAY'})
      assert.equal((await store.completedHorizons(decision.decisionId)).has('15M'),true)
      assert.equal(await count('runpod_shark_shadow_observations'),1)
      assert.equal(await count('runpod_shark_shadow_lessons'),1)
      assert.equal(await count('runpod_shark_shadow_sync_queue'),4)
    })
    await t.test('same observation ID with changed return fails closed',async()=>{
      await assert.rejects(store.appendOutcome({...input,observation:{...observation,underlyingReturnBps:9999}}),/OBSERVATION_REPLAY_CONFLICT/)
      assert.equal(await count('runpod_shark_shadow_lessons'),1)
      assert.equal(await count('runpod_shark_shadow_sync_queue'),4)
    })
    await t.test('quarantined historical observation cannot become a retry candidate',async()=>{
      const legacy={...observation,observationId:'legacy-observation',horizon:'1H' as const}
      await store.appendObservation({observation:legacy,targetSampleId:'baseline'})
      await pool.query(`insert into runpod_shark_shadow_grade_reviews(decision_id,horizon,review_status,reason_code)
        values($1,'1H','INVALID','TEST_QUARANTINE')`,[decision.decisionId])
      assert.equal((await store.completedHorizons(decision.decisionId)).has('1H'),true)
      assert.equal(await count('runpod_shark_shadow_lessons'),1)
    })
    await t.test('execution failure rolls back a new decision and both outbox entries',async()=>{
      const d2={...decision,decisionId:'atomic-decision',runtimeRunId:'atomic-run'}
      const e2=simulateSharkShadowExecution({decision:d2,simulatedAt:at})
      const pair={decision:d2,execution:e2,baselineSampleId:'baseline',baselinePriceUsd:1}
      const before=await count('runpod_shark_shadow_sync_queue')
      await pool.query("alter table runpod_shark_shadow_sync_queue add constraint inject_execution_failure check(record_type <> 'EXECUTION') not valid")
      await assert.rejects(store.appendDecisionExecution(pair))
      assert.equal((await pool.query('select 1 from runpod_shark_shadow_decisions where decision_id=$1',[d2.decisionId])).rows.length,0)
      assert.equal(await count('runpod_shark_shadow_sync_queue'),before)
      await pool.query('alter table runpod_shark_shadow_sync_queue drop constraint inject_execution_failure')
      assert.deepEqual(await store.appendDecisionExecution(pair),{decision:'INSERTED',execution:'INSERTED'})
      assert.deepEqual(await store.appendDecisionExecution(pair),{decision:'REPLAY',execution:'REPLAY'})
      assert.equal(await count('runpod_shark_shadow_sync_queue'),before+2)
      await assert.rejects(store.appendDecisionExecution({...pair,baselinePriceUsd:2}),/DECISION_REPLAY_CONFLICT/)
      await assert.rejects(store.appendDecisionExecution({...pair,execution:{...e2,totalEstimatedCostBps:9999}}),/EXECUTION_REPLAY_CONFLICT/)
      await assert.rejects(store.appendDecisionExecution({...pair,execution}),/EXECUTION_BINDING_INVALID/)
    })
  }finally{
    await pool.query(`drop schema if exists ${schema} cascade`)
    await close()
  }
})
