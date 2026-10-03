import type {SupabaseClient} from '@supabase/supabase-js'
import {
  matchPrimeToSubcontractors,
  type BrokerProviderCandidate,
  type PrimeSubcontractorCandidate,
  type PublicAwardPrimeFingerprint,
  type PublicSubcontractWorkPackage,
} from '@jhadina/opportunity-core'
import {normalizeRelationshipIdentity,type RelationshipActivity,type RelationshipEdge} from '@jhadina/relationship-core'
import {ProductionRelationshipRepository} from './production-repository'

type Row=Record<string,unknown>

const strings=(value:unknown):string[]=>
  Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'&&Boolean(item.trim())):[]

const record=(value:unknown):Record<string,unknown>=>
  value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}

const text=(value:unknown):string|undefined=>
  typeof value==='string'&&value.trim()?value.trim():undefined

const publicPrimeSlug=(value:string)=>
  value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)

export function resolvePublicWorkPackagePrimeRef(input:{
  awardedPrimeRef?:unknown
  awardedPrimeName?:unknown
}):string|undefined{
  const explicit=text(input.awardedPrimeRef)
  if(explicit)return explicit
  const name=text(input.awardedPrimeName)
  if(!name)return undefined
  const slug=publicPrimeSlug(name)
  return slug?'local-prime:'+slug:undefined
}

function evidence(value:unknown):BrokerProviderCandidate['evidence']{
  if(!Array.isArray(value))return[]
  return value.flatMap((item)=>{
    const row=record(item)
    const id=text(row.id)
    const source=text(row.source)
    if(!id||!source)return[]
    return [{
      id,
      source:source as BrokerProviderCandidate['evidence'][number]['source'],
      ...(text(row.url)?{url:text(row.url)}:{}),
      ...(row.details&&typeof row.details==='object'?{details:row.details as Record<string,unknown>}:{})
    }]
  })
}

async function resolveExternalEntity(
  client:SupabaseClient,
  ownerUserId:string,
  externalValue:string,
):Promise<string|undefined>{
  const normalized=normalizeRelationshipIdentity('external',externalValue)
  const {data,error}=await client.from('jhadina_relationship_identities')
    .select('entity_id')
    .eq('user_id',ownerUserId)
    .eq('scheme','external')
    .eq('normalized_value',normalized)
    .maybeSingle()
  if(error)throw new Error('RELATIONSHIP_PRIME_SUB_IDENTITY_LOOKUP_FAILED:'+error.message)
  return data?.entity_id?String(data.entity_id):undefined
}

