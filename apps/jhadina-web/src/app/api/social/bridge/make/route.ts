import {NextRequest,NextResponse} from "next/server"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"
import {normalizeMakeEnvelope,verifyMakeSignature} from "@/lib/social/make-bridge"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const noStore={"Cache-Control":"private, no-store"}
const result=(data:Record<string,unknown>,status=200)=>NextResponse.json(data,{status,headers:noStore})

/** Visible readiness only. Never expose webhook tokens or an owner id. */
export async function GET(){
  try{await (await createRequestIdentityVerifier()).verify({})}
  catch{return result({status:"unauthenticated"},401)}
  const secret=process.env.JHADINA_MAKE_WEBHOOK_SECRET
  const owner=process.env.JHADINA_MAKE_ALLOWED_OWNER_ID
  return result({
    provider:"make",mode:"external_automation",
    status:secret && secret.length>=32 && owner?"integration_test_only":"not_configured",
    durableIntake:false,publicationAuthority:false,
    explanation:"Make events are not a verified feed or permission to post. A durable owner-scoped sink is not commissioned.",
  })
}

/** Fail closed. A correct HMAC is NOT authorization to add verified feed rows.
 * Durable replay protection and the correct Supabase tenant must be certified
 * before events can enter the canonical feed store.
 */
export async function POST(request:NextRequest){
  const secret=process.env.JHADINA_MAKE_WEBHOOK_SECRET
  const owner=process.env.JHADINA_MAKE_ALLOWED_OWNER_ID
  if(!secret || secret.length<32 || !owner)return result({accepted:false,error:"MAKE_NOT_CONFIGURED"},503)
  const raw=await request.text()
  if(raw.length>32768)return result({accepted:false,error:"MAKE_PAYLOAD_TOO_LARGE"},413)
  if(!verifyMakeSignature({
    rawBody:raw,secret,
    timestamp:request.headers.get("x-jhadina-make-timestamp"),
    signature:request.headers.get("x-jhadina-make-signature"),
  }))return result({accepted:false,error:"MAKE_SIGNATURE_INVALID"},401)
  try{
    const event=normalizeMakeEnvelope(JSON.parse(raw),owner)
    return result({
      accepted:false,verifiedTransport:true,stored:false,
      deliveryId:event.deliveryId,
      sourceTrust:"workflow_unverified",
      error:"MAKE_DURABLE_SINK_NOT_COMMISSIONED",
    },503)
  }catch{return result({accepted:false,error:"MAKE_ENVELOPE_INVALID"},400)}
}
