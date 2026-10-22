import {NextRequest,NextResponse} from 'next/server'
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {
 US_STATE_AND_DC_CODES,assembleProcurementPilot,regionalPrimeEvidenceFromAwards,
 buildRegionalPrimeMatrix,assessNationalProcurementPursuit,type PublicAwardPrimeFingerprint,type PrimeRegionalOpportunity,
} from '@jhadina/opportunity-core'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'cache-control':'no-store'}})
type PrimeRow={provider_id:string;provider_name:string;award_count:number;states:string[]|null;buyers:string[]|null;
 naics_codes:string[]|null;psc_codes:string[]|null;capability_keywords:string[]|null;evidence_refs:string[]|null}
const fromPrime=(row:PrimeRow):PublicAwardPrimeFingerprint=>({
 providerId:row.provider_id,providerName:row.provider_name,awardCount:row.award_count??0,
 states:row.states??[],buyers:row.buyers??[],naicsCodes:row.naics_codes??[],pscCodes:row.psc_codes??[],
 capabilityKeywords:row.capability_keywords??[],evidenceRefs:row.evidence_refs??[],
})
async function authorized(){
 await (await createRequestIdentityVerifier()).verify({})
 const service=createServiceRoleClient()
 if(!service)throw new Error('prime_database_unavailable')
 return service
}
async function profiles(client:NonNullable<ReturnType<typeof createServiceRoleClient>>,state:string,limit:number){
 const {data,error}=await client.from('jhadina_public_prime_profiles')
  .select('provider_id,provider_name,award_count,states,buyers,naics_codes,psc_codes,capability_keywords,evidence_refs')
  .contains('states',[state]).order('award_count',{ascending:false}).limit(limit)
 if(error)throw Error('regional_prime_read_failed')
 return (data??[]) as PrimeRow[]
}
export async function GET(request:NextRequest){
 try{
  const client=await authorized()
  const state=(request.nextUrl.searchParams.get('state')??'CA').toUpperCase()
  if(!US_STATE_AND_DC_CODES.some(x=>x===state))return reply({ok:false,error:'State/DC required'},400)
  const rows=await profiles(client,state,50)
  return reply({ok:true,mode:'read_only_historical_prime_profiles',state,
   primes:rows.filter(row=>(row.evidence_refs??[]).length>0)
    .map(row=>({id:row.provider_id,name:row.provider_name,states:row.states,
     historicalAwardCount:row.award_count,naicsCodes:row.naics_codes,
     capabilityKeywords:row.capability_keywords,evidenceRefs:row.evidence_refs,
     partnerConsent:'not_requested',currentCapacity:'unverified',bidEligibility:'unverified'})),
   sampleLimit:50,isComplete:false,regionalEligibilityVerified:false,contactAuthorized:false,bidSubmissionAuthorized:false})
 }catch(error){
  const unauthorized=/identity|session|authenticated|unauthorized/i.test(error instanceof Error?error.message:'')
  return reply({ok:false,error:unauthorized?'Authentication required':'Regional prime research unavailable'},unauthorized?401:503)
 }
}
export async function POST(request:NextRequest){
 try{
  const client=await authorized()
  const body=await request.json().catch(()=>null) as {pilotId?:unknown;inboxId?:unknown}|null
  const pilotId=typeof body?.pilotId==='string'?body.pilotId.trim():''
  const inboxId=typeof body?.inboxId==='string'?body.inboxId.trim():''
  if(Boolean(pilotId)===Boolean(inboxId)||pilotId.length>128||inboxId.length>256)
   return reply({ok:false,error:'Provide exactly one existing pilotId or inboxId'},400)
  let opportunity:PrimeRegionalOpportunity
  if(pilotId){
   const pilot=assembleProcurementPilot().opportunities.find(p=>p.id===pilotId)
   if(!pilot)return reply({ok:false,error:'Pilot not found'},404)
   opportunity={
    opportunityId:pilot.id,buyer:pilot.buyer,state:'CA',
    county:pilot.id.startsWith('RUSD')?'Riverside':'Los Angeles',
    capabilityKeywords:pilot.id.startsWith('RUSD')?['vented','truck','fleet','upfit']:['facility','ancillary','custodial'],
    naicsCodes:[],sourceEvidenceRefs:[pilot.officialSourceUrl],
    officialSolicitationComplete:false,addendaVerified:false,requiredTradeLicenses:[],
    bondingRequired:'unknown',allowedPrimeStructure:'unknown',
    directBidEligible:'unknown',subcontractingAllowed:'unknown',
    deadlineAt:pilot.deadlineAt,
   }
  }else{
   const {data,error}=await client.from('jhadina_public_opportunity_inbox')
    .select('id,source_id,source_url,title,state_code,county_name,active,stage')
    .eq('id',inboxId).eq('active',true).maybeSingle()
   if(error)throw new Error('prime_opportunity_lookup_failed')
   if(!data)return reply({ok:false,error:'Active opportunity observation not found'},404)
   if(!US_STATE_AND_DC_CODES.some(code=>code===data.state_code))
    return reply({ok:false,error:'Unsupported state; official jurisdiction classification needed'},422)
   opportunity={opportunityId:data.id,buyer:'Unverified public buyer',state:data.state_code,
    county:data.county_name??undefined,capabilityKeywords:[data.title],naicsCodes:[],
    sourceEvidenceRefs:[data.source_id,data.source_url],
    officialSolicitationComplete:false,addendaVerified:false,requiredTradeLicenses:[],
    bondingRequired:'unknown',allowedPrimeStructure:'unknown',directBidEligible:'unknown',
    subcontractingAllowed:'unknown'}
  }
  const rows=await profiles(client,opportunity.state,80)
  const diligence=assessNationalProcurementPursuit({opportunityId:opportunity.opportunityId,angle:'teaming',gates:[]})
  const matrix=buildRegionalPrimeMatrix({
   opportunity,providers:rows.filter(row=>(row.evidence_refs??[]).length>0)
    .map(row=>regionalPrimeEvidenceFromAwards(fromPrime(row))),
   maxCandidates:30,
  })
  return reply({ok:true,mode:'historical_prime_research_only',state:opportunity.state,opportunityId:opportunity.opportunityId,
   opportunityScopeVerified:false,historicalProfilesScanned:rows.length,matrix,diligence,
   note:'Historical prime award evidence is not service-area verification, capacity, licensing, insurer/bonding eligibility, teaming consent, a supplier quote, or a legal bidding structure.',
   contactAuthorized:false,signingAuthorized:false,bidSubmissionAuthorized:false,spendingAuthorized:false})
 }catch(error){
  const unauthorized=/identity|session|authenticated|unauthorized/i.test(error instanceof Error?error.message:'')
  return reply({ok:false,error:unauthorized?'Authentication required':'Regional prime matching unavailable'},unauthorized?401:503)
 }
}
