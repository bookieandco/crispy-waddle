import {NextRequest,NextResponse} from "next/server"
import {
  ingestAyrshareDeliveredAnalytics,
  ingestAyrsharePostAnalytics,
} from "@/lib/social/ayrshare-analytics-runtime"

export const dynamic="force-dynamic"
export const runtime="nodejs"

export async function POST(req:NextRequest){
  const requestId=crypto.randomUUID()
  try{
    const body=await req.json().catch(()=>({})) as{
      outboxId?:string
      proposalId?:string
      limit?:number
    }
    if(body.outboxId?.trim()){
      const result=await ingestAyrsharePostAnalytics(body.outboxId)
      return NextResponse.json({ok:true,requestId,...result},{
        headers:{"cache-control":"no-store"},
      })
    }
    const result=await ingestAyrshareDeliveredAnalytics({
      proposalId:body.proposalId?.trim()||undefined,
      limit:body.limit,
    })
    return NextResponse.json({ok:true,requestId,...result},{
      headers:{"cache-control":"no-store"},
    })
  }catch(error){
    const message=error instanceof Error?error.message:"Unable to ingest Ayrshare analytics"
    const status=/Authenticated|session/i.test(message)?401:/NOT_FOUND/.test(message)?404:400
    return NextResponse.json({ok:false,requestId,error:message},{
      status,
      headers:{"cache-control":"no-store"},
    })
  }
}
