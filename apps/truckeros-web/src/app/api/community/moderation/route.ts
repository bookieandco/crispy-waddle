import {NextRequest} from "next/server";
import {apiEnabled,assertSafeMutation,database,failure,readPayload,response,session} from "@/lib/communityServer";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;

export async function GET(request:NextRequest){
  try{
    if(!apiEnabled())throw Error("Community preview not enabled");
    const db=database(),token=session(request);
    return response({reports:db.moderationQueue(token),appeals:db.appealQueue(token)});
  }catch(err){return failure(err);}
}
export async function POST(request:NextRequest){
  try{
    assertSafeMutation(request);
    const p=await readPayload(request);
    const db=database(),token=session(request);
    const action=p.action,postId=p.postId,reason=p.reason;
    if(action==="resolveAppeal"){
      if(typeof p.appealId!=="string"||typeof p.reviewNote!=="string"||!["uphold","restore"].includes(String(p.decision)))throw Error("Invalid appeal decision");
      db.resolveAppeal(token,p.appealId,p.decision as "uphold"|"restore",p.reviewNote);
      return response({resolved:true});
    }
    if(typeof action!=="string"||!["hide","restore","retain"].includes(action)||
       typeof postId!=="string"||typeof reason!=="string")throw Error("Invalid moderation request");
    const decision=db.moderatePost(token,postId,action as "hide"|"restore"|"retain",reason);
    return response(decision);
  }catch(err){return failure(err);}
}
