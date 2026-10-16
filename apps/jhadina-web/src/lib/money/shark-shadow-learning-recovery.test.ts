import {describe,it,expect} from 'vitest'
import {buildSharkShadowDecisionTwin,simulateSharkShadowExecution} from '@jhadina/money-core'
import {runSharkShadowLearningCycle} from './shark-shadow-learning-worker'
import {appendShadowLesson} from './shark-shadow-learning-repository'

const at='2026-10-01T00:00:00.000Z'
const now='2026-10-01T00:30:00.000Z'
const d=buildSharkShadowDecisionTwin({runtimeRunId:'run',envelopeId:'env',charterId:'charter',userId:'user',cofferId:'coffer',disposition:'ALLOCATED',proposedNotionalMinor:10000n,tradeType:'new-pair-speculation',chainId:'solana',tokenAddress:'token',instrumentId:'meme:token',sourceConfidence:.7,sourceRisk:.2,sourceGroups:['fixture'],informationCutoff:at,decidedAt:at,market:{chainId:'solana',tokenAddress:'token',liquidityUsd:100000,volume24hUsd:300000,buys24h:700,sells24h:300,anomalyScore:0,observedAt:at,availableAt:at,evidenceIds:['fixture']},evidenceIds:['fixture']})
const json=(v:any):any=>JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x))
// Simulates PostgreSQL JSONB key reordering, not source insertion order.
const reordered=(v:any):any=>Array.isArray(v)?v.map(reordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().reverse().map(k=>[k,reordered(v[k])])):v
const ids:Record<string,string>={money_shark_shadow_decisions:'decision_id',money_shark_shadow_executions:'simulation_id',money_shark_shadow_positions:'position_id',money_shark_shadow_observations:'observation_id',money_shark_shadow_lessons:'lesson_id',money_shark_shadow_calibrations:'calibration_id',money_shark_shadow_memory:'memory_id',money_purse_learning_events:'learning_event_id'}
function fixture(withExecution=true){
  const tables:Record<string,any[]>={
    money_shark_coffer_runtime_runs:[{run_id:d.runtimeRunId,envelope_id:d.envelopeId,charter_id:d.charterId,user_id:d.userId,coffer_id:d.cofferId,disposition:d.runtimeDisposition,information_cutoff:at,completed_at:at,evidence_ids:['fixture']}],
    money_shark_shadow_decisions:[{decision_id:d.decisionId,runtime_run_id:d.runtimeRunId,decided_at:at,decision_json:json(d)}],
    money_shark_shadow_executions:withExecution?[{decision_id:d.decisionId,execution_json:json(simulateSharkShadowExecution({decision:d,simulatedAt:at}))}]:[],
    jhadina_token_launches:[{launch_id:'launch',chain_id:'solana',token_address:'token'}],
    jhadina_launch_outcome_observations:[{observation_id:'baseline',launch_id:'launch',observed_at:at,price_return_from_launch_pct:0,evidence_ids:['baseline']},{observation_id:'target',launch_id:'launch',observed_at:'2026-10-01T00:16:00.000Z',price_return_from_launch_pct:20,evidence_ids:['target']}],
  }
  let failure:((table:string,row:any)=>boolean)|undefined
  let afterCommit=false
  const client={from(table:string){
    const filters:((r:any)=>boolean)[]=[]
    let insert:any,order:string|undefined,ascending=true,limit=Infinity,single=false
    const q:any={
      select(){return q},insert(row:any){insert=json(row);return q},
      eq(k:string,v:any){filters.push(r=>r[k]===v);return q},in(k:string,v:any[]){filters.push(r=>v.includes(r[k]));return q},
      gte(k:string,v:any){filters.push(r=>r[k]>=v);return q},lte(k:string,v:any){filters.push(r=>r[k]<=v);return q},
      order(k:string,o:any){order=k;ascending=o.ascending;return q},limit(n:number){limit=n;return q},maybeSingle(){single=true;return q},
      then(resolve:any,reject:any){return Promise.resolve().then(()=>{
        const rows=tables[table]??(tables[table]=[])
        if(insert){
          const fail=failure?.(table,insert)
          if(fail)failure=undefined
          if(fail&&!afterCommit)return {data:null,error:{code:'INJECTED',message:'interrupted'}}
          if(rows.some(r=>r[ids[table]]===insert[ids[table]]))return {data:null,error:{code:'23505',message:'duplicate'}}
          rows.push(reordered(insert))
          if(fail)return {data:null,error:{code:'INJECTED',message:'lost acknowledgement'}}
          return {data:reordered(insert),error:null}
        }
        let data=rows.filter(r=>filters.every(f=>f(r)))
        if(order)data.sort((a,b)=>String(a[order!]).localeCompare(String(b[order!]))*(ascending?1:-1))
        data=data.slice(0,limit).map(reordered)
        return {data:single?data[0]??null:data,error:null}
      }).then(resolve,reject)},
    }
    return q
  }}
  return {tables,client:client as any,fail(table:string,source?:string,committed=false){afterCommit=committed;failure=(t,r)=>t===table&&(!source||r.source===source)}}
}

