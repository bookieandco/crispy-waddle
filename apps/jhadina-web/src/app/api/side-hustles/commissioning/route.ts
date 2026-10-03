import {NextResponse} from 'next/server'
import {
  listSideHustleCommissioningQueue,
  summarizeSideHustleCommissioning,
} from '@jhadina/opportunity-core'
import {requireRequestIdentity} from '@/lib/auth/request-user'

export const dynamic='force-dynamic'
export const runtime='nodejs'

export async function GET(){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const queue=listSideHustleCommissioningQueue()
    return NextResponse.json({
      ok:true,
      requestId,
      summary:summarizeSideHustleCommissioning(queue),
      queue,
      externalActionAuthorized:false,
      moneyMovementAuthorized:false,
    },{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to build Side Hustle commissioning queue'
    const status=/Authenticated|identity|session/i.test(message)?401:400
    return NextResponse.json({ok:false,requestId,error:message},{status,headers:{'cache-control':'no-store'}})
  }
}
