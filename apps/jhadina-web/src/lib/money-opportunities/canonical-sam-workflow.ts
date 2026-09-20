import {
  adaptSamOpportunity,
  decomposeOpportunityRequirements,
  type Opportunity,
  type SamOpportunityInput,
} from '@jhadina/opportunity-core'

export type RawSamNotice = Record<string, unknown>

function txt(value:unknown):string{return typeof value==='string'?value.trim():''}
function first(...values:unknown[]):string{return values.map(txt).find(Boolean)??''}
function num(value:unknown):number|undefined{
  if(typeof value==='number'&&Number.isFinite(value))return value
  if(typeof value==='string'){const n=Number(value.replace(/[$,]/g,''));return Number.isFinite(n)?n:undefined}
  return undefined
}
function rows(data:unknown):RawSamNotice[]{
  const root=data&&typeof data==='object'?data as Record<string,unknown>:{}
  const raw=Array.isArray(root.opportunitiesData)?root.opportunitiesData:Array.isArray(root.opportunities)?root.opportunities:Array.isArray(root.results)?root.results:Array.isArray(data)?data:[]
  return raw.filter((x):x is RawSamNotice=>Boolean(x&&typeof x==='object'))
}

export function normalizeRawSamNotice(notice:RawSamNotice,fetchedAt=new Date().toISOString()):SamOpportunityInput{
  const noticeId=first(notice.noticeId,notice.solicitationNumber,notice.contractOpportunityId)
  if(!noticeId)throw new Error('SAM notice is missing a stable notice identifier')
  const place=notice.placeOfPerformance
  return {
    noticeId,
    title:first(notice.title,notice.subject,'SAM.gov opportunity'),
    noticeType:first(notice.type,notice.noticeType,notice.typeOfNotice)||undefined,
    solicitationNumber:first(notice.solicitationNumber)||undefined,
    department:first(notice.fullParentPathName,notice.department,notice.organizationName)||undefined,
    office:first(notice.office,notice.officeAddress,notice.subTier)||undefined,
    naicsCode:first(notice.naicsCode,notice.naics)||undefined,
    setAside:first(notice.typeOfSetAsideDescription,notice.typeOfSetAside,notice.setAside)||undefined,
    responseDeadline:first(notice.responseDeadLine,notice.responseDeadline,notice.archiveDate)||undefined,
    estimatedValue:num(notice.awardCeiling)??num(notice.baseAndAllOptionsValue)??num(notice.baseAndAllOptionsValueSupplied),
    placeOfPerformance:typeof place==='string'?place:place&&typeof place==='object'?JSON.stringify(place):undefined,
    description:first(notice.description,notice.title)||undefined,
    sourceUrl:first(notice.uiLink,notice.url,notice.link)||`https://sam.gov/opp/${noticeId}/view`,
    fetchedAt,
  }
}

export function canonicalizeSamNotice(notice:RawSamNotice,fetchedAt?:string):Opportunity{
  return adaptSamOpportunity(normalizeRawSamNotice(notice,fetchedAt))
}

export function canonicalizeSamResults(data:unknown,fetchedAt?:string):Opportunity[]{
  return rows(data).map(row=>canonicalizeSamNotice(row,fetchedAt))
}

export function buildCanonicalSamPreview(notice:RawSamNotice,fetchedAt?:string){
  const opportunity=canonicalizeSamNotice(notice,fetchedAt)
  const requirements=decomposeOpportunityRequirements(opportunity,fetchedAt)
  return {opportunity,requirements}
}

export const LEGACY_SAM_MODULES = Object.freeze([
  'sam-types.ts',
  'sam-ranking.ts',
  'sam-intelligence.ts',
  'sam-opportunity-adapter.ts',
  'partner-discovery.ts',
  'economics.ts',
  'action-queue.ts',
] as const)

export const CANONICAL_SAM_BOUNDARY = Object.freeze({
  owner:'@jhadina/opportunity-core',
  appResponsibility:'transport-ui-adapters-only',
  callerControlledUserId:false,
  rawSamIsDomainModel:false,
  advisoryActionLabelsAreAuthorization:false,
})
