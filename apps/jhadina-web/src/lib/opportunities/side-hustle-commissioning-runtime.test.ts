import {describe,expect,it} from 'vitest'
import {
  buildSideHustleCommissioningItem,
  getSideHustleProductionStatus,
  type SideHustleCommissioningEvidence,
} from '@jhadina/opportunity-core'
import type {SideHustleCommissioningEvidenceRepository} from './side-hustle-commissioning-repository'
import {
  listSideHustleLiveCommissioningRuntime,
  recordSideHustleCommissioningEvidenceRuntime,
} from './side-hustle-commissioning-runtime'

const now='2026-10-03T18:30:00.000Z'

function fixture(){
  const rows:SideHustleCommissioningEvidence[]=[]
  const repository:SideHustleCommissioningEvidenceRepository={
    async list(input={}){
      return rows.filter(row=>!input.family||row.family===input.family)
    },
    async record(evidence){
      const existing=rows.find(row=>row.id===evidence.id)
      if(existing){
        expect(existing).toEqual(evidence)
        return existing
      }
      rows.push(evidence)
      return evidence
    },
  }
  return{repository,rows}
}

describe('Side Hustle live commissioning runtime',()=>{
  it('certifies only after all required gates have live evidence',async()=>{
    const f=fixture()
    const plan=buildSideHustleCommissioningItem(getSideHustleProductionStatus('pod_personalized_commerce'))

    for(const [index,gateType] of plan.gateTypes.entries()){
      await recordSideHustleCommissioningEvidenceRuntime({
        id:`pod:${gateType}:${index}`,
        family:'pod_personalized_commerce',
        gateType,
        status:'passed',
        providerRef:gateType==='provider'?'printify':undefined,
        evidenceRefs:[`evidence:${gateType}`],
        observedAt:now,
        expiresAt:gateType==='credential'?'2026-10-04T18:30:00.000Z':undefined,
      },f.repository)
    }

    const result=await listSideHustleLiveCommissioningRuntime({
      family:'pod_personalized_commerce',
      evaluatedAt:now,
    },f.repository)
    expect(result.states).toHaveLength(1)
    expect(result.states[0].status).toBe('certified')
    expect(result.summary.certified).toBe(1)
    expect(result.externalActionAuthorized).toBe(false)
    expect(result.moneyMovementAuthorized).toBe(false)

    const expired=await listSideHustleLiveCommissioningRuntime({
      family:'pod_personalized_commerce',
      evaluatedAt:'2026-10-05T18:30:00.000Z',
    },f.repository)
    expect(expired.states[0].status).toBe('commissioning')
    expect(expired.states[0].gates.find(g=>g.gateType==='credential')?.status).toBe('pending')
  })

  it('returns all 26 families with capability-only trading excluded from commercial certification',async()=>{
    const f=fixture()
    const result=await listSideHustleLiveCommissioningRuntime({evaluatedAt:now},f.repository)
    expect(result.states).toHaveLength(26)
    expect(result.summary.commercial).toBe(25)
    expect(result.summary.notApplicable).toBe(1)
    expect(result.states.find(s=>s.family==='trading_investing_intelligence')?.status).toBe('not_applicable')
  })
})
