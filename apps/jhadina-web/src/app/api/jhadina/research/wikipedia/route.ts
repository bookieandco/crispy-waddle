import {NextRequest,NextResponse} from "next/server"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"
import {searchWikipediaPublic,validWikiQuery} from "@/lib/intelligence/wikipedia-public-research"
export const runtime="nodejs"
export const dynamic="force-dynamic"
const headers={"Cache-Control":"private, no-store"}
export async function GET(request:NextRequest){
 const claimed=request.headers.get("x-jhadina-user-id")?.trim()
 if(!claimed)return NextResponse.json({success:false,error:"Sign in required"},{status:401,headers})
 try{await (await createRequestIdentityVerifier()).verify({userId:claimed})}
 catch{return NextResponse.json({success:false,error:"Owner session required"},{status:401,headers})}
 const q=validWikiQuery(request.nextUrl.searchParams.get("q"))
 if(!q)return NextResponse.json({success:false,error:"Use a public search phrase of 3–120 characters"},{status:400,headers})
 try{
  const data=await searchWikipediaPublic(q)
  return NextResponse.json({success:true,data},{headers})
 }catch{
  return NextResponse.json({success:false,error:"Public encyclopedia search is temporarily unavailable"},{status:503,headers})
 }
}
