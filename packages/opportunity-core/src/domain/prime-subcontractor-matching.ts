import type {BrokerProviderCandidate} from './sam-provider-broker.js'
import {assessBrokerProvider,buildProviderSearchIntents} from './sam-provider-broker.js'
import type {PublicAwardPrimeFingerprint,PublicSubcontractWorkPackage} from './public-award-prime.js'

export type PrimeSubcontractorCandidate={
  provider:BrokerProviderCandidate
  serviceAreas?:string[]
  capacity?:'available'|'limited'|'unknown'|'unavailable'
  observedAt?:string
}

export type PrimeSubcontractorMatchDisposition='matched_candidate'|'review_required'|'blocked'

export type PrimeSubcontractorMatch={
  id:string
  opportunityId:string
  primeProviderId:string
  primeName:string
  subcontractorProviderId:string
  subcontractorName:string
  workPackageId:string
  workPackageLabel:string
  disposition:PrimeSubcontractorMatchDisposition
  score:number
  providerFitScore:number
  geographyScore:number
  capacityScore:number
  freshnessScore:number
  reasons:string[]
  blockers:string[]
  evidenceRefs:string[]
  externalContactAuthorized:false
  automaticProviderOutreachAuthorized:false
  bidSubmissionAuthorized:false
}

export type PrimeSubcontractorMatrix={
  opportunityId:string
  primeProviderId:string
  primeName:string
  workPackageCount:number
  candidateCount:number
  reviewCount:number
  blockedCount:number
  matches:PrimeSubcontractorMatch[]
  externalContactAuthorized:false
}

const uniq=(values:string[])=>[...new Set(values.map(v=>v.trim()).filter(Boolean))]
const clamp=(value:number)=>Math.max(0,Math.min(100,Math.round(value)))

function tokenOverlap(required:string,areas:string[]):number{
  const needle=required.trim().toLowerCase()
  if(!needle||areas.length===0)return 0
  const terms=needle.split(/[^a-z0-9]+/).filter(v=>v.length>1)
  if(!terms.length)return 0
  const hay=areas.join(' ').toLowerCase()
  const hits=terms.filter(term=>hay.includes(term)).length
  return hits/terms.length
}

function geographyScore(pkg:PublicSubcontractWorkPackage,candidate:PrimeSubcontractorCandidate):{score:number;reasons:string[];blockers:string[]}{
  if(!pkg.geography)return {score:50,reasons:['Work package has no specific geography constraint.'],blockers:[]}
  const areas=uniq(candidate.serviceAreas??[])
  if(areas.length){
    const overlap=tokenOverlap(pkg.geography,areas)
    if(overlap>=0.5)return {score:100,reasons:['Provider service area overlaps the work-package geography.'],blockers:[]}
    if(overlap>0)return {score:60,reasons:['Provider service area partially overlaps the work-package geography.'],blockers:['Geography coverage needs confirmation.']}
    return {score:0,reasons:[],blockers:['No evidence-backed service-area overlap for the work-package geography.']}
  }
  const country=(candidate.provider.country??'').trim().toUpperCase().replace(/[^A-Z]/g,'')
  if(['US','USA','UNITEDSTATES','UNITEDSTATESOFAMERICA'].includes(country)){
    return {score:45,reasons:['Provider is US-based, but local service-area evidence is not yet recorded.'],blockers:['Local geography requires confirmation.']}
  }
  if(country)return {score:20,reasons:['Foreign provider may still be usable for some scopes.'],blockers:['Foreign provider requires solicitation-specific origin/subcontractability review.']}
  return {score:25,reasons:[],blockers:['Provider geography is not evidenced.']}
}

function capacityScore(candidate:PrimeSubcontractorCandidate):{score:number;blockers:string[]}{
  switch(candidate.capacity){
    case 'available':return {score:100,blockers:[]}
    case 'limited':return {score:50,blockers:['Provider capacity is limited.']}
    case 'unavailable':return {score:0,blockers:['Provider capacity is unavailable.']}
    default:return {score:35,blockers:['Provider capacity is not yet verified.']}
  }
}

function freshnessScore(observedAt:string|undefined,now:string):number{
  if(!observedAt)return 40
  const observed=Date.parse(observedAt),current=Date.parse(now)
  if(!Number.isFinite(observed)||!Number.isFinite(current))return 40
  const ageDays=Math.max(0,(current-observed)/86_400_000)
  if(ageDays<=14)return 100
  if(ageDays<=30)return 80
  if(ageDays<=90)return 60
  if(ageDays<=180)return 40
  return 20
}

