import { NextRequest,NextResponse } from "next/server"
import { readSessionMoneyFeed } from "@/lib/money/feed-runtime"

export const dynamic="force-dynamic"

export async function GET(req:NextRequest){
 try{
  const limit=Number(req.nextUrl.searchParams.get("limit")??"20")
  const events=await readSessionMoneyFeed(limit)
  return NextResponse.json({success:true,data:{events}})
 }catch(error){
  const message=error instanceof Error?error.message:"Money feed unavailable"
  const status=message.includes("SESSION")?401:500
  return NextResponse.json({success:false,error:message},{status})
 }
}
