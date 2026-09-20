import { NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { listApprovalLifecycle } from "@/lib/system/approval-lifecycle"

export const dynamic="force-dynamic"

export async function GET(request:Request){
  const claimedUserId=request.headers.get("x-jhadina-user-id")
  if(!claimedUserId)return NextResponse.json({error:"x-jhadina-user-id is required"},{status:401})
  try{
    const identity=createRequestIdentityVerifier(request)
    const verifiedUserId=await identity.verify(claimedUserId)
    const approvals=await listApprovalLifecycle(verifiedUserId)
    return NextResponse.json({ok:true,data:{approvals,verifiedUserId}})
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to read approvals"},{status:403})
  }
}
