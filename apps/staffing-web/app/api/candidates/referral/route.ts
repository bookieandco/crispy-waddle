import { NextResponse } from "next/server";
import { getCandidateReferralService } from "@/lib/staffing/referral";

export async function POST(request: Request) {
  try {
    const body=await request.json();
    if(!body.organizationId||!body.applicationId||!body.agencyUserId||!body.employerUserId) return NextResponse.json({error:"organizationId, applicationId, agencyUserId and employerUserId are required"},{status:400});
    const referral=await getCandidateReferralService().refer({organizationId:body.organizationId,applicationId:body.applicationId,agencyUserId:body.agencyUserId,employerUserId:body.employerUserId,subject:typeof body.subject==="string"?body.subject:undefined,message:typeof body.message==="string"?body.message:undefined});
    return NextResponse.json({referral},{status:201});
  } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"Unable to refer candidate"},{status:500}); }
}
