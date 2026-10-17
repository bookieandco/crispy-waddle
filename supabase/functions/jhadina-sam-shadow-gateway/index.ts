/**
 * SWLC/SAM shadow-only database presence probe.
 * This deliberately does NOT reuse the write-capable SAM commissioning
 * gateway, and does not enable customer, bid, outreach or payment actions.
 *
 * Deployment requires verify_jwt=false so an external GitHub OIDC JWT reaches
 * this function; the STRICT GitHub OIDC verification below is mandatory.
 * Never expose this function as an anonymous health endpoint.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.0"
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@5.10.0"

const ISSUER="https://token.actions.githubusercontent.com"
const JWKS="https://token.actions.githubusercontent.com/.well-known/jwks"
const AUDIENCE="jhadina-sam-shadow"
const REPOSITORY="bookieandco/crispy-waddle"
const REPOSITORY_ID="1320251374"
const OWNER="bookieandco"
const OWNER_ID="289295074"
const MAIN_REF="refs/heads/main"
const WORKFLOW_REF="bookieandco/crispy-waddle/.github/workflows/sam-safety-shadow.yml@refs/heads/main"
const IMMUTABLE_SUBJECT="repo:bookieandco@289295074/crispy-waddle@1320251374:ref:refs/heads/main"

function respond(status:number,body:Record<string,unknown>):Response{
  return new Response(JSON.stringify(body),{
    status,headers:{
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store",
      "x-content-type-options":"nosniff",
    },
  })
}
async function authorized(req:Request):Promise<boolean>{
  const header=req.headers.get("authorization")??""
  if(!header.startsWith("Bearer "))return false
  const token=header.slice(7).trim()
  if(!token)return false
  try{
    if(decodeJwt(token).iss!==ISSUER)return false
    const jwks=createRemoteJWKSet(new URL(JWKS))
    const claims=(await jwtVerify(token,jwks,{
      issuer:ISSUER,audience:AUDIENCE,
    })).payload as Record<string,unknown>
    return claims.sub===IMMUTABLE_SUBJECT &&
      claims.repository===REPOSITORY &&
      claims.repository_id===REPOSITORY_ID &&
      claims.repository_owner===OWNER &&
      claims.repository_owner_id===OWNER_ID &&
      claims.ref===MAIN_REF &&
      claims.workflow_ref===WORKFLOW_REF &&
      claims.event_name==="workflow_dispatch"
  }catch{return false}
}
function secretKey():string|undefined{
  const modern=Deno.env.get("SUPABASE_SECRET_KEYS")
  if(modern){
    try{
      const parsed=JSON.parse(modern) as Record<string,string>
      if(typeof parsed.default==="string"&&parsed.default.trim())return parsed.default
    }catch{}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||undefined
}
Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return respond(405,{ok:false,ready:false,error:"method_not_allowed"})
  if(!(await authorized(req)))return respond(401,{ok:false,ready:false,error:"unauthorized"})
  const body=await req.json().catch(()=>null) as unknown
  if(!body||typeof body!=="object"||Array.isArray(body)||
    Object.keys(body).length!==1||(body as {action?:unknown}).action!=="probe_db"){
    return respond(400,{ok:false,ready:false,error:"unsupported_action"})
  }
  const url=Deno.env.get("SUPABASE_URL")
  const secret=secretKey()
  if(!url||!secret)return respond(503,{ok:false,ready:false,error:"shadow_db_credentials_unavailable"})
  try{
    const client=createClient(url,secret,{
      auth:{autoRefreshToken:false,persistSession:false},
    })
    const {error}=await client.from("jhadina_sam_scan_runs")
      .select("id",{head:true}).limit(1)
    if(error)return respond(503,{ok:false,ready:false,error:"shadow_db_read_unavailable"})
    return respond(200,{
      ok:true,ready:true,mode:"read_only_shadow",
      database:"queryable",authority:"none",canMutate:false,
    })
  }catch{
    return respond(503,{ok:false,ready:false,error:"shadow_db_read_unavailable"})
  }
})
