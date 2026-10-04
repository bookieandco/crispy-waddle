import {createHash} from 'node:crypto'
import {Pool,type PoolConfig} from 'pg'
import type {
  SharkShadowCounterfactualLesson,
  SharkShadowDecisionTwin,
  SharkShadowExecutionSimulation,
  SharkShadowMemoryCard,
  SharkShadowOutcomeObservation,
  SharkShadowPerformanceCalibration,
  SharkShadowHorizon,
} from './shark-shadow-learning.js'

const encode=(v:unknown)=>JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x))
const big=(v:unknown,code:string)=>{try{return BigInt(String(v))}catch{throw new Error(code)}}
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const strings=(v:unknown)=>Array.isArray(v)?v.map(String):[]

export type RunpodShadowMarketSample=Readonly<{
  sampleId:string
  chainId:string
  tokenAddress:string
  pairAddress?:string
  dexId?:string
  priceUsd?:number
  liquidityUsd:number
  volume24hUsd:number
  buys24h:number
  sells24h:number
  pairCreatedAt?:string
  observedAt:string
  evidenceIds:readonly string[]
  raw:unknown
}>

export type RunpodShadowStoredDecision=Readonly<{
  decision:SharkShadowDecisionTwin
  baselineSampleId:string
  baselinePriceUsd?:number
}>

export type RunpodShadowStore=ReturnType<typeof createRunpodShadowStore>

function decodeDecision(raw:any):SharkShadowDecisionTwin{
  return Object.freeze({
    ...raw,
    proposedNotionalMinor:big(raw.proposedNotionalMinor,'RUNPOD_SHADOW_DECISION_NOTIONAL_INVALID'),
    sourceGroups:Object.freeze(strings(raw.sourceGroups)),
    market:Object.freeze({...raw.market,evidenceIds:Object.freeze(strings(raw.market?.evidenceIds))}),
    reasonCodes:Object.freeze(strings(raw.reasonCodes)),
    evidenceIds:Object.freeze(strings(raw.evidenceIds)),
    canExecute:false,
  }) as SharkShadowDecisionTwin
}
function decodeExecution(raw:any):SharkShadowExecutionSimulation{
  return Object.freeze({
    ...raw,
    requestedNotionalMinor:big(raw.requestedNotionalMinor,'RUNPOD_SHADOW_EXECUTION_REQUESTED_INVALID'),
    estimatedFilledMinor:big(raw.estimatedFilledMinor,'RUNPOD_SHADOW_EXECUTION_FILLED_INVALID'),
    evidenceIds:Object.freeze(strings(raw.evidenceIds)),
    canSign:false,canBroadcast:false,canExecute:false,
  }) as SharkShadowExecutionSimulation
}
function decodeLesson(raw:any):SharkShadowCounterfactualLesson{
  return Object.freeze({
    ...raw,
    sourceGroups:Object.freeze(strings(raw.sourceGroups)),
    lessonTags:Object.freeze(strings(raw.lessonTags)),
    evidenceIds:Object.freeze(strings(raw.evidenceIds)),
    canExecute:false,canAuthorizeLive:false,
  }) as SharkShadowCounterfactualLesson
}
function decodeMemory(raw:any):SharkShadowMemoryCard{
  return Object.freeze({
    ...raw,
    sourceReliability:Object.freeze(Array.isArray(raw?.sourceReliability)?raw.sourceReliability:[]),
    lessonIds:Object.freeze(strings(raw?.lessonIds)),
    evidenceIds:Object.freeze(strings(raw?.evidenceIds)),
    canAuthorizeLive:false,
  }) as SharkShadowMemoryCard
}

export function createRunpodShadowPool(config:PoolConfig={}):Pool{
  const connectionString=config.connectionString??process.env.SHARK_SHADOW_DATABASE_URL
  if(!connectionString)throw new Error('RUNPOD_SHADOW_DATABASE_URL_REQUIRED')
  return new Pool({...config,connectionString,max:config.max??8})
}

