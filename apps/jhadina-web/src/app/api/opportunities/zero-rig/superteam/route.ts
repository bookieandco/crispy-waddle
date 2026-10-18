import { NextRequest,NextResponse } from 'next/server'
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity'
import { checkZeroRigLiveReadiness,executeZeroRigReadOnlyScout } from '@/lib/opportunities/zero-rig-live-runtime'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'}
const failure=(error:string,status:number)=>NextResponse.json({ok:false,error,mode:'READ_ONLY'}, {status,headers})

export async function GET(request:NextRequest){
  let userId:string
  try { userId=(await (await createRequestIdentityVerifier()).verify({})).userId }
  catch { return failure('UNAUTHORIZED',401) }

  const readiness=checkZeroRigLiveReadiness(userId,process.env)
  if (readiness.state==='owner_unconfigured'||readiness.state==='disabled') {
    return failure('ZERO_RIG_DISCOVERY_NOT_COMMISSIONED',503)
  }
  if (readiness.state==='forbidden') return failure('FORBIDDEN',403)

  const mode=request.nextUrl.searchParams.get('mode')??'readiness'
  if (mode!=='readiness'&&mode!=='list') return failure('INVALID_READ_MODE',400)
  // Do not reveal credentials or readiness metadata to untrusted identities.
  if(mode==='readiness') return NextResponse.json({
    ok:true,mode:'READ_ONLY',readiness:readiness.state,externalActionsAuthorized:false,
  },{headers})

  if (readiness.state!=='ready') return failure('ZERO_RIG_PROVIDER_CREDENTIAL_NOT_CONFIGURED',503)
  const takeText=request.nextUrl.searchParams.get('take')??'20'
  if(!/^\d{1,2}$/.test(takeText)||Number(takeText)<1||Number(takeText)>20) {
    return failure('INVALID_LIMIT',400)
  }
  try{
    const result=await executeZeroRigReadOnlyScout({
      userId,env:process.env,now:new Date().toISOString(),take:Number(takeText),
    })
    return NextResponse.json({
      ok:true,mode:'READ_ONLY',provider:'superteam',result,
      verifiedPayouts:0,submissionAuthorized:false,claimAuthorized:false,
      actionAuthorized:false,
    },{headers})
  }catch(error){
    const code=error instanceof Error?error.message:'ZERO_RIG_PROVIDER_REQUEST_FAILED'
    const status=code==='ZERO_RIG_PROVIDER_AUTH_REJECTED'?503:code==='ZERO_RIG_PROVIDER_RATE_LIMITED'?429:502
    return failure('ZERO_RIG_PROVIDER_READ_FAILED',status)
  }
}