export function matchPrimeToSubcontractors(input:{
  opportunityId:string
  prime:PublicAwardPrimeFingerprint
  workPackages:PublicSubcontractWorkPackage[]
  subcontractors:PrimeSubcontractorCandidate[]
  now?:string
  maxPerPackage?:number
}):PrimeSubcontractorMatrix{
  if(!input.opportunityId.trim())throw new Error('Prime/subcontractor matching requires opportunityId')
  if(!input.prime.providerId.trim()||!input.prime.providerName.trim())throw new Error('Prime/subcontractor matching requires an identified prime')
  const now=input.now??new Date().toISOString()
  const limit=Math.max(1,Math.min(input.maxPerPackage??10,50))
  const matches:PrimeSubcontractorMatch[]=[]

  for(const pkg of input.workPackages.filter(row=>row.opportunityId===input.opportunityId)){
    const [intent]=buildProviderSearchIntents([pkg.requirement])
    if(!intent)continue
    for(const candidate of input.subcontractors){
      if(candidate.provider.id===input.prime.providerId)continue
      const assessment=assessBrokerProvider(intent,candidate.provider)
      const geo=geographyScore(pkg,candidate)
      const capacity=capacityScore(candidate)
      const freshness=freshnessScore(candidate.observedAt,now)
      const hardBlocked=pkg.status==='blocked'||assessment.status==='blocked'||capacity.score===0||geo.score===0
      const providerFitScore=assessment.score
      const score=clamp(providerFitScore*0.55+geo.score*0.2+capacity.score*0.15+freshness*0.1)
      const blockers=uniq([
        ...pkg.blockers,
        ...geo.blockers,
        ...capacity.blockers,
        ...(assessment.status==='blocked'?['Provider evidence is insufficient for this package.']:[]),
      ])
      const reasons=uniq([
        ...assessment.reasons,
        ...geo.reasons,
        ...(input.prime.naicsCodes.some(code=>pkg.requirement.naicsCodes?.includes(code))
          ?['Package aligns with NAICS categories already observed in the prime award history.']:[]),
      ])
      const disposition:PrimeSubcontractorMatchDisposition=
        hardBlocked?'blocked':
        assessment.status==='candidate'&&score>=65?'matched_candidate':
        'review_required'
      matches.push({
        id:'prime-sub-match:'+input.opportunityId+':'+input.prime.providerId+':'+candidate.provider.id+':'+pkg.id,
        opportunityId:input.opportunityId,
        primeProviderId:input.prime.providerId,
        primeName:input.prime.providerName,
        subcontractorProviderId:candidate.provider.id,
        subcontractorName:candidate.provider.legalName,
        workPackageId:pkg.id,
        workPackageLabel:pkg.label,
        disposition,
        score,
        providerFitScore,
        geographyScore:geo.score,
        capacityScore:capacity.score,
        freshnessScore:freshness,
        reasons,
        blockers,
        evidenceRefs:uniq([
          ...input.prime.evidenceRefs,
          ...pkg.evidenceRefs,
          ...assessment.evidenceRefs,
        ]),
        externalContactAuthorized:false,
        automaticProviderOutreachAuthorized:false,
        bidSubmissionAuthorized:false,
      })
    }
  }

  const ranked=matches
    .sort((a,b)=>{
      const rank={matched_candidate:0,review_required:1,blocked:2}
      return rank[a.disposition]-rank[b.disposition]||b.score-a.score||a.subcontractorName.localeCompare(b.subcontractorName)
    })
    .reduce<PrimeSubcontractorMatch[]>((acc,row)=>{
      const samePackage=acc.filter(item=>item.workPackageId===row.workPackageId)
      if(samePackage.length<limit)acc.push(row)
      return acc
    },[])

  return {
    opportunityId:input.opportunityId,
    primeProviderId:input.prime.providerId,
    primeName:input.prime.providerName,
    workPackageCount:input.workPackages.filter(row=>row.opportunityId===input.opportunityId).length,
    candidateCount:ranked.filter(row=>row.disposition==='matched_candidate').length,
    reviewCount:ranked.filter(row=>row.disposition==='review_required').length,
    blockedCount:ranked.filter(row=>row.disposition==='blocked').length,
    matches:ranked,
    externalContactAuthorized:false,
  }
}
