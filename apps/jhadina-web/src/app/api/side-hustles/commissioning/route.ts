import {NextResponse} from 'next/server'
import {
  listSideHustleCommissioningQueue,
  summarizeSideHustleCommissioning,
} from '@jhadina/opportunity-core'
import {requireRequestIdentity} from '@/lib/auth/request-user'
import {createSideHustleCommissioningEvidenceRepository} from '@/lib/opportunities/side-hustle-commissioning-repository'
import {listSideHustleLiveCommissioningRuntime} from '@/lib/opportunities/side-hustle-commissioning-runtime'

export const dynamic='force-dynamic'
export const runtime='nodejs'

export async function GET(){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const queue=listSideHustleCommissioningQueue()
    const live=await listSideHustleLiveCommissioningRuntime({},createSideHustleCommissioningEvidenceRepository())
    return NextResponse.json({
      ok:true,
      requestId,
      summary:summarizeSideHustleCommissioning(queue),
      queue,
      live,
      externalActionAuthorized:false,
      moneyMovementAuthorized:false,
    },{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to build Side Hustle commissioning queue'
    const status=/Authenticated|identity|session/i.test(message)?401:400
    return NextResponse.json({ok:false,requestId,error:message},{status,headers:{'cache-control':'no-store'}})
  }
}