export function runpodMarketSampleId(input:Readonly<{
  chainId:string
  tokenAddress:string
  pairAddress?:string
  observedAt:string
  priceUsd?:number
}>):string{
  return 'runpod-shadow-sample:'+hash(input)
}

export function createRunpodShadowStore(pool:Pool){
  const enqueue=async(recordType:string,recordId:string,payload:unknown)=>{
    await pool.query(
      `insert into runpod_shark_shadow_sync_queue(record_type,record_id,payload_json)
       values($1,$2,$3::jsonb)
       on conflict(record_type,record_id) do nothing`,
      [recordType,recordId,JSON.stringify(encode(payload))],
    )
  }

  return Object.freeze({
    async probe():Promise<void>{
      await pool.query('select 1 from runpod_shark_shadow_runtime_state limit 1')
    },

    async appendMarketSample(sample:RunpodShadowMarketSample):Promise<'INSERTED'|'REPLAY'>{
      const result=await pool.query(
        `insert into runpod_shadow_market_samples(
          sample_id,chain_id,token_address,pair_address,dex_id,price_usd,liquidity_usd,volume_24h_usd,buys_24h,sells_24h,
          pair_created_at,sample_json,observed_at,evidence_ids
        ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14)
        on conflict(sample_id) do nothing returning sample_id`,
        [
          sample.sampleId,sample.chainId,sample.tokenAddress,sample.pairAddress??null,sample.dexId??null,sample.priceUsd??null,
          sample.liquidityUsd,sample.volume24hUsd,sample.buys24h,sample.sells24h,sample.pairCreatedAt??null,
          JSON.stringify(encode(sample.raw)),sample.observedAt,[...sample.evidenceIds],
        ],
      )
      return result.rowCount?'INSERTED':'REPLAY'
    },

    async findMarketSampleAtOrAfter(input:{chainId:string;tokenAddress:string;from:string;through:string}):Promise<RunpodShadowMarketSample|undefined>{
      const result=await pool.query(
        `select sample_id,chain_id,token_address,pair_address,dex_id,price_usd,liquidity_usd,volume_24h_usd,buys_24h,sells_24h,
                pair_created_at,sample_json,observed_at,evidence_ids
         from runpod_shadow_market_samples
         where chain_id=$1 and token_address=$2 and observed_at >= $3 and observed_at <= $4
         order by observed_at asc limit 1`,
        [input.chainId,input.tokenAddress,input.from,input.through],
      )
      const r=result.rows[0] as any
      if(!r)return undefined
      return Object.freeze({
        sampleId:String(r.sample_id),chainId:String(r.chain_id),tokenAddress:String(r.token_address),
        pairAddress:r.pair_address?String(r.pair_address):undefined,dexId:r.dex_id?String(r.dex_id):undefined,
        priceUsd:r.price_usd===null?undefined:Number(r.price_usd),liquidityUsd:Number(r.liquidity_usd??0),volume24hUsd:Number(r.volume_24h_usd??0),
        buys24h:Number(r.buys_24h??0),sells24h:Number(r.sells_24h??0),
        pairCreatedAt:r.pair_created_at?new Date(r.pair_created_at).toISOString():undefined,
        observedAt:new Date(r.observed_at).toISOString(),evidenceIds:Object.freeze(strings(r.evidence_ids)),raw:r.sample_json,
      })
    },

    async appendDecision(input:{decision:SharkShadowDecisionTwin;baselineSampleId:string;baselinePriceUsd?:number}):Promise<'INSERTED'|'REPLAY'>{
      const d=input.decision
      if(d.canExecute!==false||d.authority!=='SHADOW_DECISION_ONLY')throw new Error('RUNPOD_SHADOW_DECISION_AUTHORITY_INVALID')
      const result=await pool.query(
        `insert into runpod_shark_shadow_decisions(
          decision_id,runtime_run_id,envelope_id,charter_id,user_id,coffer_id,opportunity_id,chain_id,token_address,instrument_id,
          strategy_id,action,side,runtime_disposition,confidence_bps,source_risk_bps,market_regime,baseline_sample_id,baseline_price_usd,
          decision_json,information_cutoff,decided_at,evidence_ids,authority,can_execute
        ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21,$22,$23,'SHADOW_DECISION_ONLY',false)
        on conflict(decision_id) do nothing returning decision_id`,
        [
          d.decisionId,d.runtimeRunId,d.envelopeId,d.charterId,d.userId,d.cofferId,d.opportunityId??null,d.chainId,d.tokenAddress,
          d.instrumentId,d.strategyId,d.action,d.side??null,d.runtimeDisposition,d.confidenceBps,d.sourceRiskBps,d.marketRegime,
          input.baselineSampleId,input.baselinePriceUsd??null,JSON.stringify(encode(d)),d.informationCutoff,d.decidedAt,[...d.evidenceIds],
        ],
      )
      if(result.rowCount)await enqueue('DECISION',d.decisionId,{...encode(d),baselineSampleId:input.baselineSampleId,baselinePriceUsd:input.baselinePriceUsd})
      return result.rowCount?'INSERTED':'REPLAY'
    },

    async appendExecution(s:SharkShadowExecutionSimulation):Promise<'INSERTED'|'REPLAY'>{
      if(s.canSign!==false||s.canBroadcast!==false||s.canExecute!==false)throw new Error('RUNPOD_SHADOW_EXECUTION_AUTHORITY_INVALID')
      const result=await pool.query(
        `insert into runpod_shark_shadow_executions(simulation_id,decision_id,execution_json,simulated_at,authority,can_sign,can_broadcast,can_execute)
         values($1,$2,$3::jsonb,$4,'SHADOW_EXECUTION_SIMULATION_ONLY',false,false,false)
         on conflict(simulation_id) do nothing returning simulation_id`,
        [s.simulationId,s.decisionId,JSON.stringify(encode(s)),s.simulatedAt],
      )
      if(result.rowCount)await enqueue('EXECUTION',s.simulationId,encode(s))
      return result.rowCount?'INSERTED':'REPLAY'
    },

    async listMarketSamples(input:{from:string;to:string;limit?:number}):Promise<readonly RunpodShadowMarketSample[]>{
      const limit=Math.max(1,Math.min(20000,Math.trunc(input.limit??10000)))
      const result=await pool.query(
        `select sample_id,chain_id,token_address,pair_address,dex_id,price_usd,liquidity_usd,volume_24h_usd,buys_24h,sells_24h,
                pair_created_at,sample_json,observed_at,evidence_ids
         from runpod_shadow_market_samples
         where observed_at >= $1 and observed_at <= $2
         order by observed_at asc,token_address asc
         limit $3`,
        [input.from,input.to,limit],
      )
      return Object.freeze(result.rows.map((r:any)=>Object.freeze({
        sampleId:String(r.sample_id),chainId:String(r.chain_id),tokenAddress:String(r.token_address),
        pairAddress:r.pair_address?String(r.pair_address):undefined,dexId:r.dex_id?String(r.dex_id):undefined,
        priceUsd:r.price_usd===null?undefined:Number(r.price_usd),liquidityUsd:Number(r.liquidity_usd??0),volume24hUsd:Number(r.volume_24h_usd??0),
        buys24h:Number(r.buys_24h??0),sells24h:Number(r.sells_24h??0),
        pairCreatedAt:r.pair_created_at?new Date(r.pair_created_at).toISOString():undefined,
        observedAt:new Date(r.observed_at).toISOString(),evidenceIds:Object.freeze(strings(r.evidence_ids)),raw:r.sample_json,
      })))
    },

    async hasRecentDecision(input:{chainId:string;tokenAddress:string;since:string}):Promise<boolean>{
      const result=await pool.query(
        `select 1 from runpod_shark_shadow_decisions
         where chain_id=$1 and token_address=$2 and decided_at >= $3
         limit 1`,
        [input.chainId,input.tokenAddress,input.since],
      )
      return Boolean(result.rows[0])
    },

    async listDecisions(input:{since:string;through:string;limit?:number;runtimePrefix?:string}):Promise<readonly RunpodShadowStoredDecision[]>{
      const limit=Math.max(1,Math.min(5000,Math.trunc(input.limit??2000)))
      const result=await pool.query(
        `select decision_json,baseline_sample_id,baseline_price_usd
         from runpod_shark_shadow_decisions
         where decided_at >= $1 and decided_at <= $2
           and ($4::text is null or runtime_run_id like $4 || '%')
         order by decided_at asc limit $3`,
        [input.since,input.through,limit,input.runtimePrefix?.trim()||null],
      )
      return Object.freeze(result.rows.map((r:any)=>Object.freeze({
        decision:decodeDecision(r.decision_json),
        baselineSampleId:String(r.baseline_sample_id),
        baselinePriceUsd:r.baseline_price_usd===null?undefined:Number(r.baseline_price_usd),
      })))
    },

    async loadExecution(decisionId:string):Promise<SharkShadowExecutionSimulation|undefined>{
      const result=await pool.query('select execution_json from runpod_shark_shadow_executions where decision_id=$1 limit 1',[decisionId])
      return result.rows[0]?decodeExecution((result.rows[0] as any).execution_json):undefined
    },

    async completedHorizons(decisionId:string):Promise<ReadonlySet<SharkShadowHorizon>>{
      const result=await pool.query('select horizon from runpod_shark_shadow_observations where decision_id=$1',[decisionId])
      return new Set(result.rows.map((r:any)=>String(r.horizon) as SharkShadowHorizon))
    },

    async appendObservation(input:{observation:SharkShadowOutcomeObservation;targetSampleId:string}):Promise<'INSERTED'|'REPLAY'>{
      const o=input.observation
      const result=await pool.query(
        `insert into runpod_shark_shadow_observations(
          observation_id,decision_id,horizon,target_sample_id,observation_json,observed_at,authority,can_execute
        ) values($1,$2,$3,$4,$5::jsonb,$6,'SHADOW_OUTCOME_ONLY',false)
        on conflict(observation_id) do nothing returning observation_id`,
        [o.observationId,o.decisionId,o.horizon,input.targetSampleId,JSON.stringify(encode(o)),o.observedAt],
      )
      if(result.rowCount)await enqueue('OBSERVATION',o.observationId,{...encode(o),targetSampleId:input.targetSampleId})
      return result.rowCount?'INSERTED':'REPLAY'
    },

    async appendLesson(l:SharkShadowCounterfactualLesson):Promise<'INSERTED'|'REPLAY'>{
      if(l.canAuthorizeLive!==false||l.canExecute!==false||l.financialAuthority!=='NONE')throw new Error('RUNPOD_SHADOW_LESSON_AUTHORITY_INVALID')
      const result=await pool.query(
        `insert into runpod_shark_shadow_lessons(lesson_id,decision_id,horizon,user_id,strategy_id,lesson_json,evaluated_at,authority,can_authorize_live)
         values($1,$2,$3,$4,$5,$6::jsonb,$7,'LEARNING_ONLY',false)
         on conflict(lesson_id) do nothing returning lesson_id`,
        [l.lessonId,l.decisionId,l.horizon,l.userId,l.strategyId,JSON.stringify(encode(l)),l.evaluatedAt],
      )
      if(result.rowCount)await enqueue('LESSON',l.lessonId,encode(l))
      return result.rowCount?'INSERTED':'REPLAY'
    },

    async listLessons(input:{userId:string;strategyId:string;through:string;limit?:number}):Promise<readonly SharkShadowCounterfactualLesson[]>{
      const limit=Math.max(1,Math.min(10000,Math.trunc(input.limit??5000)))
      const result=await pool.query(
        `select lesson_json from runpod_shark_shadow_lessons
         where user_id=$1 and strategy_id=$2 and evaluated_at <= $3
         order by evaluated_at desc limit $4`,
        [input.userId,input.strategyId,input.through,limit],
      )
      return Object.freeze(result.rows.map((r:any)=>decodeLesson(r.lesson_json)))
    },

    async appendCalibration(c:SharkShadowPerformanceCalibration):Promise<'INSERTED'|'REPLAY'>{
      if(c.canMutateMandate!==false||c.canAuthorizeLive!==false)throw new Error('RUNPOD_SHADOW_CALIBRATION_AUTHORITY_INVALID')
      const result=await pool.query(
        `insert into runpod_shark_shadow_calibrations(
          calibration_id,user_id,strategy_id,sample_size,calibration_json,calibrated_at,authority,can_mutate_mandate,can_authorize_live
        ) values($1,$2,$3,$4,$5::jsonb,$6,'LEARNING_ONLY',false,false)
        on conflict(calibration_id) do nothing returning calibration_id`,
        [c.calibrationId,c.userId,c.strategyId,c.sampleSize,JSON.stringify(encode(c)),c.calibratedAt],
      )
      if(result.rowCount)await enqueue('CALIBRATION',c.calibrationId,encode(c))
      return result.rowCount?'INSERTED':'REPLAY'
    },

    async appendMemory(m:SharkShadowMemoryCard):Promise<'INSERTED'|'REPLAY'>{
      if(m.canAuthorizeLive!==false)throw new Error('RUNPOD_SHADOW_MEMORY_AUTHORITY_INVALID')
      const result=await pool.query(
        `insert into runpod_shark_shadow_memory(memory_id,user_id,strategy_id,market_regime,memory_json,created_at_evidence,authority,can_authorize_live)
         values($1,$2,$3,$4,$5::jsonb,$6,'LEARNING_MEMORY_ONLY',false)
         on conflict(memory_id) do nothing returning memory_id`,
        [m.memoryId,m.userId,m.strategyId,m.marketRegime,JSON.stringify(encode(m)),m.createdAt],
      )
      if(result.rowCount)await enqueue('MEMORY',m.memoryId,encode(m))
      return result.rowCount?'INSERTED':'REPLAY'
    },

    async listMemoryCards(input:{userId:string;strategyId:string;through:string;limit?:number}):Promise<readonly SharkShadowMemoryCard[]>{
      const limit=Math.max(1,Math.min(1000,Math.trunc(input.limit??200)))
      const result=await pool.query(
        `select memory_json from runpod_shark_shadow_memory
         where user_id=$1 and strategy_id=$2 and created_at_evidence <= $3
         order by created_at_evidence desc limit $4`,
        [input.userId,input.strategyId,input.through,limit],
      )
      return Object.freeze(result.rows.map((r:any)=>decodeMemory(r.memory_json)))
    },

    async putRuntimeState(key:string,value:unknown):Promise<void>{
      await pool.query(
        `insert into runpod_shark_shadow_runtime_state(state_key,state_json,updated_at)
         values($1,$2::jsonb,current_timestamp)
         on conflict(state_key) do update set state_json=excluded.state_json,updated_at=current_timestamp`,
        [key,JSON.stringify(encode(value))],
      )
    },

    async getRuntimeState<T=unknown>(key:string):Promise<T|undefined>{
      const result=await pool.query('select state_json from runpod_shark_shadow_runtime_state where state_key=$1 limit 1',[key])
      return result.rows[0]?(result.rows[0] as any).state_json as T:undefined
    },

    async appendReplayReceipt(replayId:string,payload:unknown):Promise<void>{
      await enqueue('REPLAY',replayId,payload)
      await pool.query(
        `insert into runpod_shark_shadow_runtime_state(state_key,state_json,updated_at)
         values('last-replay',$1::jsonb,current_timestamp)
         on conflict(state_key) do update set state_json=excluded.state_json,updated_at=current_timestamp`,
        [JSON.stringify(encode(payload))],
      )
    },

    async pendingSync(input:{limit?:number}={}):Promise<readonly Readonly<{syncId:number;recordType:string;recordId:string;payload:unknown;createdAt:string}>[]>{
      const limit=Math.max(1,Math.min(5000,Math.trunc(input.limit??1000)))
      const result=await pool.query(
        `select sync_id,record_type,record_id,payload_json,created_at
         from runpod_shark_shadow_sync_queue
         where status='PENDING' order by sync_id asc limit $1`,[limit],
      )
      return Object.freeze(result.rows.map((r:any)=>Object.freeze({
        syncId:Number(r.sync_id),recordType:String(r.record_type),recordId:String(r.record_id),payload:r.payload_json,createdAt:new Date(r.created_at).toISOString(),
      })))
    },

    async markExported(syncIds:readonly number[],exportedAt:string):Promise<void>{
      if(!syncIds.length)return
      await pool.query(
        `update runpod_shark_shadow_sync_queue
         set status='EXPORTED',exported_at=$2
         where sync_id=any($1::bigint[]) and status='PENDING'`,
        [syncIds,exportedAt],
      )
    },

    async counts():Promise<Readonly<Record<string,number>>>{
      const names=['runpod_shadow_market_samples','runpod_shark_shadow_decisions','runpod_shark_shadow_executions','runpod_shark_shadow_observations','runpod_shark_shadow_lessons','runpod_shark_shadow_calibrations','runpod_shark_shadow_memory','runpod_shark_shadow_sync_queue']
      const out:Record<string,number>={}
      for(const name of names){
        const result=await pool.query(`select count(*)::bigint as n from ${name}`)
        out[name]=Number((result.rows[0] as any).n)
      }
      return Object.freeze(out)
    },

    async liveCertificationSnapshot():Promise<Readonly<{
      observationCounts:Readonly<Record<string,number>>
      lessonCounts:Readonly<Record<string,number>>
      calibrationCount:number
      memoryCount:number
      pendingSync:number
      firstObservationAt?:string
      firstLessonAt?:string
      latestCalibration?:unknown
      latestMemory?:unknown
    }>>{
      const [obs,lessons,calibration,memory,sync]=await Promise.all([
        pool.query(`select horizon,count(*)::bigint as n,min(observed_at) as first_at from runpod_shark_shadow_observations group by horizon`),
        pool.query(`select horizon,count(*)::bigint as n,min(evaluated_at) as first_at from runpod_shark_shadow_lessons group by horizon`),
        pool.query(`select calibration_json from runpod_shark_shadow_calibrations order by calibrated_at desc limit 1`),
        pool.query(`select memory_json from runpod_shark_shadow_memory order by created_at_evidence desc limit 1`),
        pool.query(`select count(*)::bigint as n from runpod_shark_shadow_sync_queue where status='PENDING'`),
      ])
      const observationCounts:Record<string,number>={}
      const lessonCounts:Record<string,number>={}
      let firstObservationAt:string|undefined
      let firstLessonAt:string|undefined
      for(const r of obs.rows as any[]){
        observationCounts[String(r.horizon)]=Number(r.n)
        const t=r.first_at?new Date(r.first_at).toISOString():undefined
        if(t&&(!firstObservationAt||t<firstObservationAt))firstObservationAt=t
      }
      for(const r of lessons.rows as any[]){
        lessonCounts[String(r.horizon)]=Number(r.n)
        const t=r.first_at?new Date(r.first_at).toISOString():undefined
        if(t&&(!firstLessonAt||t<firstLessonAt))firstLessonAt=t
      }
      const calibrationCountResult=await pool.query(`select count(*)::bigint as n from runpod_shark_shadow_calibrations`)
      const memoryCountResult=await pool.query(`select count(*)::bigint as n from runpod_shark_shadow_memory`)
      return Object.freeze({
        observationCounts:Object.freeze(observationCounts),
        lessonCounts:Object.freeze(lessonCounts),
        calibrationCount:Number((calibrationCountResult.rows[0] as any).n),
        memoryCount:Number((memoryCountResult.rows[0] as any).n),
        pendingSync:Number((sync.rows[0] as any).n),
        firstObservationAt,firstLessonAt,
        latestCalibration:calibration.rows[0]?(calibration.rows[0] as any).calibration_json:undefined,
        latestMemory:memory.rows[0]?(memory.rows[0] as any).memory_json:undefined,
      })
    },

    async close():Promise<void>{await pool.end()},
  })
}
