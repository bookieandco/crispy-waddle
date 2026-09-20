import type { FulfillmentProvider } from './fulfillment-provider.js'

export type ProviderIdentityCandidate = {
  providerId: string
  legalName: string
  uei?: string
  cage?: string
  registrationNumber?: string
  jurisdiction?: string
  evidenceRefs: string[]
}

export type ProviderIdentityResolution = {
  inputName: string
  status: 'matched' | 'ambiguous' | 'unmatched'
  confidence: 'high' | 'medium' | 'low'
  matchedProviderId?: string
  candidateProviderIds: string[]
  reasons: string[]
}

export type ProviderAwardRecord = {
  id: string
  recipientName: string
  recipientUei?: string
  recipientCage?: string
  agency?: string
  amount?: number
  currency: string
  awardedAt?: string
  startAt?: string
  endAt?: string
  naicsCode?: string
  pscCode?: string
  evidenceRefs: string[]
}

export type ResolvedProviderAward = ProviderAwardRecord & {
  providerId: string
  identityConfidence: ProviderIdentityResolution['confidence']
}

function normalizeName(value:string):string{
  return value.toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9 ]/g,' ').replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|co|company)\b/g,' ').replace(/\s+/g,' ').trim()
}
function clean(v?:string){return v?.trim().toLowerCase()}

export function providerToIdentityCandidate(provider:FulfillmentProvider):ProviderIdentityCandidate{
  const id=(type:string)=>provider.identifiers.find(x=>x.type===type&&x.verified)
  return {
    providerId:provider.id,legalName:provider.legalName,
    uei:id('uei')?.value,cage:id('cage')?.value,
    registrationNumber:id('state_registration')?.value,
    jurisdiction:id('state_registration')?.jurisdiction,
    evidenceRefs:[...new Set(provider.identifiers.flatMap(x=>x.evidenceRefs))],
  }
}

export function resolveProviderIdentity(
  input:{legalName:string;uei?:string;cage?:string;registrationNumber?:string;jurisdiction?:string},
  candidates:ProviderIdentityCandidate[],
):ProviderIdentityResolution{
  if(!input.legalName.trim()) throw new Error('Provider legal name is required')
  const name=normalizeName(input.legalName),uei=clean(input.uei),cage=clean(input.cage),reg=clean(input.registrationNumber),jur=clean(input.jurisdiction)
  const ranked=candidates.map(candidate=>{
    const exactName=normalizeName(candidate.legalName)===name
    const ueiMatch=Boolean(uei&&clean(candidate.uei)===uei)
    const cageMatch=Boolean(cage&&clean(candidate.cage)===cage)
    const regMatch=Boolean(reg&&clean(candidate.registrationNumber)===reg)
    const jurMatch=Boolean(jur&&clean(candidate.jurisdiction)===jur)
    const score=(ueiMatch?120:0)+(cageMatch?110:0)+(regMatch?100:0)+(exactName?50:0)+(jurMatch?20:0)
    return {candidate,score,exactName,ueiMatch,cageMatch,regMatch,jurMatch}
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.candidate.providerId.localeCompare(b.candidate.providerId))
  if(!ranked.length)return {inputName:input.legalName.trim(),status:'unmatched',confidence:'low',candidateProviderIds:[],reasons:['No provider candidate matched supplied identifiers.']}
  const best=ranked[0],tied=ranked.filter(x=>x.score===best.score)
  const strong=best.ueiMatch||best.cageMatch||best.regMatch||(best.exactName&&best.jurMatch)
  return {
    inputName:input.legalName.trim(),
    status:tied.length>1?'ambiguous':'matched',
    confidence:tied.length>1?'low':strong?'high':'medium',
    matchedProviderId:tied.length===1?best.candidate.providerId:undefined,
    candidateProviderIds:ranked.map(x=>x.candidate.providerId),
    reasons:[
      ...(best.ueiMatch?['UEI matched.']:[]),...(best.cageMatch?['CAGE matched.']:[]),
      ...(best.regMatch?['Registration matched.']:[]),...(best.exactName?['Normalized legal name matched.']:[]),
      ...(best.jurMatch?['Jurisdiction matched.']:[]),
      ...(tied.length>1?['Multiple candidates share the top score; human identity review is required.']:[]),
    ],
  }
}

export function resolveAwardToProvider(
  award:ProviderAwardRecord,
  candidates:ProviderIdentityCandidate[],
):{resolution:ProviderIdentityResolution;award?:ResolvedProviderAward}{
  const resolution=resolveProviderIdentity({legalName:award.recipientName,uei:award.recipientUei,cage:award.recipientCage},candidates)
  if(resolution.status!=='matched'||!resolution.matchedProviderId)return {resolution}
  return {resolution,award:{...award,providerId:resolution.matchedProviderId,identityConfidence:resolution.confidence}}
}

export function summarizeProviderAwards(providerId:string,awards:ResolvedProviderAward[]){
  const own=awards.filter(a=>a.providerId===providerId)
  return {
    providerId,
    awardCount:own.length,
    totalKnownAwardValue:own.reduce((sum,a)=>sum+(a.amount??0),0),
    agencies:[...new Set(own.map(a=>a.agency).filter((x):x is string=>Boolean(x)))],
    naicsCodes:[...new Set(own.map(a=>a.naicsCode).filter((x):x is string=>Boolean(x)))],
    pscCodes:[...new Set(own.map(a=>a.pscCode).filter((x):x is string=>Boolean(x)))],
    evidenceRefs:[...new Set(own.flatMap(a=>a.evidenceRefs))],
  }
}
