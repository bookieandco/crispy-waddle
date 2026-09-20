import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { runSessionGovernedMoneyTransactionRead } from "@/lib/money/governed-transaction-read-runtime"

export async function GET(request:NextRequest){
  try{
    const accountId=request.nextUrl.searchParams.get("accountId")?.trim();if(!accountId)return NextResponse.json({success:false,error:"accountId is required"},{status:400});
    const requestId=request.headers.get("x-jhadina-request-id")?.trim()||randomUUID();
    const result=await runSessionGovernedMoneyTransactionRead(accountId,requestId);
    return NextResponse.json({success:true,data:{transactions:result.transactions}});
  }catch(error){
    const message=error instanceof Error?error.message:"Money transaction read failed";
    const denied=message.includes("ACCESS_DENIED")||message.includes("identity")||message.includes("session");
    return NextResponse.json({success:false,error:message},{status:denied?403:500});
  }
}
