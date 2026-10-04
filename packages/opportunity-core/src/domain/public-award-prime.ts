import type { BrokerProviderCandidate, BrokerRequirement } from './sam-provider-broker.js'
import type { UsStateOrDcCode } from './public-opportunity-grid.js'

export type PublicAwardRecord={
  id:string
  opportunityId?:string
  title:string
  buyer:string
  state:UsStateOrDcCode
  county?:string
  locality?:string
  awardedPrimeName:string
  awardedPrimeRef?:string
  awardAmount?:number
  currency?:string
  naicsCode?:string
  pscCode?:string
  scopeText?:string
  awardDate?:string
  sourceUrl:string
  capturedAt:string
  evidenceRefs:string[]
}

export type PublicAwardPrimeFingerprint={
  providerId:string
  providerName:string
  awardCount:number
  totalObservedAwardValue?:number
  states:string[]
  buyers:string[]
  naicsCodes:string[]
  pscCodes:string[]
  capabilityKeywords:string[]
  evidenceRefs:string[]
}

export type PublicScopeRequirement={
  id:string
  label:string
  description?:string
  category?:string
  naicsCodes?:string[]
  pscCodes?:string[]
  keywords?:string[]
  requiredLicenses?:string[]
  requiredCertifications?:string[]
  geography?:string
  estimatedSharePct?:number
  evidenceRefs:string[]
}

export type PublicSubcontractWorkPackage={
  id:string
  opportunityId:string
  awardedPrimeName?:string
  awardedPrimeRef?:string
  label:string
  description?:string
  category?:string
  geography?:string
  estimatedValue?:{min?:number;max?:number;currency:string}
  requiredLicenses:string[]
  requiredCertifications:string[]
  requirement:BrokerRequirement
  evidenceRefs:string[]
  status:'candidate'|'review_required'|'blocked'
  blockers:string[]
  humanReviewRequired:true
  automaticPrimeContactAuthorized:false
  automaticProviderOutreachAuthorized:false
  bidSubmissionAuthorized:false
}

const uniq=(values:string[])=>[...new Set(values.map(v=>v.trim()).filter(Boolean))]
const normalizedName=(value:string)=>value.toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9 ]/g,' ').replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|co|company)\b/g,' ').replace(/\s+/g,' ').trim()
const slug=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)

function keywords(value:string|undefined):string[]{
  if(!value)return[]
  const stop=new Set(['and','the','for','with','from','this','that','will','shall','contract','county','city','state','services','service','project','work','public'])
  return uniq(value.toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(v=>v.length>=4&&!stop.has(v))).slice(0,40)
}

export function publicAwardToProviderCandidate(award:PublicAwardRecord):BrokerProviderCandidate{
  const providerId=award.awardedPrimeRef?.trim()||`local-prime:${slug(award.awardedPrimeName)}`
  return {
    id:providerId,
    legalName:award.awardedPrimeName.trim(),
    country:'US',
    naicsCodes:award.naicsCode?[award.naicsCode]:[],
    keywords:uniq([
      award.title,
      ...(award.scopeText?[award.scopeText]:[]),
      ...(award.pscCode?[`PSC ${award.pscCode}`]:[]),
    ]),
    awardCount:1,
    evidence:award.evidenceRefs.map((evidenceRef,index)=>({
      id:evidenceRef||`local-public-award:${award.id}:${index}`,
      source:'local_public_award' as const,
      url:award.sourceUrl,
      details:{
        awardId:award.id,
        opportunityId:award.opportunityId??null,
        buyer:award.buyer,
        state:award.state,
        county:award.county??null,
        locality:award.locality??null,
        awardAmount:award.awardAmount??null,
        awardDate:award.awardDate??null,
        pscCode:award.pscCode??null,
      },
    })),
  }
}

export function buildPublicAwardPrimeFingerprints(records:PublicAwardRecord[]):PublicAwardPrimeFingerprint[]{
  const groups=new Map<string,PublicAwardRecord[]>()
  for(const record of records){
    if(!record.awardedPrimeName.trim()||record.evidenceRefs.length===0)continue
    const key=record.awardedPrimeRef?.trim()||normalizedName(record.awardedPrimeName)
    const rows=groups.get(key)??[]
    rows.push(record)
    groups.set(key,rows)
  }

  return [...groups.entries()].map(([,rows])=>{
    const providerName=rows[0]!.awardedPrimeName.trim()
    const values=rows.map(row=>row.awardAmount).filter((value):value is number=>Number.isFinite(value))
    return {
      providerId:rows[0]!.awardedPrimeRef?.trim()||`local-prime:${slug(providerName)}`,
      providerName,
      awardCount:rows.length,
      totalObservedAwardValue:values.length?values.reduce((sum,value)=>sum+value,0):undefined,
      states:uniq(rows.map(row=>row.state)),
      buyers:uniq(rows.map(row=>row.buyer)),
      naicsCodes:uniq(rows.map(row=>row.naicsCode??'')),
      pscCodes:uniq(rows.map(row=>row.pscCode??'')),
      capabilityKeywords:uniq(rows.flatMap(row=>keywords(`${row.title} ${row.scopeText??''}`))).slice(0,40),
      evidenceRefs:uniq(rows.flatMap(row=>row.evidenceRefs)),
    }
  }).sort((a,b)=>b.awardCount-a.awardCount||a.providerName.localeCompare(b.providerName))
}

