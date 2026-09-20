import type { Opportunity } from '@jhadina/opportunity-core'

export type SamProductionIngestionAudit = {
  inputCount:number
  canonicalCount:number
  duplicateIds:string[]
  invalidIds:string[]
  expiredIds:string[]
  status:'pass'|'review_required'|'blocked'
  blockers:string[]
}

export function auditSamProductionIngestion(
  opportunities:Opportunity[],
  now=new Date().toISOString(),
):SamProductionIngestionAudit{
  const seen=new Set<string>(),duplicateIds:string[]=[],invalidIds:string[]=[],expiredIds:string[]=[]
  const nowMs=Date.parse(now)
  if(!Number.isFinite(nowMs))throw new Error('SAM production audit time is invalid')
  for(const opportunity of opportunities){
    if(seen.has(opportunity.id))duplicateIds.push(opportunity.id)
    seen.add(opportunity.id)
    if(opportunity.type!=='contract'||opportunity.sourceId!=='us.sam.gov'||!opportunity.sourceUrl||!opportunity.title.trim())invalidIds.push(opportunity.id)
    if(opportunity.deadline){
      const deadline=Date.parse(opportunity.deadline)
      if(Number.isFinite(deadline)&&deadline<=nowMs)expiredIds.push(opportunity.id)
    }
  }
  const blockers=[
    ...invalidIds.map(id=>`Invalid canonical SAM opportunity: ${id}`),
    ...duplicateIds.map(id=>`Duplicate canonical SAM opportunity: ${id}`),
  ]
  return {
    inputCount:opportunities.length,
    canonicalCount:opportunities.length-invalidIds.length,
    duplicateIds:[...new Set(duplicateIds)],
    invalidIds:[...new Set(invalidIds)],
    expiredIds:[...new Set(expiredIds)],
    status:blockers.length?'blocked':expiredIds.length?'review_required':'pass',
    blockers,
  }
}
