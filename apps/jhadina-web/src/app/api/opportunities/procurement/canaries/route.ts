import {NextRequest,NextResponse} from 'next/server'
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity'
import {
 reconcileProcurementNotice,reviewProcurementCommercial,prepareProcurementBidPacket,type FulfillmentPlan,
} from '@jhadina/opportunity-core'
import {PUBLIC_PROCUREMENT_CANARY_NOTICES,readPublicProcurementCanary} from '@/lib/opportunities/procurement-public-canary-docket'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'cache-control':'no-store'}})
async function identity(){await (await createRequestIdentityVerifier()).verify({})}
function errorReply(e:unknown){
 const message=e instanceof Error?e.message:''
 return reply({ok:false,error:/authenticated|session|identity|unauthorized/i.test(message)?'Authentication required':'Canary dossier unavailable'},
  /authenticated|session|identity|unauthorized/i.test(message)?401:503)
}
export async function GET(){
 try{
  await identity()
  return reply({ok:true,mode:'verified_public_notices_not_complete_bid_documents',
   canaries:PUBLIC_PROCUREMENT_CANARY_NOTICES.map(n=>readPublicProcurementCanary(n.id,new Date().toISOString())),
   sourceAccessCertified:false,biddingAuthorized:false,privateOwnerReviewOnly:true,
  })
 }catch(e){return errorReply(e)}
}
export async function POST(request:NextRequest){
 try{
  await identity()
  const body=await request.json().catch(()=>null) as {canaryId?:unknown}|null
  const id=typeof body?.canaryId==='string'?body.canaryId.trim():''
  if(!id||id.length>64)return reply({ok:false,error:'Known canary ID required'},400)
  const notice=readPublicProcurementCanary(id,new Date().toISOString())
  if(!notice)return reply({ok:false,error:'No official canary notice with this ID'},404)
  // The public NIB and addendum can prove partial requirements, not the full
  // PlanetBids specifications or a buyer-validated required-form inventory.
  const canonicalNotice=reconcileProcurementNotice(id,[])
  const plan:FulfillmentPlan={
   opportunityId:id,structure:'unresolved',assignments:[],
   coveredRequirementIds:[],uncoveredRequirementIds:[],
   blockers:[...notice.complianceEvidenceMissing,
    'Public notice alone is not the signed, complete portal procurement package.'],
   rationale:['Official public notice metadata is evidence context, not a certified procurement-document import.'],
   requiresHumanApproval:true,engagementAuthorized:false,
  }
  const commercial=reviewProcurementCommercial({plan,providers:[],quotes:[],costEvidence:[]})
  const packet=prepareProcurementBidPacket({notice:canonicalNotice,plan,providers:[],commercial,formAttachments:{}})
  return reply({ok:true,mode:'official_public_notice_no_send_review',notice,packet,
   officialDocumentsReadAsFullBidSet:0,qualifiedProviders:0,writtenQuotes:0,
   anyBidReady:false,externalActionAuthorized:false,contactAuthorized:false,submissionAuthorized:false,
   spendingAuthorized:false,signingAuthorized:false})
 }catch(e){return errorReply(e)}
}
