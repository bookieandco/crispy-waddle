import {NextResponse} from 'next/server'
import {
  isSideHustleProfile,
  type OwnedMediaCycleStatus,
  OwnedMediaMonetizationKind,
  OwnedMediaPropertyStatus,
  OwnedMediaPropertyType,
  PhysicalAssetStatus,
} from '@jhadina/opportunity-core'
import {requireRequestIdentity} from '@/lib/auth/request-user'
import {createSupabaseOpportunityRepository} from '@/lib/opportunities/supabase-opportunity-repository'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {createDirectorProjectMembership} from '@/lib/director-project-authority'
import {DirectorWorkstationTimelineRepository} from '@/lib/director-workstation-timeline-repository'
import {compileSideHustleDirectorProductionPlan,type SideHustleDirectorFormat} from '@/lib/opportunities/side-hustle-director-bridge'
import {
  cancelPhysicalAssetBookingRuntime,
  checkoutPhysicalAssetBookingRuntime,
  createOwnedMediaCycleRuntime,
  createOwnedMediaPropertyRuntime,
  createPhysicalAssetBookingRuntime,
  createPhysicalAssetRuntime,
  observeOwnedMediaAnalyticsRuntime,
  observeOwnedMediaMonetizationRuntime,
  recordOwnedMediaPublicationRuntime,
  recordPhysicalAssetMaintenanceRuntime,
  reservePhysicalAssetBookingRuntime,
  returnPhysicalAssetBookingRuntime,
  setOwnedMediaPropertyStatusRuntime,
  summarizeSpecializedSideHustleRuntime,
  transitionOwnedMediaCycleRuntime,
  transitionPhysicalAssetRuntime,
} from '@/lib/opportunities/side-hustle-specialized-runtime'

export const dynamic='force-dynamic'
export const runtime='nodejs'

type Body=Record<string,unknown>&{action?:string}

const text=(body:Body,key:string)=>{
  const value=body[key]
  if(typeof value!=='string'||!value.trim())throw new Error(`${key} is required`)
  return value.trim()
}
const optionalText=(body:Body,key:string)=>typeof body[key]==='string'&&String(body[key]).trim()?String(body[key]).trim():undefined
const strings=(body:Body,key:string)=>{
  const value=body[key]
  if(!Array.isArray(value)||!value.length||value.some(item=>typeof item!=='string'||!item.trim())){
    throw new Error(`${key} is required`)
  }
  return value as string[]
}
const numberValue=(body:Body,key:string)=>{
  const value=body[key]
  if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`${key} must be a number`)
  return value
}
const optionalNumber=(body:Body,key:string)=>typeof body[key]==='number'&&Number.isFinite(body[key])?body[key] as number:undefined
const optionalBoolean=(body:Body,key:string)=>typeof body[key]==='boolean'?body[key] as boolean:undefined
const DIRECTOR_FORMATS=new Set<SideHustleDirectorFormat>(['tiktok_short','ugc_ad','faceless_youtube','music_video','short_film','feature_film'])

function fail(requestId:string,message:string,status=400){
  return NextResponse.json({ok:false,requestId,error:message},{status,headers:{'cache-control':'no-store'}})
}
function statusFor(message:string){
  if(/Authenticated|identity|session/i.test(message))return 401
  if(/NOT_FOUND/.test(message))return 404
  if(/MISMATCH|requires|Invalid|invalid|cannot|must|Only/i.test(message))return 409
  return 400
}

