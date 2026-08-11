import { NextResponse } from "next/server";
import { getInterviewOutcomeService } from "@/lib/staffing/interview-outcome";

const outcomes=new Set(["PASS","HOLD","FAIL"]);

export async function POST(request:Request){
  try{const body=await request.json(); if(!body.organizationId||!body.interviewId||!body.employerUserId||!outcomes.has(body.outcome)) return NextResponse.json({error:"organizationId, interviewId, employerUserId and a valid outcome are required"},{status:400}); const result=await getInterviewOutcomeService().record({organizationId:body.organizationId,interviewId:body.interviewId,employerUserId:body.employerUserId,outcome:body.outcome,note:typeof body.note==="string"?body.note:undefined}); return NextResponse.json({result},{status:201});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to record interview outcome"},{status:500});}
}
