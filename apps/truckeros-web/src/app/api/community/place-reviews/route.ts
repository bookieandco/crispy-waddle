import {NextRequest} from "next/server";
import {apiEnabled,database,failure,response,session} from "@/lib/communityServer";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;

/** Review visibility is explicitly scoped by logged-in driver session.
 * An unregistered user sees no social opinions; provider data remains available.
 */
export async function GET(request:NextRequest){
  try {
    if(!apiEnabled())throw Error("Community preview not enabled");
    const placeId=request.nextUrl.searchParams.get("placeId");
    if(!placeId||placeId.length>128)throw Error("Missing place reference");
    const db=database();
    return response({reviews:db.placeReviews(session(request),placeId)});
  }catch(error){return failure(error);}
}
