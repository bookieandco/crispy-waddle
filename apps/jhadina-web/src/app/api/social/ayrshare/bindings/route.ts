import {NextRequest,NextResponse} from "next/server"
import type {SocialPlatform} from "@jhadina/social-core"
import {
  approveAndRecordAyrshareBinding,
  requestAyrshareBindingApproval,
} from "@/lib/social/ayrshare-binding-runtime"

export const dynamic="force-dynamic"
export const runtime="nodejs"

type BindingBody={
  id?:string
  profileKey?:string
  platform?:SocialPlatform
  name?:string
  handle?:string
  evidenceRefs?:string[]
  actionId?:string
  approvalReceiptId?:string
}

function parse(body:BindingBody){
  if(!body.id?.trim()||!body.profileKey?.trim()||!body.platform||!body.name?.trim()||!body.evidenceRefs?.length){
    throw new Error("AYRSHARE_BINDING_FIELDS_REQUIRED")
  }
  return{
    id:body.id,
    profileKey:body.profileKey,
    platform:body.platform,
    name:body.name,
    handle:body.handle,
    evidenceRefs:body.evidenceRefs,
  }
}

export async function POST(req:NextRequest){
  const requestId=crypto.randomUUID()
  try{
    const body=await req.json() as BindingBody
    const result=await requestAyrshareBindingApproval(parse(body))
    return NextResponse.json({
      ok:true,
      requestId,
      ...result,
    },{status:202,headers:{"cache-control":"no-store"}})
  }catch(error){
    const message=error instanceof Error?error.message:"Unable to request Ayrshare binding approval"
    const status=/Authenticated|session/i.test(message)?401:400
    return NextResponse.json({ok:false,requestId,error:message},{status,headers:{"cache-control":"no-store"}})
  }
}

export async function PUT(req:NextRequest){
  const requestId=crypto.randomUUID()
  try{
    const body=await req.json() as BindingBody
    if(!body.actionId?.trim()||!body.approvalReceiptId?.trim()){
      throw new Error("AYRSHARE_BINDING_APPROVAL_FIELDS_REQUIRED")
    }
    const result=await approveAndRecordAyrshareBinding({
      ...parse(body),
      actionId:body.actionId,
      approvalReceiptId:body.approvalReceiptId,
    })
    return NextResponse.json({
      ok:true,
      requestId,
      ...result,
    },{status:201,headers:{"cache-control":"no-store"}})
  }catch(error){
    const message=error instanceof Error?error.message:"Unable to approve Ayrshare binding"
    const status=/Authenticated|session/i.test(message)?401:/APPROVAL|stale/i.test(message)?409:400
    return NextResponse.json({ok:false,requestId,error:message},{status,headers:{"cache-control":"no-store"}})
  }
}
