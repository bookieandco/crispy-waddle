import {NextResponse} from 'next/server'
import {
  SIDE_HUSTLE_FAMILY_IDS,
  getSideHustleExecutorRegistration,
  listSideHustleExecutorRegistrations,
  type SideHustleFamily,
} from '@jhadina/opportunity-core'
import {requireRequestIdentity} from '@/lib/auth/request-user'

export const dynamic='force-dynamic'
export const runtime='nodejs'

export async function GET(request:Request){
  const requestId=crypto.randomUUID()
  try{
    await requireRequestIdentity()
    const family=new URL(request.url).searchParams.get('family')?.trim()
    if(family){
      if(!SIDE_HUSTLE_FAMILY_IDS.includes(family as SideHustleFamily)){
        return NextResponse.json(
          {ok:false,requestId,error:'Invalid Side Hustle family'},
          {status:400,headers:{'cache-control':'no-store'}},
        )
      }
      const executor=getSideHustleExecutorRegistration(family as SideHustleFamily)
      return NextResponse.json({
        ok:true,requestId,executor,
        externalActionAuthorized:false,moneyMovementAuthorized:false,
      },{headers:{'cache-control':'no-store'}})
    }

    const executors=listSideHustleExecutorRegistrations()
    return NextResponse.json({
      ok:true,requestId,executors,
      externalActionAuthorized:false,moneyMovementAuthorized:false,
    },{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to load Side Hustle executors'
    const status=/Authenticated|identity|session/i.test(message)?401:400
    return NextResponse.json(
      {ok:false,requestId,error:message},
      {status,headers:{'cache-control':'no-store'}},
    )
  }
}
