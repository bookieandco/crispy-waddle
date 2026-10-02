import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assessPublicWorkPackageCompliance,
  buildPublicAwardPrimeFingerprints,
  compilePublicSubcontractWorkPackages,
  type PublicAwardRecord,
  type PublicOpportunitySignal,
  type PublicScopeRequirement,
} from '@jhadina/opportunity-core'

type InboxAwardRow={
  id:string
  source_id:string
  external_id:string|null
  title:string
  source_url:string
  payload:{
    signal?:PublicOpportunitySignal
    scopeRequirements?:unknown
  }
  captured_at:string
  last_seen_at:string
}

const text=(value:unknown)=>typeof value==='string'?value.trim():''
const texts=(value:unknown)=>Array.isArray(value)?value.filter((x):x is string=>typeof x==='string').map(x=>x.trim()).filter(Boolean):[]
const uniq=(values:string[])=>[...new Set(values.map(v=>v.trim()).filter(Boolean))]

function scopeRequirements(value:unknown):PublicScopeRequirement[]{
  if(!Array.isArray(value))return[]
  const out:PublicScopeRequirement[]=[]
  for(const raw of value){
    if(!raw||typeof raw!=='object')continue
    const row=raw as Record<string,unknown>
    const id=text(row.id)
    const label=text(row.label)
    const evidenceRefs=texts(row.evidenceRefs)
    if(!id||!label||evidenceRefs.length===0)continue
    const share=typeof row.estimatedSharePct==='number'&&Number.isFinite(row.estimatedSharePct)?row.estimatedSharePct:undefined
    out.push({
      id,
      label,
      description:text(row.description)||undefined,
      category:text(row.category)||undefined,
      naicsCodes:texts(row.naicsCodes),
      pscCodes:texts(row.pscCodes),
      keywords:texts(row.keywords),
      requiredLicenses:texts(row.requiredLicenses),
      requiredCertifications:texts(row.requiredCertifications),
      geography:text(row.geography)||undefined,
      estimatedSharePct:share,
      evidenceRefs,
    })
  }
  return out
}

function awardRecord(row:InboxAwardRow):PublicAwardRecord|undefined{
  const signal=row.payload.signal
  if(!signal||signal.stage!=='award'||!signal.awardedPrimeName?.trim()||!signal.evidenceRef)return undefined
  return {
    id:`public-award:${row.id}`,
    opportunityId:signal.id,
    title:signal.title,
    buyer:signal.buyer?.trim()||signal.sourceName,
    state:signal.state,
    county:signal.county,
    locality:signal.locality,
    awardedPrimeName:signal.awardedPrimeName.trim(),
    awardedPrimeRef:signal.awardedPrimeRef?.trim()||undefined,
    awardAmount:signal.amount?.max,
    currency:signal.amount?.currency,
    naicsCode:signal.naicsCode,
    pscCode:signal.pscCode,
    scopeText:signal.description,
    sourceUrl:signal.sourceUrl,
    capturedAt:signal.capturedAt,
    evidenceRefs:uniq([signal.evidenceRef]),
  }
}

async function persistAwards(client:SupabaseClient,rows:Array<{inbox:InboxAwardRow;award:PublicAwardRecord}>,now:string){
  if(!rows.length)return
  const payload=rows.map(({inbox,award})=>({
    id:award.id,
    opportunity_id:award.opportunityId??null,
    inbox_id:inbox.id,
    source_id:inbox.source_id,
    external_id:inbox.external_id,
    title:award.title,
    buyer:award.buyer,
    state_code:award.state,
    county_name:award.county??null,
    locality:award.locality??null,
    awarded_prime_name:award.awardedPrimeName,
    awarded_prime_ref:award.awardedPrimeRef??null,
    award_amount:award.awardAmount??null,
    currency:award.currency??null,
    naics_code:award.naicsCode??null,
    psc_code:award.pscCode??null,
    scope_text:award.scopeText??null,
    award_date:award.awardDate??null,
    source_url:award.sourceUrl,
    captured_at:award.capturedAt,
    evidence_refs:award.evidenceRefs,
    payload:{signal:inbox.payload.signal},
    last_seen_at:inbox.last_seen_at||now,
    updated_at:now,
  }))
  const {error}=await client.from('jhadina_public_awards').upsert(payload,{onConflict:'id'})
  if(error)throw new Error(`public_awards_persist_failed:${error.message}`)
}

