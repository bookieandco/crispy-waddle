import { NextRequest, NextResponse } from 'next/server'
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity'
import { listPublicSamCatalog } from '@/lib/money-opportunities/sam-catalog-view'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic='force-dynamic'

function int(value:string|null,fallback:number){
  if(value===null)return fallback
  const n=Number(value)
  if(!Number.isInteger(n)||n<1||n>100)throw new Error('Invalid limit')
  return n
}
function token(value:string|null,max=80){
  const v=value?.trim()
  if(!v)return undefined
  if(v.length>max||!/^[A-Za-z0-9 _()&.,\/-]+$/.test(v))throw new Error('Invalid catalog filter')
  return v
}
export async function GET(request:NextRequest){
  try{
    await (await createRequestIdentityVerifier()).verify({})
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'SAM catalog is not configured'},{status:503})
    const opportunities=await listPublicSamCatalog(client,{
      limit:int(request.nextUrl.searchParams.get('limit'),50),
      naics:token(request.nextUrl.searchParams.get('naics'),16),
      setAside:token(request.nextUrl.searchParams.get('setAside'),120),
    })
    return NextResponse.json({ok:true,count:opportunities.length,opportunities},{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})
  }catch(error){
    const message=error instanceof Error?error.message:'SAM catalog failed'
    const auth=/Authenticated|identity|session/i.test(message)
    const validation=/Invalid catalog|Invalid limit/.test(message)
    return NextResponse.json({ok:false,error:auth?'Authentication required':validation?message:'SAM catalog failed'},{status:auth?401:validation?400:502,headers:{'cache-control':'no-store'}})
  }
}