export async function reconcilePrimeSubcontractorMatches(
  client:SupabaseClient,
  repo:ProductionRelationshipRepository,
  input:{limit?:number;now?:string}={},
){
  const limit=Math.min(Math.max(input.limit??250,1),1000)
  const now=input.now??new Date().toISOString()

  const {data:packages,error:packageError}=await client.from('jhadina_public_work_packages')
    .select('*')
    .in('status',['candidate','review_required'])
    .order('updated_at',{ascending:false})
    .limit(limit)
  if(packageError)throw new Error('RELATIONSHIP_PRIME_SUB_PACKAGE_SCAN_FAILED:'+packageError.message)
  if(!(packages??[]).length)return Object.freeze({packages:0,matched:0,review:0,blocked:0,persistedEdges:0})

  const primeRefs=[...new Set((packages??[]).map(row=>resolvePublicWorkPackagePrimeRef({
    awardedPrimeRef:row.awarded_prime_ref,
    awardedPrimeName:row.awarded_prime_name,
  })).filter((value):value is string=>Boolean(value)))]
  const packageIds=(packages??[]).map(row=>String(row.id))

  const [primeResult,candidateResult]=await Promise.all([
    primeRefs.length
      ?client.from('jhadina_public_prime_profiles').select('*').in('provider_id',primeRefs).limit(limit)
      :Promise.resolve({data:[],error:null}),
    packageIds.length
      ?client.from('jhadina_public_package_provider_candidates').select('*').in('package_id',packageIds).limit(limit*10)
      :Promise.resolve({data:[],error:null}),
  ])
  if(primeResult.error)throw new Error('RELATIONSHIP_PRIME_SUB_PRIME_SCAN_FAILED:'+primeResult.error.message)
  if(candidateResult.error)throw new Error('RELATIONSHIP_PRIME_SUB_PROVIDER_SCAN_FAILED:'+candidateResult.error.message)

  const primeById=new Map((primeResult.data??[]).map(row=>[String(row.provider_id),row as Row]))
  const candidatesByPackage=new Map<string,Row[]>()
  for(const row of candidateResult.data??[]){
    const key=String(row.package_id)
    const rows=candidatesByPackage.get(key)??[]
    rows.push(row as Row)
    candidatesByPackage.set(key,rows)
  }

  let matched=0,review=0,blocked=0,persistedEdges=0
  for(const raw of packages??[]){
    const row=raw as Row
    const primeRef=resolvePublicWorkPackagePrimeRef({
      awardedPrimeRef:row.awarded_prime_ref,
      awardedPrimeName:row.awarded_prime_name,
    })
    if(!primeRef)continue
    const primeRow=primeById.get(primeRef)
    if(!primeRow)continue
    const prime=primeFromRow(primeRow)
    const pkg=packageFromRow(row)
    const candidateRows=candidatesByPackage.get(pkg.id)??[]
    const candidates=candidateRows.map(candidateFromRow)
    const matrix=matchPrimeToSubcontractors({
      opportunityId:pkg.opportunityId,
      prime,
      workPackages:[pkg],
      subcontractors:candidates,
      now,
      maxPerPackage:10,
    })
    matched+=matrix.candidateCount
    review+=matrix.reviewCount
    blocked+=matrix.blockedCount

    const primeEntityId=await resolveExternalEntity(client,repo.ownerUserId,'public-prime:'+prime.providerId)
    if(!primeEntityId)continue

    for(const match of matrix.matches.filter(item=>item.disposition!=='blocked')){
      const subEntityId=
        await resolveExternalEntity(client,repo.ownerUserId,'public-provider:'+match.subcontractorProviderId)
        ??await resolveExternalEntity(client,repo.ownerUserId,'sam-provider:'+match.subcontractorProviderId)
      if(!subEntityId||subEntityId===primeEntityId)continue

      const contextRef='opportunity:'+match.opportunityId+':package:'+match.workPackageId
      const edge:RelationshipEdge={
        id:'edge:prime-sub:'+primeEntityId+':'+subEntityId+':'+match.workPackageId,
        fromEntityId:primeEntityId,
        toEntityId:subEntityId,
        relation:match.disposition==='matched_candidate'?'matched_subcontractor':'subcontractor_review_candidate',
        contextRef,
        validFrom:now,
        evidenceRefs:[...match.evidenceRefs],
      }
      await repo.upsertEdge(edge)

      const activity:RelationshipActivity={
        id:'activity:prime-sub-match:'+primeEntityId+':'+subEntityId+':'+match.workPackageId,
        entityId:primeEntityId,
        type:'procurement.prime_subcontractor_match',
        occurredAt:now,
        contextRef,
        summary:match.primeName+' ↔ '+match.subcontractorName+' for '+match.workPackageLabel,
        evidenceRefs:[...match.evidenceRefs],
        metadata:{
          subcontractorEntityId:subEntityId,
          disposition:match.disposition,
          score:match.score,
          providerFitScore:match.providerFitScore,
          geographyScore:match.geographyScore,
          capacityScore:match.capacityScore,
          freshnessScore:match.freshnessScore,
          reasons:match.reasons,
          blockers:match.blockers,
          authority:'ANALYSIS_ONLY',
          externalContactAuthorized:false,
        },
      }
      await repo.appendActivity(activity)
      await repo.upsertSideHustlePipelineRecord({
        family:'procurement_subcontracting',
        entityId:subEntityId,
        pipelineId:'subcontractor_acquisition',
        stageId:match.disposition==='matched_candidate'?'qualified':'researched',
        values:{
          relationshipLane:'subcontractors',
          matchedPrimeEntityId:primeEntityId,
          workPackageId:match.workPackageId,
          opportunityRef:match.opportunityId,
          matchScore:match.score,
          matchDisposition:match.disposition,
        },
        updatedAt:now,
      })
      await repo.upsertSideHustlePipelineRecord({
        family:'procurement_subcontracting',
        entityId:primeEntityId,
        pipelineId:'sam_teaming',
        stageId:'qualified',
        values:{
          relationshipLane:'primes',
          matchedSubcontractorEntityId:subEntityId,
          workPackageId:match.workPackageId,
          opportunityRef:match.opportunityId,
          matchScore:match.score,
          matchDisposition:match.disposition,
        },
        updatedAt:now,
      })
      persistedEdges+=1
    }
  }

  return Object.freeze({
    packages:(packages??[]).length,
    matched,
    review,
    blocked,
    persistedEdges,
    externalContactAuthorized:false as const,
  })
}

