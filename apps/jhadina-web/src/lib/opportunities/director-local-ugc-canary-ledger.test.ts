import {describe,expect,it} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {DirectorLocalUgcCanaryState} from '@jhadina/director-core/local-ugc-canary-commissioner'
import {
  loadLatestDirectorLocalUgcCanarySnapshot,
  persistDirectorLocalUgcCanarySnapshot,
} from './director-local-ugc-canary-ledger'

type Row=Record<string,unknown>

function state(extraEvidence:readonly string[]=[]):DirectorLocalUgcCanaryState{
  return {
    canaryId:'canary-ledger-1',
    projectId:'director:ugc:ledger-1',
    runtimeBundle:{
      schema:'director.human-media-runtime.v1',
      engine:'musetalk',
      runtimeVersion:'1.5',
      sourceRepository:'TMElyralab/MuseTalk',
      sourceRevision:'0a89dec45a0192b824e3cf4daf96c239440c5ed8',
      image:'shared-runpod-runtime',
      imageDigest:'a'.repeat(64),
      modelArtifacts:[{
        id:'musetalk-v15',
        sha256:'b'.repeat(64),
        licenseEvidenceIds:['license:musetalk:model-commercial'],
      }],
      capabilities:['lip-sync'],
      minGpuVramGiB:4,
      authority:'DIRECTOR_HUMAN_MEDIA_RUNTIME_BUNDLE',
    },
    evidenceIds:['ugc-canary:canary-ledger-1',...extraEvidence],
  }
}

function fakeClient(){
  const rows:Row[]=[]
  let nextId=1

  const client={
    from(table:string){
      expect(table).toBe('director_local_ugc_canary_receipts')
      let insertRow:Row|undefined
      const filters:Record<string,unknown>={}
      let newestFirst=false
      let limitCount:number|undefined

      const builder={
        insert(row:Row){
          insertRow={...row}
          return builder
        },
        select(_columns?:string){
          return builder
        },
        eq(column:string,value:unknown){
          filters[column]=value
          return builder
        },
        order(column:string,options?:{ascending?:boolean}){
          if(column==='observed_at'&&options?.ascending===false)newestFirst=true
          return builder
        },
        limit(value:number){
          limitCount=value
          return builder
        },
        async single(){
          if(!insertRow)return {data:null,error:{message:'insert required'}}
          const duplicate=rows.find(row=>
            row.project_id===insertRow?.project_id&&
            row.owner_user_id===insertRow?.owner_user_id&&
            row.canary_id===insertRow?.canary_id&&
            row.snapshot_sha256===insertRow?.snapshot_sha256
          )
          if(duplicate){
            return {data:null,error:{code:'23505',message:'duplicate key value violates unique constraint'}}
          }
          const stored={id:'receipt:'+nextId++,...insertRow}
          rows.push(stored)
          return {data:{...stored},error:null}
        },
        async maybeSingle(){
          let matches=rows.filter(row=>
            Object.entries(filters).every(([key,value])=>row[key]===value)
          )
          if(newestFirst){
            matches=[...matches].sort((a,b)=>
              Date.parse(String(b.observed_at))-Date.parse(String(a.observed_at))
            )
          }
          if(limitCount!==undefined)matches=matches.slice(0,limitCount)
          return {data:matches[0]?{...matches[0]}:null,error:null}
        },
      }
      return builder
    },
  }

  return {client:client as unknown as SupabaseClient,rows}
}