export async function GET(_request:Request,context:{params:{id:string}}){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const repository=createSupabaseOpportunityRepository()
    const [summary,records]=await Promise.all([
      summarizeSpecializedSideHustleRuntime({opportunityId:context.params.id},repository),
      repository.listSideHustleSpecializedRecords({opportunityId:context.params.id}),
    ])
    return NextResponse.json({ok:true,requestId,summary,records},{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to load specialized Side Hustle state'
    return fail(requestId,message,statusFor(message))
  }
}

export async function POST(request:Request,context:{params:{id:string}}){
  const requestId=crypto.randomUUID()
  try{
    const identity=await requireRequestIdentity()
    const body=await request.json().catch(()=>({})) as Body
    const action=text(body,'action')
    const repository=createSupabaseOpportunityRepository()
    let result:unknown

    switch(action){
      case 'create_media_property':
        result=await createOwnedMediaPropertyRuntime({
          opportunityId:context.params.id,id:text(body,'id'),
          propertyType:text(body,'propertyType') as OwnedMediaPropertyType,
          label:text(body,'label'),providerRef:optionalText(body,'providerRef'),
          evidenceRefs:strings(body,'evidenceRefs'),createdAt:optionalText(body,'createdAt'),
        },repository);break

      case 'set_media_property_status':
        result=await setOwnedMediaPropertyStatusRuntime({
          propertyId:text(body,'propertyId'),status:text(body,'status') as OwnedMediaPropertyStatus,
          evidenceRefs:strings(body,'evidenceRefs'),observedAt:optionalText(body,'observedAt'),
        },repository);break

      case 'create_media_cycle':
        result=await createOwnedMediaCycleRuntime({
          propertyId:text(body,'propertyId'),id:text(body,'id'),title:text(body,'title'),
          topicRef:text(body,'topicRef'),evidenceRefs:strings(body,'evidenceRefs'),
          createdAt:optionalText(body,'createdAt'),
        },repository);break

      case 'create_director_production': {
        const stored=await repository.get(context.params.id)
        if(!stored)throw new Error('SIDE_HUSTLE_DIRECTOR_OPPORTUNITY_NOT_FOUND')
        const profile=stored.opportunity.metadata?.sideHustleProfile
        if(!isSideHustleProfile(profile)||!['content_social','creative_advertising','media_production','owned_media','creator_monetization'].includes(profile.family)){
          throw new Error('SIDE_HUSTLE_DIRECTOR_REQUIRES_MEDIA_CAPABLE_OPPORTUNITY')
        }
        if(!['ready','approved','pursuing','won'].includes(stored.opportunity.status)){
          throw new Error('SIDE_HUSTLE_DIRECTOR_OPPORTUNITY_NOT_ACTIVE')
        }
        const format=text(body,'format') as SideHustleDirectorFormat
        if(!DIRECTOR_FORMATS.has(format))throw new Error('SIDE_HUSTLE_DIRECTOR_FORMAT_INVALID')
        const planId=text(body,'id')
        const projectId=optionalText(body,'projectId')??`director:${identity.userId}:opportunity:${context.params.id}:${planId}`
        const sourceRef=text(body,'sourceRef')
        const sourceRefs=strings(body,'sourceRefs')
        const rightsEvidenceRefs=strings(body,'rightsEvidenceRefs')
        const evidenceRefs=strings(body,'evidenceRefs')
        const privileged=createServiceRoleClient()
        if(!privileged)throw new Error('DIRECTOR_PROJECT_STORE_NOT_CONFIGURED')
        const {data:approvedTaste,error:tasteError}=await privileged.from('jhadina_entertainment_preferences')
          .select('domain,preference,confidence,provenance')
          .eq('owner_user_id',identity.userId)
          .order('approved_at',{ascending:false})
          .limit(40)
        if(tasteError)throw new Error('SIDE_HUSTLE_DIRECTOR_TASTE_READ_FAILED:'+tasteError.message)

        const plan=compileSideHustleDirectorProductionPlan({
          id:planId,
          opportunityId:context.params.id,
          family:profile.family,
          sourceRef,
          directorProjectId:projectId,
          format,
          intent:text(body,'intent'),
          sourceRefs,
          rightsEvidenceRefs,
          evidenceRefs,
          approvedCreativePreferences:(approvedTaste??[]).map(item=>({
            domain:String(item.domain),
            preference:String(item.preference),
            confidence:Number(item.confidence),
            provenance:Array.isArray(item.provenance)?item.provenance.map(String):[],
          })),
          targetRuntimeSeconds:optionalNumber(body,'targetRuntimeSeconds'),
          aspectRatio:optionalText(body,'aspectRatio') as '9:16'|'16:9'|'1:1'|undefined,
          createdAt:optionalText(body,'createdAt'),
        })

        await createDirectorProjectMembership(privileged,{projectId,userId:identity.userId,role:'owner'})
        const timelineRepository=new DirectorWorkstationTimelineRepository(privileged)
        const existingTimeline=await timelineRepository.load(projectId)
        if(!existingTimeline){
          const dimensions=plan.aspectRatio==='9:16'?{width:1080,height:1920}:plan.aspectRatio==='1:1'?{width:1080,height:1080}:{width:1920,height:1080}
          await timelineRepository.save({
            projectId,userId:identity.userId,expectedRevision:0,
            mutationId:'business-plan:'+plan.id,
            reason:'Initialize Business Factory Director timeline',
            timeline:{
              version:1,projectId,fps:30,width:dimensions.width,height:dimensions.height,
              durationSeconds:plan.targetRuntimeSeconds,playheadSeconds:0,
              tracks:[
                {id:'video-1',name:'Video',kind:'video',clips:[],index:0},
                {id:'audio-1',name:'Audio',kind:'audio',clips:[],index:1},
              ],
              transitions:[],markers:[],versions:[],
            },
          })
        }
        const now=optionalText(body,'createdAt')??new Date().toISOString()
        const {error:contextError}=await privileged.from('director_project_business_context').upsert({
          project_id:projectId,
          owner_user_id:identity.userId,
          opportunity_id:context.params.id,
          side_hustle_family:profile.family,
          production_format:format,
          source_ref:sourceRef,
          plan,
          updated_at:now,
        },{onConflict:'project_id'})
        if(contextError)throw new Error('SIDE_HUSTLE_DIRECTOR_CONTEXT_WRITE_FAILED:'+contextError.message)
        result={plan,projectId,workstationHref:plan.workstationHref}
        break
      }

      case 'transition_media_cycle':
        result=await transitionOwnedMediaCycleRuntime({
          cycleId:text(body,'cycleId'),
          status:text(body,'status') as Exclude<OwnedMediaCycleStatus,'planned'|'published'|'measured'>,
          evidenceRefs:strings(body,'evidenceRefs'),observedAt:optionalText(body,'observedAt'),
          productionRef:optionalText(body,'productionRef'),approvalRef:optionalText(body,'approvalRef'),
        },repository);break

      case 'record_media_publication':
        result=await recordOwnedMediaPublicationRuntime({
          propertyId:text(body,'propertyId'),cycleId:text(body,'cycleId'),id:text(body,'id'),
          providerRef:text(body,'providerRef'),externalContentRef:text(body,'externalContentRef'),
          canonicalUrl:optionalText(body,'canonicalUrl'),evidenceRefs:strings(body,'evidenceRefs'),
          publishedAt:optionalText(body,'publishedAt'),
        },repository);break

      case 'observe_media_analytics':
        result=await observeOwnedMediaAnalyticsRuntime({
          propertyId:text(body,'propertyId'),cycleId:text(body,'cycleId'),id:text(body,'id'),
          providerRef:text(body,'providerRef'),impressions:optionalNumber(body,'impressions'),
          views:optionalNumber(body,'views'),watchSeconds:optionalNumber(body,'watchSeconds'),
          clicks:optionalNumber(body,'clicks'),leads:optionalNumber(body,'leads'),
          conversions:optionalNumber(body,'conversions'),grossRevenue:optionalNumber(body,'grossRevenue'),
          currency:optionalText(body,'currency'),evidenceRefs:strings(body,'evidenceRefs'),
          observedAt:optionalText(body,'observedAt'),markMeasured:optionalBoolean(body,'markMeasured'),
        },repository);break

      case 'observe_media_monetization':
        result=await observeOwnedMediaMonetizationRuntime({
          propertyId:text(body,'propertyId'),cycleId:optionalText(body,'cycleId'),id:text(body,'id'),
          kind:text(body,'kind') as OwnedMediaMonetizationKind,amount:numberValue(body,'amount'),
          currency:text(body,'currency'),transactionRef:optionalText(body,'transactionRef'),
          providerRef:optionalText(body,'providerRef'),evidenceRefs:strings(body,'evidenceRefs'),
          observedAt:optionalText(body,'observedAt'),
        },repository);break

      case 'create_asset':
        result=await createPhysicalAssetRuntime({
          opportunityId:context.params.id,id:text(body,'id'),assetType:text(body,'assetType'),
          label:text(body,'label'),serialRef:optionalText(body,'serialRef'),
          locationRef:optionalText(body,'locationRef'),acquisitionCost:optionalNumber(body,'acquisitionCost'),
          currency:optionalText(body,'currency'),evidenceRefs:strings(body,'evidenceRefs'),
          createdAt:optionalText(body,'createdAt'),
        },repository);break

      case 'transition_asset':
        result=await transitionPhysicalAssetRuntime({
          assetId:text(body,'assetId'),status:text(body,'status') as PhysicalAssetStatus,
          evidenceRefs:strings(body,'evidenceRefs'),observedAt:optionalText(body,'observedAt'),
          locationRef:optionalText(body,'locationRef'),
        },repository);break

      case 'create_booking':
        result=await createPhysicalAssetBookingRuntime({
          assetId:text(body,'assetId'),id:text(body,'id'),customerRef:text(body,'customerRef'),
          startsAt:text(body,'startsAt'),endsAt:text(body,'endsAt'),
          price:{amount:numberValue(body,'amount'),currency:text(body,'currency')},
          depositTransactionRef:optionalText(body,'depositTransactionRef'),
          paymentTransactionRef:optionalText(body,'paymentTransactionRef'),
          evidenceRefs:strings(body,'evidenceRefs'),createdAt:optionalText(body,'createdAt'),
        },repository);break

      case 'reserve_booking':
        result=await reservePhysicalAssetBookingRuntime({
          assetId:text(body,'assetId'),bookingId:text(body,'bookingId'),
          evidenceRefs:strings(body,'evidenceRefs'),reservedAt:optionalText(body,'observedAt'),
        },repository);break

      case 'checkout_booking':
        result=await checkoutPhysicalAssetBookingRuntime({
          assetId:text(body,'assetId'),bookingId:text(body,'bookingId'),
          custodyReceiptId:text(body,'custodyReceiptId'),fromRef:optionalText(body,'fromRef'),
          toRef:optionalText(body,'toRef'),conditionNote:optionalText(body,'conditionNote'),
          evidenceRefs:strings(body,'evidenceRefs'),checkedOutAt:optionalText(body,'observedAt'),
        },repository);break

      case 'return_booking':
        result=await returnPhysicalAssetBookingRuntime({
          assetId:text(body,'assetId'),bookingId:text(body,'bookingId'),
          custodyReceiptId:text(body,'custodyReceiptId'),fromRef:optionalText(body,'fromRef'),
          toRef:optionalText(body,'toRef'),conditionNote:optionalText(body,'conditionNote'),
          evidenceRefs:strings(body,'evidenceRefs'),returnedAt:optionalText(body,'observedAt'),
          requiresMaintenance:optionalBoolean(body,'requiresMaintenance'),
        },repository);break

      case 'cancel_booking':
        result=await cancelPhysicalAssetBookingRuntime({
          assetId:text(body,'assetId'),bookingId:text(body,'bookingId'),
          evidenceRefs:strings(body,'evidenceRefs'),cancelledAt:optionalText(body,'observedAt'),
        },repository);break

      case 'record_maintenance':
        result=await recordPhysicalAssetMaintenanceRuntime({
          assetId:text(body,'assetId'),id:text(body,'id'),
          kind:text(body,'kind') as 'inspection'|'service'|'repair'|'damage',
          providerRef:optionalText(body,'providerRef'),cost:optionalNumber(body,'cost'),
          currency:optionalText(body,'currency'),note:text(body,'note'),
          evidenceRefs:strings(body,'evidenceRefs'),observedAt:optionalText(body,'observedAt'),
          moveToMaintenance:optionalBoolean(body,'moveToMaintenance'),
        },repository);break

      default:return fail(requestId,'Unsupported specialized Side Hustle action')
    }

    return NextResponse.json({
      ok:true,requestId,result,externalActionAuthorized:false,publishingAuthorized:false,
      paymentAuthorized:false,moneyMovementAuthorized:false,
    },{status:201,headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to mutate specialized Side Hustle state'
    return fail(requestId,message,statusFor(message))
  }
}
