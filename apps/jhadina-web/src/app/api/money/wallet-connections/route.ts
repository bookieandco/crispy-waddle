import { randomUUID } from "node:crypto"
import { NextRequest,NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic="force-dynamic"

async function verifiedUserId(){
 const client=await createClient()
 const {data,error}=await client.auth.getClaims()
 const id=data?.claims?.sub
 if(error||!id)throw new Error("MONEY_WALLET_SESSION_REQUIRED")
 return id
}
function admin(){
 const client=createServiceRoleClient()
 if(!client)throw new Error("MONEY_PRIVATE_STORE_NOT_CONFIGURED")
 return client
}
function phantomSolanaAddress(value:unknown){
 const address=String(value??"").trim()
 if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))throw new Error("MONEY_PHANTOM_ADDRESS_INVALID")
 return address
}

export async function POST(req:NextRequest){
 try{
  const userId=await verifiedUserId()
  const body=await req.json() as Record<string,unknown>
  if(body.provider!=="phantom"||body.network!=="SOLANA")throw new Error("MONEY_WALLET_PROVIDER_INVALID")
  const address=phantomSolanaAddress(body.address),db=admin(),now=new Date().toISOString()
  const {data:existing,error:lookupError}=await db.from("money_wallet_connections").select("connection_id").eq("user_id",userId).eq("provider","phantom").eq("network","SOLANA").eq("address",address).maybeSingle()
  if(lookupError)throw new Error("MONEY_WALLET_LOOKUP_FAILED:"+lookupError.message)
  const connectionId=existing?.connection_id??randomUUID()
  if(existing){
   const {error}=await db.from("money_wallet_connections").update({status:"ACTIVE",updated_at:now,evidence_ids:["phantom:owner-browser-connection-only"]}).eq("connection_id",connectionId).eq("user_id",userId)
   if(error)throw new Error("MONEY_WALLET_STORE_FAILED:"+error.message)
  }else{
   const {error}=await db.from("money_wallet_connections").insert({connection_id:connectionId,user_id:userId,provider:"phantom",network:"SOLANA",address,mode:"OWNER_WALLET",status:"ACTIVE",evidence_ids:["phantom:owner-browser-connection-only"],connected_at:now,updated_at:now})
   if(error)throw new Error("MONEY_WALLET_STORE_FAILED:"+error.message)
  }
  return NextResponse.json({success:true,data:{connectionId,address,provider:"phantom",network:"SOLANA",mode:"OWNER_WALLET",ownershipVerified:false,canSign:false}})
 }catch(error){
  const message=error instanceof Error?error.message:"Wallet connection failed"
  const status=message.includes("SESSION")?401:message.includes("INVALID")?400:500
  return NextResponse.json({success:false,error:message},{status})
 }
}

export async function DELETE(req:NextRequest){
 try{
  const userId=await verifiedUserId()
  const body=await req.json() as Record<string,unknown>
  const address=phantomSolanaAddress(body.address),db=admin(),now=new Date().toISOString()
  const {data,error}=await db.from("money_wallet_connections").update({status:"DISCONNECTED",updated_at:now}).eq("user_id",userId).eq("provider","phantom").eq("network","SOLANA").eq("address",address).select("connection_id")
  if(error)throw new Error("MONEY_WALLET_DISCONNECT_FAILED:"+error.message)
  if(!data?.length)throw new Error("MONEY_WALLET_CONNECTION_NOT_FOUND")
  return NextResponse.json({success:true,data:{address,status:"DISCONNECTED"}})
 }catch(error){
  const message=error instanceof Error?error.message:"Wallet disconnect failed"
  const status=message.includes("SESSION")?401:message.includes("INVALID")||message.includes("NOT_FOUND")?400:500
  return NextResponse.json({success:false,error:message},{status})
 }
}