function primeFromRow(row:Row):PublicAwardPrimeFingerprint{
  return {
    providerId:String(row.provider_id),
    providerName:String(row.provider_name),
    awardCount:Number(row.award_count??0),
    totalObservedAwardValue:typeof row.total_observed_award_value==='number'?row.total_observed_award_value:undefined,
    states:strings(row.states),
    buyers:strings(row.buyers),
    naicsCodes:strings(row.naics_codes),
    pscCodes:strings(row.psc_codes),
    capabilityKeywords:strings(row.capability_keywords),
    evidenceRefs:strings(row.evidence_refs),
  }
}

function packageFromRow(row:Row):PublicSubcontractWorkPackage{
  const estimatedMin=typeof row.estimated_value_min==='number'?row.estimated_value_min:undefined
  const estimatedMax=typeof row.estimated_value_max==='number'?row.estimated_value_max:undefined
  const currency=text(row.currency)
  return {
    id:String(row.id),
    opportunityId:String(row.opportunity_id),
    awardedPrimeName:text(row.awarded_prime_name),
    awardedPrimeRef:resolvePublicWorkPackagePrimeRef({
      awardedPrimeRef:row.awarded_prime_ref,
      awardedPrimeName:row.awarded_prime_name,
    }),
    label:String(row.label),
    description:text(row.description),
    category:text(row.category),
    geography:text(row.geography),
    ...((estimatedMin!==undefined||estimatedMax!==undefined)&&currency?{
      estimatedValue:{...(estimatedMin!==undefined?{min:estimatedMin}:{}),...(estimatedMax!==undefined?{max:estimatedMax}:{}),currency}
    }:{}),
    requiredLicenses:strings(row.required_licenses),
    requiredCertifications:strings(row.required_certifications),
    requirement:record(row.requirement) as PublicSubcontractWorkPackage['requirement'],
    evidenceRefs:strings(row.evidence_refs),
    status:String(row.status) as PublicSubcontractWorkPackage['status'],
    blockers:strings(row.blockers),
    humanReviewRequired:true,
    automaticPrimeContactAuthorized:false,
    automaticProviderOutreachAuthorized:false,
    bidSubmissionAuthorized:false,
  }
}

function candidateFromRow(row:Row):PrimeSubcontractorCandidate{
  return {
    provider:{
      id:String(row.provider_id),
      legalName:String(row.legal_name),
      country:text(row.country),
      naicsCodes:strings(row.naics_codes),
      keywords:strings(row.keywords),
      awardCount:typeof row.award_count==='number'?row.award_count:undefined,
      previousWinSimilarity:row.previous_win_similarity&&typeof row.previous_win_similarity==='object'
        ?row.previous_win_similarity as BrokerProviderCandidate['previousWinSimilarity']
        :undefined,
      evidence:evidence(row.evidence),
    },
    serviceAreas:[],
    capacity:'unknown',
    observedAt:text(row.updated_at)??text(row.discovered_at),
  }
}
