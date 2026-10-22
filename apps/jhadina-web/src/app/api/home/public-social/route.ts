import {NextRequest,NextResponse} from "next/server"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"
import {readBlueskyPublicAuthor,readMastodonPublicAuthor,readGitHubPublicActivity} from "@/lib/social/public-feed-adapters"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const result=(data:Record<string,unknown>,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}})

export async function GET(request:NextRequest){
  try{await(await createRequestIdentityVerifier()).verify({})}
  catch{return result({ok:false,error:"SIGN_IN_REQUIRED",items:[]},401)}
  const provider=request.nextUrl.searchParams.get("provider")
  const account=request.nextUrl.searchParams.get("account")
  if(!account || account.length>250 || (provider!=="bluesky" && provider!=="mastodon" && provider!=="github"))
    return result({ok:false,error:"PUBLIC_SOURCE_INVALID",items:[]},400)
  try{
    const items=provider==="bluesky"
      ?await readBlueskyPublicAuthor(account)
      :provider==="mastodon"
        ?await readMastodonPublicAuthor({handle:account})
        :await readGitHubPublicActivity(account)
    return result({ok:true,provider,sourceTrust:"provider_verified",kind:"public_author_preview",
      ownerConnected:false,durable:false,items,
      explanation:"Public author preview; not a private following timeline or saved Jhadina preference"})
  }catch{
    return result({ok:false,provider,error:"PUBLIC_SOURCE_UNAVAILABLE_OR_NOT_ALLOWED",items:[]},502)
  }
}
