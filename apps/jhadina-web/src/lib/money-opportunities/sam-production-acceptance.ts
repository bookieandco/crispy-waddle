export type SamProductionAcceptanceCheck = {
  id:string
  category:'ci'|'database'|'configuration'|'live_ingestion'|'governance'|'recovery'
  status:'passed'|'failed'|'pending'|'not_run'
  evidenceRefs:string[]
  notes:string[]
}
export type SamProductionAcceptanceReport = {
  status:'accepted'|'blocked'
  checks:SamProductionAcceptanceCheck[]
  blockers:string[]
  acceptedAt?:string
  productionExecutionAuthority:false
}

const REQUIRED=['ci','database','configuration','live_ingestion','governance','recovery'] as const

export function evaluateSamProductionAcceptance(
  checks:SamProductionAcceptanceCheck[],
  now=new Date().toISOString(),
):SamProductionAcceptanceReport{
  const blockers:string[]=[]
  for(const category of REQUIRED){
    const own=checks.filter(c=>c.category===category)
    if(!own.length)blockers.push(`Missing production acceptance category: ${category}`)
    for(const check of own){
      if(check.status!=='passed')blockers.push(`Acceptance check is not passed: ${check.id}`)
      if(check.status==='passed'&&check.evidenceRefs.length===0)blockers.push(`Passed acceptance check lacks evidence: ${check.id}`)
    }
  }
  return {
    status:blockers.length?'blocked':'accepted',
    checks,
    blockers:[...new Set(blockers)],
    acceptedAt:blockers.length?undefined:now,
    productionExecutionAuthority:false,
  }
}