async function loadAllAwardsForProfiles(client:SupabaseClient){
  const rows:any[]=[]
  const pageSize=1000
  for(let from=0;;from+=pageSize){
    const {data,error}=await client
      .from('jhadina_public_awards')
      .select('id,opportunity_id,title,buyer,state_code,county_name,locality,awarded_prime_name,awarded_prime_ref,award_amount,currency,naics_code,psc_code,scope_text,award_date,source_url,captured_at,evidence_refs')
      .order('captured_at',{ascending:false})
      .range(from,from+pageSize-1)
    if(error)throw new Error(`public_awards_profile_read_failed:${error.message}`)
    const page=data??[]
    rows.push(...page)
    if(page.length<pageSize)break
  }
  return rows
}

async function rebuildPrimeProfiles(client:SupabaseClient,now:string){
  const rows=await loadAllAwardsForProfiles(client)
  const records:PublicAwardRecord[]=rows.map((row:any)=>({
    id:row.id,
    opportunityId:row.opportunity_id??undefined,
    title:row.title,
    buyer:row.buyer,
    state:row.state_code,
    county:row.county_name??undefined,
    locality:row.locality??undefined,
    awardedPrimeName:row.awarded_prime_name,
    awardedPrimeRef:row.awarded_prime_ref??undefined,
    awardAmount:row.award_amount??undefined,
    currency:row.currency??undefined,
    naicsCode:row.naics_code??undefined,
    pscCode:row.psc_code??undefined,
    scopeText:row.scope_text??undefined,
    awardDate:row.award_date??undefined,
    sourceUrl:row.source_url,
    capturedAt:row.captured_at,
    evidenceRefs:row.evidence_refs??[],
  }))
  const profiles=buildPublicAwardPrimeFingerprints(records)
  if(profiles.length){
    const {error:profileError}=await client.from('jhadina_public_prime_profiles').upsert(
      profiles.map(profile=>({
        provider_id:profile.providerId,
        provider_name:profile.providerName,
        award_count:profile.awardCount,
        total_observed_award_value:profile.totalObservedAwardValue??null,
        states:profile.states,
        buyers:profile.buyers,
        naics_codes:profile.naicsCodes,
        psc_codes:profile.pscCodes,
        capability_keywords:profile.capabilityKeywords,
        evidence_refs:profile.evidenceRefs,
        updated_at:now,
      })),
      {onConflict:'provider_id'},
    )
    if(profileError)throw new Error(`public_prime_profiles_persist_failed:${profileError.message}`)
  }
  return profiles.length
}