function packageValue(
  opportunityAmount:{min?:number;max?:number;currency:string}|undefined,
  share:number|undefined,
){
  if(!opportunityAmount||share===undefined||!Number.isFinite(share)||share<=0||share>100)return undefined
  const ratio=share/100
  return {
    ...(opportunityAmount.min!==undefined?{min:opportunityAmount.min*ratio}:{}),
    ...(opportunityAmount.max!==undefined?{max:opportunityAmount.max*ratio}:{}),
    currency:opportunityAmount.currency,
  }
}

export function compilePublicSubcontractWorkPackages(input:{
  opportunityId:string
  opportunityTitle:string
  state:UsStateOrDcCode
  county?:string
  locality?:string
  awardedPrimeName?:string
  awardedPrimeRef?:string
  opportunityAmount?:{min?:number;max?:number;currency:string}
  scopeRequirements:PublicScopeRequirement[]
  sourceEvidenceRefs:string[]
}):PublicSubcontractWorkPackage[]{
  const geography=input.locality?
    `${input.locality}, ${input.state}`:
    input.county?`${input.county} County, ${input.state}`:input.state

  return input.scopeRequirements.map((scope,index)=>{
    const evidenceRefs=uniq([...input.sourceEvidenceRefs,...scope.evidenceRefs])
    const blockers:string[]=[]
    if(!scope.label.trim())blockers.push('Scope package has no label.')
    if(evidenceRefs.length===0)blockers.push('Scope package has no source evidence.')
    if(scope.estimatedSharePct!==undefined&&(scope.estimatedSharePct<=0||scope.estimatedSharePct>100))blockers.push('Estimated package share must be greater than 0% and at most 100%.')
    if(!scope.naicsCodes?.length&&!scope.pscCodes?.length&&!scope.keywords?.length)blockers.push('Package has no capability classification evidence.')

    const requirement:BrokerRequirement={
      id:`public-work-package:${input.opportunityId}:${scope.id||index}`,
      label:scope.label.trim()||`${input.opportunityTitle} package ${index+1}`,
      naicsCodes:uniq(scope.naicsCodes??[]),
      pscCodes:uniq(scope.pscCodes??[]),
      geography:scope.geography?.trim()||geography,
      keywords:uniq([scope.description??'',scope.category??'',...(scope.keywords??[])]),
    }
    const status:PublicSubcontractWorkPackage['status']=blockers.length?'blocked':
      input.awardedPrimeName?'candidate':'review_required'
    return {
      id:requirement.id,
      opportunityId:input.opportunityId,
      awardedPrimeName:input.awardedPrimeName,
      awardedPrimeRef:input.awardedPrimeRef,
      label:requirement.label,
      description:scope.description,
      category:scope.category,
      geography:requirement.geography,
      estimatedValue:packageValue(input.opportunityAmount,scope.estimatedSharePct),
      requiredLicenses:uniq(scope.requiredLicenses??[]),
      requiredCertifications:uniq(scope.requiredCertifications??[]),
      requirement,
      evidenceRefs,
      status,
      blockers,
      humanReviewRequired:true,
      automaticPrimeContactAuthorized:false,
      automaticProviderOutreachAuthorized:false,
      bidSubmissionAuthorized:false,
    }
  })
}

export type PublicPrimePackageAssessment={
  opportunityId:string
  primeObserved:boolean
  packageCount:number
  candidatePackageCount:number
  blockedPackageCount:number
  route:'SUB_READY_FOR_REVIEW'|'PACKAGE_REVIEW_REQUIRED'|'BLOCKED'
  reasons:string[]
  blockers:string[]
  externalContactAuthorized:false
}

export function assessPublicPrimePackages(input:{
  opportunityId:string
  awardedPrimeName?:string
  packages:PublicSubcontractWorkPackage[]
}):PublicPrimePackageAssessment{
  const candidate=input.packages.filter(pkg=>pkg.status==='candidate')
  const blocked=input.packages.filter(pkg=>pkg.status==='blocked')
  const blockers=uniq(blocked.flatMap(pkg=>pkg.blockers))
  const reasons:string[]=[]
  let route:PublicPrimePackageAssessment['route']='PACKAGE_REVIEW_REQUIRED'
  if(!input.awardedPrimeName?.trim())reasons.push('No awarded prime is verified yet.')
  if(input.awardedPrimeName&&candidate.length){
    route='SUB_READY_FOR_REVIEW'
    reasons.push('Awarded prime is observed and at least one evidence-backed subcontract package is broker-ready for human review.')
  }
  if(input.packages.length>0&&blocked.length===input.packages.length)route='BLOCKED'
  return {
    opportunityId:input.opportunityId,
    primeObserved:Boolean(input.awardedPrimeName?.trim()),
    packageCount:input.packages.length,
    candidatePackageCount:candidate.length,
    blockedPackageCount:blocked.length,
    route,
    reasons,
    blockers,
    externalContactAuthorized:false,
  }
}
