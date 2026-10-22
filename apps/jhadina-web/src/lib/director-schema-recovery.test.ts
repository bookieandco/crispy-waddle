import {describe,expect,it,vi} from 'vitest'
import {DIRECTOR_DURABLE_STORES,inspectDirectorDurableStoreReadiness} from './director-schema-recovery'

function fakeClient(errors:Readonly<Record<string,string>>={}){
  const calls:string[]=[]
  return {
    calls,
    client:{from:(table:string)=>{
      calls.push(table)
      return {select:()=>({limit:async()=>({
        error:errors[table]?{code:errors[table]}:null,
      })})}
    }} as any,
  }
}

describe('Director owner-scoped schema preflight (read-only)',()=>{
  it('observes every canonical workstation dependency and never claims durable certification',async()=>{
    const {client,calls}=fakeClient()
    const result=await inspectDirectorDurableStoreReadiness(client)
    expect(calls).toEqual([...DIRECTOR_DURABLE_STORES])
    expect(result.schemaReadable).toBe(true)
    expect(result.durableRoundTripCertified).toBe(false)
    expect(result.independentRestoreCertified).toBe(false)
    expect(result.canApplyMigrations).toBe(false)
    expect(result.authority).toBe('READ_ONLY_SCHEMA_PROBE')
  })

  it('classifies absent schema, denied access, and unknown errors without leaking details',async()=>{
    const {client}=fakeClient({
      director_workstation_timelines:'42P01',
      director_project_inputs:'42501',
      director_screenplay_blueprints:'INTERNAL',
    })
    const result=await inspectDirectorDurableStoreReadiness(client)
    expect(result.schemaReadable).toBe(false)
    expect(result.probes.find(p=>p.table==='director_workstation_timelines')?.blocker).toBe('MISSING_SCHEMA')
    expect(result.probes.find(p=>p.table==='director_project_inputs')?.blocker).toBe('ACCESS_DENIED')
    expect(result.probes.find(p=>p.table==='director_screenplay_blueprints')?.blocker).toBe('UNKNOWN')
  })

  it('fails closed on a rejected transport',async()=>{
    const client={from:()=>({select:()=>({limit:vi.fn().mockRejectedValue(new Error('provider credential'))})})} as any
    const result=await inspectDirectorDurableStoreReadiness(client)
    expect(result.schemaReadable).toBe(false)
    expect(result.probes.every(p=>p.blocker==='UNAVAILABLE')).toBe(true)
  })
})