describe('canonical Shadow interrupted-stage recovery',()=>{
  it('repairs execution and position from frozen decision without live ingress or charter',async()=>{
    const f=fixture(false)
    f.fail('money_shark_shadow_positions')
    expect((await runSharkShadowLearningCycle({client:f.client,now})).failures).toHaveLength(1)
    const saved=json(f.tables.money_shark_shadow_executions)
    expect((await runSharkShadowLearningCycle({client:f.client,now})).failures).toEqual([])
    expect(f.tables.money_shark_shadow_executions).toEqual(saved)
    expect(f.tables.money_shark_shadow_positions).toHaveLength(1)
    expect(f.tables.money_shark_shadow_executions[0].execution_json.canExecute).toBe(false)
    expect(f.tables.money_shark_shadow_executions[0].execution_json.routeSource).toBe('LIQUIDITY_MODEL')
  })
  for(const [table,source] of [['money_shark_shadow_observations',undefined],['money_shark_shadow_lessons',undefined],['money_purse_learning_events','PURSE_OUTCOME'],['money_shark_shadow_calibrations',undefined],['money_shark_shadow_memory',undefined],['money_purse_learning_events','STRATEGY_PROFILE']] as const){
    for(const committed of [false,true])it(`recovers ${table}/${source??''} ${committed?'after':'before'} commit without snapshot churn`,async()=>{
      const f=fixture()
      f.fail(table,source,committed)
      expect((await runSharkShadowLearningCycle({client:f.client,now})).failures).toHaveLength(1)
      const observation=f.tables.money_shark_shadow_observations?.[0]
      if(observation){
        // Once saved, recovery must not depend on launch lookup or revised quotes.
        f.tables.jhadina_token_launches=[]
        f.tables.jhadina_launch_outcome_observations=[]
      }
      const recovered=await runSharkShadowLearningCycle({client:f.client,now:'2026-10-01T00:31:00.000Z'})
      expect(recovered.failures).toEqual([])
      for(const name of ['money_shark_shadow_observations','money_shark_shadow_lessons','money_shark_shadow_calibrations','money_shark_shadow_memory'])expect(f.tables[name]).toHaveLength(1)
      expect(f.tables.money_purse_learning_events).toHaveLength(2)
      if(observation)expect(f.tables.money_shark_shadow_observations[0]).toEqual(observation)
      const again=await runSharkShadowLearningCycle({client:f.client,now:'2026-10-01T00:32:00.000Z'})
      expect(again.failures).toEqual([])
      expect([again.lessonsInserted,again.purseMemoriesInserted,again.calibrationsInserted,again.memoriesInserted,again.profilesInserted]).toEqual([0,0,0,0,0])
    })
  }
  it('keeps unknown returns ungraded and rejects changed lesson payloads',async()=>{
    const f=fixture()
    f.tables.jhadina_launch_outcome_observations[1].price_return_from_launch_pct=undefined
    const result=await runSharkShadowLearningCycle({client:f.client,now})
    expect(result.failures).toEqual([])
    expect(result.lessonsInserted).toBe(0)
    expect(f.tables.money_shark_shadow_observations).toHaveLength(1)
    const good=fixture()
    await runSharkShadowLearningCycle({client:good.client,now})
    const lesson=good.tables.money_shark_shadow_lessons[0].lesson_json
    await expect(appendShadowLesson(good.client,{...lesson,decisionQualityBps:9999})).rejects.toThrow('SHADOW_LESSON_CONFLICT')
  })
})
