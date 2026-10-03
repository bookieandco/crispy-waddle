import {NextResponse} from 'next/server'
import {
  SIDE_HUSTLE_COMMISSIONING_GATE_TYPES,
  SIDE_HUSTLE_FAMILY_IDS,
  type SideHustleCommissioningEvidenceStatus,
  type SideHustleCommissioningGateType,
  type SideHustleFamily,
} from '@jhadina/opportunity-core'
import {requireRequestIdentity} from '@/lib/auth/request-user'
import {createSideHustleCommissioningEvidenceRepository} from '@/lib/opportunities/side-hustle-commissioning-repository'
import {
  listSideHustleLiveCommissioningRuntime,
  recordSideHustleCommissioningEvidenceRuntime,
} from '@/lib/opportunities/side-hustle-commissioning-runtime'

export const dynamic='force-dynamic'
export const runtime='nodejs'

type Body={
  id?:string
  family?:string
  gateType?:string
  status?:string
  providerRef?:string
  note?:string
  evidenceRefs?:string[]
  observedAt?:string
  expiresAt?:string
}

function fail(requestId:string,message:string,status=400){
  return NextResponse.json({ok:false,requestId,error:message},{status,headers:{'cache-control':'no-store'}})
}

export async function GET(request:Request){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const rawFamily=new URL(request.url).searchParams.get('family')?.trim()
    if(rawFamily&&!SIDE_HUSTLE_FAMILY_IDS.includes(rawFamily as SideHustleFamily)){
      return fail(requestId,'Invalid Side Hustle family')
    }
    const result=await listSideHustleLiveCommissioningRuntime({
      family:rawFamily as SideHustleFamily|undefined,
    },createSideHustleCommissioningEvidenceRepository())
    return NextResponse.json({ok:true,requestId,...result},{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to load commissioning evidence'
    const status=/Authenticated|identity|session/i.test(message)?401:400
    return fail(requestId,message,status)
  }
}

export async function POST(request:Request){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const body=await request.json().catch(()=>({})) as Body
    if(!body.id?.trim()||!body.family?.trim()||!body.gateType?.trim()||!body.status?.trim()||!body.evidenceRefs?.length){
      return fail(requestId,'Commissioning evidence fields are incomplete')
    }
    if(!SIDE_HUSTLE_FAMILY_IDS.includes(body.family as SideHustleFamily)){
      return fail(requestId,'Invalid Side Hustle family')
    }
    if(!SIDE_HUSTLE_COMMISSIONING_GATE_TYPES.includes(body.gateType as SideHustleCommissioningGateType)){
      return fail(requestId,'Invalid commissioning gate type')
    }
    if(!['passed','blocked','not_applicable'].includes(body.status)){
      return fail(requestId,'Invalid commissioning evidence status')
    }
    const repository=createSideHustleCommissioningEvidenceRepository()
    const evidence=await recordSideHustleCommissioningEvidenceRuntime({
      id:body.id,
      family:body.family as SideHustleFamily,
      gateType:body.gateType as SideHustleCommissioningGateType,
      status:body.status as Exclude<SideHustleCommissioningEvidenceStatus,'pending'>,
      providerRef:body.providerRef,
      note:body.note,
      evidenceRefs:body.evidenceRefs,
      observedAt:body.observedAt,
      expiresAt:body.expiresAt,
    },repository)
    const live=await listSideHustleLiveCommissioningRuntime({
      family:evidence.family,
    },repository)
    return NextResponse.json({
      ok:true,requestId,evidence,live,
      externalActionAuthorized:false,moneyMovementAuthorized:false,
    },{status:201,headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to record commissioning evidence'
    const status=/Authenticated|identity|session/i.test(message)?401:/not required|invalid|must|requires/i.test(message)?409:400
    return fail(requestId,message,status)
  }
}
