export type BrokerRequirement={id:string;label:string;naicsCodes?:string[];pscCodes?:string[];geography?:string;keywords?:string[]}
export type ProviderSearchIntent={requirementId:string;keywords:string[];naicsCodes:string[];pscCodes:string[];geography?:string;allowForeign:true}
export type BrokerProviderEvidence={id:string;source:'sam_entity'|'sam_award'|'usaspending'|'fpds'|'entity_directory'|'web_search'|'local_business'|'manual';url?:string}
export type BrokerProviderCandidate={
  id:string
  legalName:string
  country?:string
  naicsCodes:string[]
  keywords:string[]
  awardCount?:number
  evidence:BrokerProviderEvidence[]
}
export type BrokerProviderAssessment={providerId:string;requirementId:string;status:'candidate'|'review_required'|'blocked';score:number;reasons:string[];evidenceRefs:string[]}

const uniq=(x:string[])=>[...new Set(x.map(v=>v.trim()).filter(Boolean))]
export function buildProviderSearchIntents(requirements:BrokerRequirement[]):ProviderSearchIntent[]{
  return requirements.map(r=>({requirementId:r.id,keywords:uniq([r.label,...(r.keywords??[])]),naicsCodes:uniq(r.naicsCodes??[]),pscCodes:uniq(r.pscCodes??[]),geography:r.geography,allowForeign:true}))
}
export function assessBrokerProvider(intent:ProviderSearchIntent,p:BrokerProviderCandidate):BrokerProviderAssessment{
  const reasons:string[]=[]
  let score=0
  const naics=intent.naicsCodes.some(n=>p.naicsCodes.includes(n))
  const hay=p.keywords.join(' ').toLowerCase()
  const keyword=intent.keywords.some(k=>hay.includes(k.toLowerCase()))
  if(naics){score+=45;reasons.push('NAICS capability match')}
  if(keyword){score+=25;reasons.push('requirement keyword match')}
  if((p.awardCount??0)>0){score+=20;reasons.push('federal award history observed')}
  if(p.evidence.length>=2){score+=10;reasons.push('multi-source provider evidence')}
  const status=p.evidence.length===0?'blocked':score>=50?'candidate':'review_required'
  if(p.country&&p.country.toUpperCase()!=='US')reasons.push('foreign provider: run solicitation-specific subcontractability/origin gate')
  return {providerId:p.id,requirementId:intent.requirementId,status,score:Math.min(100,score),reasons,evidenceRefs:p.evidence.map(e=>e.id)}
}
export function buildBrokerShortlist(requirements:BrokerRequirement[],providers:BrokerProviderCandidate[]){
  return buildProviderSearchIntents(requirements).map(intent=>({
    intent,
    candidates:providers.map(p=>assessBrokerProvider(intent,p)).filter(x=>x.status!=='blocked').sort((a,b)=>b.score-a.score),
  }))
}
