import { NextRequest, NextResponse } from "next/server"
import { listGrowthDraftVersions } from "@/lib/growth/engine"
export const dynamic="force-dynamic"
export async function GET(req:NextRequest){const userId=req.headers.get("x-jhadina-user-id")||"default-user";const draftId=new URL(req.url).searchParams.get("draftId");if(!draftId)return NextResponse.json({success:false,error:"draftId is required"},{status:400});return NextResponse.json({success:true,data:{versions:listGrowthDraftVersions(userId,draftId)}})}
