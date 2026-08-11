import { NextResponse } from "next/server";
import { getEmployerInterviewService } from "@/lib/staffing/employer-interview";

const decisions=new Set(["INTERVIEW","HOLD","DECLINE"]);

export async function POST(request:Request){
  try{const body=await request.json(); if(!body.organizationId||!body.applicationId||!body.employerUserId||!decisions.has(body.decision)) return NextResponse.json({error:"organizationId, applicationId, employerUserId and a valid decision are required"},{status:400}); const result=await getEmployerInterviewService().decide({organizationId:body.organizationId,applicationId:body.applicationId,employerUserId:body.employerUserId,decision:body.decision,note:typeof body.note==="string"?body.note:undefined}); return NextResponse.json({result},{status:201});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to record employer decision"},{status:500});}
}
