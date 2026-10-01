import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assessPublicStateCompliance,
  buildNationalStateComplianceManifest,
  type BrokerRequirement,
  type PublicComplianceContext,
  type PublicComplianceEvidence,
  type PublicStateCompliancePack,
  type UsStateOrDcCode,
} from '@jhadina/opportunity-core'

type PackageRow={
  id:string
  status:'candidate'|'review_required'|'blocked'
  category:string|null
  description:string|null
  geography:string|null
  estimated_value_min:number|null
  estimated_value_max:number|null
  required_licenses:string[]
  required_certifications:string[]
  requirement:BrokerRequirement
}

type EvidenceRow={
  id:string
  kind:PublicComplianceEvidence['kind']
  status:PublicComplianceEvidence['status']
  value:unknown
  source_url:string|null
  evidence_ref:string|null
  observed_at:string|null
  expires_at:string|null
}

const STATE_CODES=new Set<string>([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
])

function stateFromGeography(value?:string|null):UsStateOrDcCode|undefined{
  const raw=(value??'').trim().toUpperCase()
  if(STATE_CODES.has(raw))return raw as UsStateOrDcCode
  const match=raw.match(/(?:,|\s)\s*([A-Z]{2})$/)
  if(match?.[1]&&STATE_CODES.has(match[1]))return match[1] as UsStateOrDcCode
  return undefined
}

function workType(pkg:PackageRow):PublicComplianceContext['workType']{
  const hay=`${pkg.category??''} ${pkg.description??''} ${pkg.requirement?.label??''} ${(pkg.requirement?.keywords??[]).join(' ')}`.toLowerCase()
  if(/demolit/.test(hay))return'demolition'
  if(/install/.test(hay))return'installation'
  if(/repair|replace|rehab|renovat/.test(hay))return'repair'
  if(/mainten/.test(hay))return'maintenance'
  if(/alter/.test(hay))return'alteration'
  if(/construct|build|roof|concrete|electrical|plumb|hvac|paving/.test(hay))return'construction'
  return'unknown'
}

function complianceContext(pkg:PackageRow,state:UsStateOrDcCode):PublicComplianceContext{
  return {
    state,
    publicWorks:'yes',
    workType:workType(pkg),
    estimatedValue:pkg.estimated_value_max??pkg.estimated_value_min??undefined,
    tradeLicenseApplicable:(pkg.required_licenses?.length??0)>0?'yes':'unknown',
    hasEmployees:'unknown',
    intendsToBid:false,
    willPerformWork:true,
  }
}

function toEvidence(rows:EvidenceRow[]):PublicComplianceEvidence[]{
  return rows.map(row=>({
    id:row.id,
    kind:row.kind,
    status:row.status,
    value:row.value,
    sourceUrl:row.source_url??undefined,
    evidenceRef:row.evidence_ref??undefined,
    observedAt:row.observed_at??undefined,
    expiresAt:row.expires_at??undefined,
  }))
}

async function syncPackRegistry(client:SupabaseClient,packs:PublicStateCompliancePack[],now:string){
  const rows=packs.map(pack=>({
    state_code:pack.state,
    version:pack.version,
    status:pack.status,
    pack,
    source_refs:pack.evidenceRefs,
    source_observed_on:pack.sourceObservedOn??null,
    updated_at:now,
  }))
  const {error}=await client.from('jhadina_public_compliance_packs').upsert(rows,{onConflict:'state_code'})
  if(error)throw new Error(`public_compliance_pack_sync_failed:${error.message}`)
  return rows.length
}

async function loadEvidence(client:SupabaseClient,packageId:string,state:UsStateOrDcCode){
  const {data,error}=await client
    .from('jhadina_public_compliance_evidence')
    .select('id,kind,status,value,source_url,evidence_ref,observed_at,expires_at')
    .eq('subject_type','work_package')
    .eq('subject_id',packageId)
    .eq('state_code',state)
    .returns<EvidenceRow[]>()
  if(error)throw new Error(`public_compliance_evidence_read_failed:${error.message}`)
  return toEvidence(data??[])
}

export async function assessPublicWorkPackageComplianceBatch(
  client:SupabaseClient,
  input:{batchSize?:number;now?:string}={},
){
  const now=input.now??new Date().toISOString()
  const batchSize=Math.max(1,Math.min(input.batchSize??100,500))
  const packs=buildNationalStateComplianceManifest()
  const registryCount=await syncPackRegistry(client,packs,now)
  const byState=new Map(packs.map(pack=>[pack.state,pack]))

  const {data,error}=await client
    .from('jhadina_public_work_packages')
    .select('id,status,category,description,geography,estimated_value_min,estimated_value_max,required_licenses,required_certifications,requirement')
    .in('status',['candidate','review_required'])
    .order('updated_at',{ascending:true})
    .limit(batchSize)
    .returns<PackageRow[]>()
  if(error)throw new Error(`public_work_package_compliance_queue_read_failed:${error.message}`)
  if(!data?.length){
    return {
      status:'IDLE' as const,
      registryCount,
      packages:0,
      pass:0,
      reviewRequired:0,
      blocked:0,
      externalActionAuthorized:false as const,
      isLegalAdvice:false as const,
    }
  }

  const results=[]
  for(const pkg of data){
    const state=stateFromGeography(pkg.geography??pkg.requirement?.geography)
    if(!state){
      results.push({packageId:pkg.id,status:'review_required' as const,error:'state_not_resolved'})
      continue
    }
    const pack=byState.get(state)
    if(!pack){
      results.push({packageId:pkg.id,status:'review_required' as const,error:'pack_not_found'})
      continue
    }
    const evidence=await loadEvidence(client,pkg.id,state)
    const assessment=assessPublicStateCompliance({
      pack,
      context:complianceContext(pkg,state),
      evidence,
    })
    const {error:persistError}=await client.from('jhadina_public_work_package_compliance').upsert({
      package_id:pkg.id,
      state_code:state,
      pack_version:assessment.packVersion,
      status:assessment.status,
      gate_results:assessment.gateResults,
      blockers:assessment.blockers,
      conditions:assessment.conditions,
      evidence_refs:assessment.evidenceRefs,
      assessed_at:now,
      updated_at:now,
    },{onConflict:'package_id'})
    if(persistError)throw new Error(`public_work_package_compliance_persist_failed:${persistError.message}`)
    results.push({packageId:pkg.id,state,status:assessment.status,blockers:assessment.blockers,conditions:assessment.conditions})
  }

  return {
    status:'PROCESSED' as const,
    registryCount,
    packages:data.length,
    pass:results.filter(result=>result.status==='pass').length,
    reviewRequired:results.filter(result=>result.status==='review_required').length,
    blocked:results.filter(result=>result.status==='blocked').length,
    results,
    externalActionAuthorized:false as const,
    isLegalAdvice:false as const,
  }
}