describe('Director local UGC canary ledger',()=>{
  it('persists a service-role evidence snapshot without granting action authority',async()=>{
    const store=fakeClient()
    const receipt=await persistDirectorLocalUgcCanarySnapshot({
      client:store.client,
      ownerUserId:'00000000-0000-0000-0000-000000000001',
      state:state(),
      observedAt:'2026-10-07T23:10:00Z',
    })
    expect(receipt.decision.nextBoundary).toBe('RUNTIME_HEALTH_REQUIRED')
    expect(receipt.decision.canCreateCompute).toBe(false)
    expect(receipt.decision.canSpend).toBe(false)
    expect(receipt.decision.canApproveCreative).toBe(false)
    expect(receipt.decision.canPublish).toBe(false)
    expect(receipt.snapshotSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(store.rows).toHaveLength(1)
  })

  it('treats retrying the exact same checkpoint as an idempotent read',async()=>{
    const store=fakeClient()
    const input={
      client:store.client,
      ownerUserId:'00000000-0000-0000-0000-000000000001',
      state:state(),
      observedAt:'2026-10-07T23:10:00Z',
    }
    const first=await persistDirectorLocalUgcCanarySnapshot(input)
    const second=await persistDirectorLocalUgcCanarySnapshot({
      ...input,
      observedAt:'2026-10-07T23:11:00Z',
    })
    expect(second.id).toBe(first.id)
    expect(second.snapshotSha256).toBe(first.snapshotSha256)
    expect(store.rows).toHaveLength(1)
  })

  it('appends a new immutable row when the evidence checkpoint genuinely changes',async()=>{
    const store=fakeClient()
    const base={
      client:store.client,
      ownerUserId:'00000000-0000-0000-0000-000000000001',
    }
    const first=await persistDirectorLocalUgcCanarySnapshot({
      ...base,state:state(),observedAt:'2026-10-07T23:10:00Z',
    })
    const second=await persistDirectorLocalUgcCanarySnapshot({
      ...base,state:state(['operator-note:runtime-requested']),observedAt:'2026-10-07T23:12:00Z',
    })
    expect(second.snapshotSha256).not.toBe(first.snapshotSha256)
    expect(store.rows).toHaveLength(2)
  })

  it('loads the latest owner/project/canary snapshot and recomputes its decision',async()=>{
    const store=fakeClient()
    const common={
      client:store.client,
      ownerUserId:'00000000-0000-0000-0000-000000000001',
    }
    await persistDirectorLocalUgcCanarySnapshot({
      ...common,state:state(),observedAt:'2026-10-07T23:10:00Z',
    })
    const latestWritten=await persistDirectorLocalUgcCanarySnapshot({
      ...common,state:state(['operator-note:newer']),observedAt:'2026-10-07T23:12:00Z',
    })
    const loaded=await loadLatestDirectorLocalUgcCanarySnapshot({
      ...common,
      projectId:'director:ugc:ledger-1',
      canaryId:'canary-ledger-1',
    })
    expect(loaded?.id).toBe(latestWritten.id)
    expect(loaded?.decision.nextBoundary).toBe('RUNTIME_HEALTH_REQUIRED')
  })

  it('detects row metadata tampering even when the stored state is unchanged',async()=>{
    const store=fakeClient()
    const common={
      client:store.client,
      ownerUserId:'00000000-0000-0000-0000-000000000001',
    }
    await persistDirectorLocalUgcCanarySnapshot({
      ...common,state:state(),observedAt:'2026-10-07T23:10:00Z',
    })
    store.rows[0]!.next_boundary='COMPLETE'
    await expect(loadLatestDirectorLocalUgcCanarySnapshot({
      ...common,
      projectId:'director:ugc:ledger-1',
      canaryId:'canary-ledger-1',
    })).rejects.toThrow('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_ROW_DRIFT')
  })

  it('detects stored decision drift and does not trust a stale completion boolean',async()=>{
    const store=fakeClient()
    const common={
      client:store.client,
      ownerUserId:'00000000-0000-0000-0000-000000000001',
    }
    await persistDirectorLocalUgcCanarySnapshot({
      ...common,state:state(),observedAt:'2026-10-07T23:10:00Z',
    })
    store.rows[0]!.commissioning_decision={
      ...(store.rows[0]!.commissioning_decision as Record<string,unknown>),
      complete:true,
      nextBoundary:'COMPLETE',
    }
    await expect(loadLatestDirectorLocalUgcCanarySnapshot({
      ...common,
      projectId:'director:ugc:ledger-1',
      canaryId:'canary-ledger-1',
    })).rejects.toThrow('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_DECISION_DRIFT')
  })

  it('refuses credential-like fields before any receipt is written',async()=>{
    const store=fakeClient()
    const unsafe={
      ...state(),
      runtimeBundle:{
        ...state().runtimeBundle,
        api_key:'must-not-persist',
      },
    } as unknown as DirectorLocalUgcCanaryState
    await expect(persistDirectorLocalUgcCanarySnapshot({
      client:store.client,
      ownerUserId:'00000000-0000-0000-0000-000000000001',
      state:unsafe,
      observedAt:'2026-10-07T23:10:00Z',
    })).rejects.toThrow('DIRECTOR_LOCAL_UGC_CANARY_LEDGER_SENSITIVE_FIELD_FORBIDDEN:api_key')
    expect(store.rows).toHaveLength(0)
  })
})
