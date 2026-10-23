import {NextResponse} from 'next/server'
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {
 assessSourceCanary,assessPrimeQualification,assessBidEconomics,
 type CostLine,type AdapterCanaryTrial,
} from '@jhadina/opportunity-core'
import {PUBLIC_PROCUREMENT_CANARY_NOTICES,readPublicProcurementCanary} from '@/lib/opportunities/procurement-public-canary-docket'

/**
 * Read-only owner acceptance matrix. NO writes, no outbound source fetches,
 * no trial authorization, no vendor contact, no pricing with invented figures.
 */
export const runtime='nodejs'
export const dynamic='force-dynamic'
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}})
const sourceKeys=[
 {sourceId:'public-source:city:0654652:oxnard-official-public-project-bids-20261022',expectedAdapterKey:'oxnard-public-project-bids-v1',name:'City of Oxnard'},
 {sourceId:'public-source:school_district:unified:0633150:rusd-official-bids-20261022',expectedAdapterKey:'rusd-official-html-bids-v1',name:'Riverside Unified'},
 {sourceId:'public-source:special_district:census:143313:casitas-official-business-bids-20261022',expectedAdapterKey:'generic-html-table-v1',name:'Casitas Water'}
] as const
type SourceRow={id:string;source_url:string;adapter_key:string|null;adapter_status:string;
 access_review_status:string;verification_status:string;certified_at:string|null}
type TrialRow={id:string;source_id:string;adapter_key:string;observed_at:string;http_status:number|null;
 parse_succeeded:boolean;observation_count:number;stable_external_id_count:number;
 duplicate_external_id_count:number;provenance_complete:boolean;
 access_review_approved:boolean;error_code:string|null}
export async function GET(){
 try{
  await (await createRequestIdentityVerifier()).verify({})
  const client=createServiceRoleClient()
  if(!client)return reply({ok:false,error:'Source-evidence store unavailable'},503)
  const ids=sourceKeys.map(s=>s.sourceId)
  const [sources,events]=await Promise.all([
   client.from('jhadina_public_procurement_sources')
    .select('id,source_url,adapter_key,adapter_status,access_review_status,verification_status,certified_at')
    .in('id',ids).limit(ids.length),
   client.from('jhadina_public_adapter_trials')
    .select('id,source_id,adapter_key,observed_at,http_status,parse_succeeded,observation_count,stable_external_id_count,duplicate_external_id_count,provenance_complete,access_review_approved,error_code')
    .in('source_id',ids).order('observed_at',{ascending:false}).limit(60),
  ])
  if(sources.error||events.error)throw Error('source_review_unavailable')
  const rows=(sources.data??[]) as SourceRow[], trials=(events.data??[]) as TrialRow[]
  const sourceChecks=sourceKeys.map(spec=>{
   const s=rows.find(row=>row.id===spec.sourceId)
   if(!s)return {name:spec.name,sourceId:spec.sourceId,status:'source_not_recorded',
    blockers:['official_source_record_missing'],sourceCertifiedNow:false,liveFeedActivationAuthorized:false}
   const bySource=trials.filter(t=>t.source_id===s.id)
   const results:AdapterCanaryTrial[]=bySource.map(t=>({
    id:t.id,adapterKey:t.adapter_key,observedAt:t.observed_at,httpStatus:t.http_status,
    parseSucceeded:t.parse_succeeded,observationCount:t.observation_count,
    stableExternalIdCount:t.stable_external_id_count,
    duplicateExternalIdCount:t.duplicate_external_id_count,
    provenanceComplete:t.provenance_complete,accessReviewApproved:t.access_review_approved,
    errorCode:t.error_code}))
   return {name:spec.name,expectedAdapterKey:spec.expectedAdapterKey,
    status:'tracked_not_promoted',url:s.source_url,
    ...assessSourceCanary({
     source:{sourceId:s.id,sourceUrl:s.source_url,adapterKey:s.adapter_key,
      adapterStatus:s.adapter_status,accessReviewStatus:s.access_review_status,
      officiallyVerified:s.verification_status==='official_owner_verified',
      certifiedAt:s.certified_at},
     expectedAdapterKey:spec.expectedAdapterKey,trials:results,
     // A registry flag is NOT a site terms/robots receipt. No imported
     // authoritative access approval document available in this packet.
     accessEvidenceRefs:[],fullBidDocumentsVerified:false,
    }),
    recentTrials:bySource.slice(0,3).map(t=>({observedAt:t.observed_at,httpStatus:t.http_status,
      adapterKey:t.adapter_key,parseSucceeded:t.parse_succeeded,
      observationCount:t.observation_count,errorCode:t.error_code})),
   }
  })
  const asOf=new Date().toISOString()
  const notices=PUBLIC_PROCUREMENT_CANARY_NOTICES.map(n=>{
   const current=readPublicProcurementCanary(n.id,asOf)!
   const companies=n.historicalBidTab?.biddingCompanies??[]
   const primes=companies.map(c=>assessPrimeQualification({
    opportunityId:n.id,providerName:c.name,priorRole:'historical_bidder',
    evidence:[],asOf}))
   const economics=assessBidEconomics({
    opportunityId:n.id,asOf,proposedBidPriceUsd:null,bidPriceEvidenceRefs:[],
    costLines:[] as CostLine[],fullScopeAndAmendmentsVerified:false,
    writtenPrimeAndSupplierQuotesVerified:false,ownerCashBridgeUsd:null,cashBridgeEvidenceRefs:[],
    requirements:{bidSecurityFraction:n.bidSecurityFraction,
     performanceBondCoverageFraction:n.performanceBondFraction,
     paymentBondCoverageFraction:n.paymentBondFraction,retainageFraction:n.retainageFraction}
   })
   return {id:n.id,title:n.title,deadlineLocal:n.deadlineLocal,
    deadlineState:current.deadlineState,noticeUrl:n.noticeUrl,
    fullPackageVerified:false,
    officialQualificationLookupPages:{
     cslb:'https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx',
     dir:'https://www.dir.ca.gov/public-works/contractors.html',
     sam:'https://sam.gov/entity-information',
    },
    historicalBidders:primes,economics,
    nextDocuments:n.complianceEvidenceMissing,
    regionalPrimeOutreachAuthorized:false,proposalSubmissionAuthorized:false}
  })
  return reply({ok:true,mode:'owner_only_read_only_acceptance',asOf,
   sourceChecks,notices,
   prioritizedPaths:[
    {id:'OXNARD-PW-25-96',workstream:'California licensed Class A contractor plus pump/electrical subs',selection:'public_notice_only'},
    {id:'RUSD-2026-27-11',workstream:'Licensed truck dealer/upfitter and school RFQ registration',selection:'public_bid_list_only'},
    {id:'OXNARD-PW-24-109',workstream:'Licensed Class B builder and accessibility subcontractors',selection:'public_notice_only'},
   ],
   statewideBatchLimit:3,discoveryAutomated:false,
   schedulingAuthorized:false,sourceActivationAuthorized:false,
   externalSupplierContactAuthorized:false,spendingAuthorized:false,
   bidSubmissionAuthorized:false,signingAuthorized:false,
   privateIphoneAuthenticatedAcceptanceVerified:false})
 }catch(e){
  const msg=e instanceof Error?e.message:''
  const denied=/unauthori[sz]ed|session|identity|authenticated/i.test(msg)
  return reply({ok:false,error:denied?'Owner sign-in required':'Commissioning evidence unavailable'},denied?401:503)
 }
}
