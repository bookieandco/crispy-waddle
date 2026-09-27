import { createClient } from "npm:@supabase/supabase-js@2.57.0"
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@5.10.0"

const ALLOWED_ISSUERS = new Set([
  "https://oidc.vercel.com/bookieandcos-projects",
  "https://oidc.vercel.com",
])
const AUDIENCE = "https://vercel.com/bookieandcos-projects"
const SUBJECT = "owner:bookieandcos-projects:project:crispy-waddle-jhadina-web:environment:production"
const OWNER_ID = "team_NYQJ3NwijZZ6UJQdOdc5FjmX"
const PROJECT_ID = "prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco"
const PROJECT_NAME = "crispy-waddle-jhadina-web"
const OWNER = "bookieandcos-projects"

function json(status:number, body:unknown):Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store",
      "x-content-type-options":"nosniff",
    },
  })
}

async function authorizeVercel(req:Request):Promise<boolean> {
  const authorization=req.headers.get("authorization")??""
  if(!authorization.startsWith("Bearer ")) return false
  const token=authorization.slice("Bearer ".length).trim()
  if(!token) return false

  let decoded:ReturnType<typeof decodeJwt>
  try { decoded=decodeJwt(token) } catch { return false }
  const issuer=typeof decoded.iss==="string"?decoded.iss:""
  if(!ALLOWED_ISSUERS.has(issuer)) return false

  try {
    const jwks=createRemoteJWKSet(new URL(issuer+"/.well-known/jwks"))
    const verified=await jwtVerify(token,jwks,{issuer,audience:AUDIENCE})
    const p=verified.payload as Record<string,unknown>
    return p.sub===SUBJECT &&
      p.owner===OWNER &&
      p.owner_id===OWNER_ID &&
      p.project===PROJECT_NAME &&
      p.project_id===PROJECT_ID &&
      p.environment==="production"
  } catch {
    return false
  }
}

function secretKey():string|undefined {
  const modern=Deno.env.get("SUPABASE_SECRET_KEYS")
  if(modern){
    try{
      const parsed=JSON.parse(modern) as Record<string,string>
      if(parsed.default) return parsed.default
    }catch{}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??undefined
}

function boundedLimit(value:unknown):number {
  const n=Number(value??50)
  if(!Number.isInteger(n)||n<1||n>100) throw new Error("SAM_GATEWAY_LIMIT_INVALID")
  return n
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST") return json(405,{ok:false,error:"method_not_allowed"})
  if(!(await authorizeVercel(req))) return json(401,{ok:false,error:"unauthorized"})

  const url=Deno.env.get("SUPABASE_URL")
  const key=secretKey()
  if(!url||!key) return json(503,{ok:false,error:"supabase_admin_unavailable"})

  try{
    const body=await req.json().catch(()=>({})) as Record<string,unknown>
    const action=typeof body.action==="string"?body.action:"command_center"
    if(action!=="command_center") return json(400,{ok:false,error:"unsupported_action"})
    const limit=boundedLimit(body.limit)

    const supabase=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})
    const catalogResult=await supabase
      .from("jhadina_sam_catalog")
      .select("notice_id,solicitation_number,title,agency,office,posted_date,response_deadline,naics_codes,classification_codes,set_aside,source_url,version,last_seen_at")
      .order("last_seen_at",{ascending:false})
      .limit(limit)

    if(catalogResult.error) throw catalogResult.error
    const catalog=(catalogResult.data??[]) as Array<Record<string,unknown>>
    const noticeIds=catalog.map(row=>String(row.notice_id??"")).filter(Boolean)
    if(!noticeIds.length){
      return json(200,{ok:true,catalog:[],analyses:[],providers:[],pursuits:[]})
    }

    const [analysisResult,providerResult,pursuitResult]=await Promise.all([
      supabase.from("jhadina_sam_analysis")
        .select("notice_id,requirements,subcontractability,operating,analyzed_at")
        .in("notice_id",noticeIds),
      supabase.from("jhadina_sam_provider_candidates")
        .select("notice_id,requirement_id,provider_key,provider_name,country,uei,cage,score,status,sources,discovered_at")
        .in("notice_id",noticeIds),
      supabase.from("jhadina_sam_pursuit_options")
        .select("notice_id,status,assignments,uncovered_requirement_ids,quote_targets,provider_bench,commercial,blockers,generated_at")
        .in("notice_id",noticeIds),
    ])

    const error=analysisResult.error??providerResult.error??pursuitResult.error
    if(error) throw error

    return json(200,{
      ok:true,
      catalog,
      analyses:analysisResult.data??[],
      providers:providerResult.data??[],
      pursuits:pursuitResult.data??[],
    })
  }catch(error){
    return json(502,{
      ok:false,
      error:"sam_gateway_query_failed",
      reason:error instanceof Error?error.message:"query_failed",
    })
  }
})