async function persistWorkPackages(
  client:SupabaseClient,
  rows:Array<{inbox:InboxAwardRow;award:PublicAwardRecord}>,
  now:string,
){
  const all=[]
  for(const {inbox,award} of rows){
    const requirements=scopeRequirements(inbox.payload.scopeRequirements)
    if(!requirements.length)continue
    const packages=compilePublicSubcontractWorkPackages({
      opportunityId:award.opportunityId??award.id,
      opportunityTitle:award.title,
      state:award.state,
      county:award.county,
      locality:award.locality,
      awardedPrimeName:award.awardedPrimeName,
      awardedPrimeRef:award.awardedPrimeRef,
      opportunityAmount:award.awardAmount!==undefined?{max:award.awardAmount,currency:award.currency??'USD'}:undefined,
      scopeRequirements:requirements,
      sourceEvidenceRefs:award.evidenceRefs,
    })
    for(const pkg of packages){
      const compliance=assessPublicWorkPackageCompliance({
        state:award.state,
        label:pkg.label,
        description:pkg.description,
        category:pkg.category,
        keywords:pkg.requirement.keywords,
        requiredLicenses:pkg.requiredLicenses,
        requiredCertifications:pkg.requiredCertifications,
        estimatedValue:pkg.estimatedValue,
      })
      all.push({
        id:pkg.id,
        award_id:award.id,
        opportunity_id:pkg.opportunityId,
        awarded_prime_name:pkg.awardedPrimeName??null,
        awarded_prime_ref:pkg.awardedPrimeRef??null,
        label:pkg.label,
        description:pkg.description??null,
        category:pkg.category??null,
        geography:pkg.geography??null,
        estimated_value_min:pkg.estimatedValue?.min??null,
        estimated_value_max:pkg.estimatedValue?.max??null,
        currency:pkg.estimatedValue?.currency??null,
        required_licenses:pkg.requiredLicenses,
        required_certifications:pkg.requiredCertifications,
        requirement:pkg.requirement,
        evidence_refs:pkg.evidenceRefs,
        status:pkg.status,
        blockers:pkg.blockers,
        compliance_pack_id:compliance.pack.id,
        compliance_status:compliance.status,
        compliance_requirements:compliance.requirements,
        compliance_required_evidence_ids:compliance.requirements.filter(row=>row.evidenceRequired).map(row=>row.id),
        compliance_blockers:compliance.blockers,
        compliance_evidence_refs:compliance.evidenceRefs,
        compliance_assessed_at:now,
        human_review_required:true,
        automatic_prime_contact_authorized:false,
        automatic_provider_outreach_authorized:false,
        bid_submission_authorized:false,
        provider_discovery_at:null,
        updated_at:now,
      })
    }
  }
  if(all.length){
    const {error}=await client.from('jhadina_public_work_packages').upsert(all,{onConflict:'id'})
    if(error)throw new Error(`public_work_packages_persist_failed:${error.message}`)
  }
  return all.length
}

export async function minePublicAwardPrimeBatch(
  client:SupabaseClient,
  input:{batchSize?:number;offset?:number;now?:string}={},
){
  const now=input.now??new Date().toISOString()
  const batchSize=Math.max(1,Math.min(input.batchSize??100,500))
  const offset=Math.max(0,Math.floor(input.offset??0))
  const {data,error}=await client
    .from('jhadina_public_opportunity_inbox')
    .select('id,source_id,external_id,title,source_url,payload,captured_at,last_seen_at')
    .eq('active',true)
    .eq('stage','award')
    .order('last_seen_at',{ascending:false})
    .range(offset,offset+batchSize-1)
    .returns<InboxAwardRow[]>()
  if(error)throw new Error(`public_award_inbox_read_failed:${error.message}`)

  const valid=(data??[]).flatMap(inbox=>{
    const award=awardRecord(inbox)
    return award?[{inbox,award}]:[]
  })
  if(!valid.length){
    return {
      status:'IDLE' as const,
      inboxAwards:data?.length??0,
      acceptedAwards:0,
      primeProfiles:0,
      workPackages:0,
      automaticPrimeContactAuthorized:false as const,
      providerOutreachAuthorized:false as const,
    }
  }

  await persistAwards(client,valid,now)
  const [primeProfiles,workPackages]=await Promise.all([
    rebuildPrimeProfiles(client,now),
    persistWorkPackages(client,valid,now),
  ])
  return {
    status:'PROCESSED' as const,
    inboxAwards:data?.length??0,
    acceptedAwards:valid.length,
    primeProfiles,
    workPackages,
    automaticPrimeContactAuthorized:false as const,
    providerOutreachAuthorized:false as const,
    bidSubmissionAuthorized:false as const,
  }
}
