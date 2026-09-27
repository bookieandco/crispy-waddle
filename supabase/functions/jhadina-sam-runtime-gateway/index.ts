import { createClient } from "npm:@supabase/supabase-js@2.57.0"
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@5.10.0"

const GITHUB_ISSUER="https://token.actions.githubusercontent.com"
const GITHUB_JWKS="https://token.actions.githubusercontent.com/.well-known/jwks"
const AUDIENCE="jhadina-sam-runtime"
const REPOSITORY="bookieandco/crispy-waddle"
const REPOSITORY_ID="1320251374"
const OWNER="bookieandco"
const OWNER_ID="289295074"
const MAIN_REF="refs/heads/main"
const WORKFLOW_REF="bookieandco/crispy-waddle/.github/workflows/sam-live-commissioning.yml@refs/heads/main"
const IMMUTABLE_SUBJECT="repo:bookieandco@289295074/crispy-waddle@1320251374:ref:refs/heads/main"

const SAM_TABLES=new Set([
  "jhadina_sam_scan_runs",
  "jhadina_sam_catalog",
  "jhadina_sam_versions",
  "jhadina_sam_documents",
  "jhadina_sam_analysis",
  "jhadina_sam_provider_candidates",
  "jhadina_sam_pursuit_options",
])
const FILTER_OPS=new Set(["eq","neq","in","gt","gte","lt","lte","is"])
const MUTATIONS=new Set(["insert","upsert","update"])
const EVENTS=new Set(["push","schedule","workflow_dispatch"])
const COLUMN=/^[A-Za-z0-9_]+$/
const SELECT=/^[A-Za-z0-9_*,\s]+$/

type Json=Record<string,unknown>
type Filter={op:string;column:string;value:unknown}
type DbRequest={
  table?:unknown
  method?:unknown
  payload?:unknown
  options?:unknown
  select?:unknown
  count?:unknown
  head?:unknown
  filters?:unknown
  order?:unknown
  limit?:unknown
  resultMode?:unknown
}

function json(status:number,body:unknown):Response{
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store",
      "x-content-type-options":"nosniff",
    },
  })
}

async function authorizeGitHub(req:Request):Promise<boolean>{
  const authorization=req.headers.get("authorization")??""
  if(!authorization.startsWith("Bearer "))return false
  const token=authorization.slice("Bearer ".length).trim()
  if(!token)return false

  let decoded:ReturnType<typeof decodeJwt>
  try{decoded=decodeJwt(token)}catch{return false}
  if(decoded.iss!==GITHUB_ISSUER)return false

  try{
    const jwks=createRemoteJWKSet(new URL(GITHUB_JWKS))
    const verified=await jwtVerify(token,jwks,{issuer:GITHUB_ISSUER,audience:AUDIENCE})
    const p=verified.payload as Record<string,unknown>
    return p.sub===IMMUTABLE_SUBJECT &&
      p.repository===REPOSITORY &&
      p.repository_id===REPOSITORY_ID &&
      p.repository_owner===OWNER &&
      p.repository_owner_id===OWNER_ID &&
      p.ref===MAIN_REF &&
      p.workflow_ref===WORKFLOW_REF &&
      EVENTS.has(String(p.event_name??""))
  }catch{
    return false
  }
}

function secretKey():string|undefined{
  const modern=Deno.env.get("SUPABASE_SECRET_KEYS")
  if(modern){
    try{
      const parsed=JSON.parse(modern) as Record<string,string>
      if(parsed.default)return parsed.default
    }catch{}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??undefined
}

function samKey():string|undefined{
  return Deno.env.get("sam_key")?.trim()||Deno.env.get("SAM_GOV_API_KEY")?.trim()||undefined
}

function safeError(error:unknown){
  if(!error||typeof error!=="object")return error?{message:String(error)}:null
  const e=error as Record<string,unknown>
  return {
    message:typeof e.message==="string"?e.message:"database error",
    code:typeof e.code==="string"?e.code:undefined,
    details:typeof e.details==="string"?e.details:undefined,
    hint:typeof e.hint==="string"?e.hint:undefined,
  }
}

function parseFilters(value:unknown):Filter[]{
  if(!Array.isArray(value))return[]
  if(value.length>12)throw new Error("too_many_filters")
  return value.map((raw)=>{
    if(!raw||typeof raw!=="object")throw new Error("invalid_filter")
    const row=raw as Record<string,unknown>
    const op=String(row.op??"")
    const column=String(row.column??"")
    if(!FILTER_OPS.has(op)||!COLUMN.test(column))throw new Error("invalid_filter")
    if(op==="in"&&(!Array.isArray(row.value)||row.value.length>500))throw new Error("invalid_in_filter")
    return {op,column,value:row.value}
  })
}

function boundedLimit(value:unknown):number|undefined{
  if(value===undefined||value===null)return undefined
  const n=Number(value)
  if(!Number.isInteger(n)||n<1||n>5000)throw new Error("invalid_limit")
  return n
}

function validatePayload(value:unknown){
  const size=new TextEncoder().encode(JSON.stringify(value??null)).byteLength
  if(size>5_000_000)throw new Error("payload_too_large")
  if(Array.isArray(value)&&value.length>500)throw new Error("too_many_rows")
}

async function dbAction(supabase:any,request:DbRequest){
  const table=String(request.table??"")
  const method=String(request.method??"")
  if(!SAM_TABLES.has(table))throw new Error("table_not_allowed")
  if(!["select","insert","upsert","update"].includes(method))throw new Error("method_not_allowed")

  const select=typeof request.select==="string"?request.select:"*"
  if(!SELECT.test(select))throw new Error("invalid_select")
  const filters=parseFilters(request.filters)
  const limit=boundedLimit(request.limit)
  const count=request.count==="exact"?"exact":undefined
  const head=request.head===true
  const resultMode=request.resultMode==="single"||request.resultMode==="maybeSingle"
    ?request.resultMode
    :undefined

  let query:any
  if(method==="select"){
    query=supabase.from(table).select(select,{...(count?{count}:{}),...(head?{head:true}:{})})
  }else if(method==="insert"){
    validatePayload(request.payload)
    query=supabase.from(table).insert(request.payload)
    if(request.select!==undefined)query=query.select(select)
  }else if(method==="upsert"){
    validatePayload(request.payload)
    const options=request.options&&typeof request.options==="object"
      ?request.options as Record<string,unknown>
      :{}
    const onConflict=typeof options.onConflict==="string"&&/^[A-Za-z0-9_,]+$/.test(options.onConflict)
      ?options.onConflict
      :undefined
    query=supabase.from(table).upsert(request.payload,{
      ...(onConflict?{onConflict}:{}),
      ...(options.ignoreDuplicates===true?{ignoreDuplicates:true}:{}),
    })
    if(request.select!==undefined)query=query.select(select)
  }else{
    validatePayload(request.payload)
    query=supabase.from(table).update(request.payload)
    if(request.select!==undefined)query=query.select(select)
  }

  for(const filter of filters){
    if(filter.op==="eq")query=query.eq(filter.column,filter.value)
    else if(filter.op==="neq")query=query.neq(filter.column,filter.value)
    else if(filter.op==="in")query=query.in(filter.column,filter.value)
    else if(filter.op==="gt")query=query.gt(filter.column,filter.value)
    else if(filter.op==="gte")query=query.gte(filter.column,filter.value)
    else if(filter.op==="lt")query=query.lt(filter.column,filter.value)
    else if(filter.op==="lte")query=query.lte(filter.column,filter.value)
    else if(filter.op==="is")query=query.is(filter.column,filter.value)
  }

  if(request.order&&typeof request.order==="object"){
    const order=request.order as Record<string,unknown>
    const column=String(order.column??"")
    if(!COLUMN.test(column))throw new Error("invalid_order")
    query=query.order(column,{ascending:order.ascending!==false})
  }
  if(limit!==undefined)query=query.limit(limit)
  if(resultMode==="single")query=query.single()
  if(resultMode==="maybeSingle")query=query.maybeSingle()

  const result=await query
  return {
    data:result.data??null,
    error:safeError(result.error),
    count:typeof result.count==="number"?result.count:null,
    status:typeof result.status==="number"?result.status:200,
    statusText:typeof result.statusText==="string"?result.statusText:"",
  }
}

const OPPORTUNITY_PARAMS=new Map([
  ["postedFrom","postedFrom"],["postedTo","postedTo"],["keyword","q"],["noticeType","ptype"],
  ["typeOfSetAside","typeOfSetAside"],["solicitationNumber","solnum"],["noticeId","noticeid"],
  ["title","title"],["state","state"],["zip","zip"],["naicsCode","ncode"],
  ["classificationCode","ccode"],["organizationName","organizationName"],
])
async function samSearch(body:Json){
  const key=samKey()
  if(!key)return {status:503,body:{ok:false,error:"SAM_GOV_KEY_NOT_CONFIGURED"}}
  const raw=body.params&&typeof body.params==="object"?body.params as Record<string,unknown>:{}
  const url=new URL("https://api.sam.gov/opportunities/v2/search")
  url.searchParams.set("api_key",key)
  const limit=Math.max(1,Math.min(Number(raw.limit??25)||25,1000))
  const offset=Math.max(0,Number(raw.offset??0)||0)
  url.searchParams.set("limit",String(limit))
  url.searchParams.set("offset",String(offset))
  for(const [name,target] of OPPORTUNITY_PARAMS){
    const value=raw[name]
    if(typeof value==="string"&&value.trim())url.searchParams.set(target,value.trim())
  }
  const response=await fetch(url,{headers:{accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(30_000)})
  const payload=await response.json().catch(()=>null)
  if(!response.ok)return {status:502,body:{ok:false,error:"SAM_GOV_REQUEST_FAILED",upstreamStatus:response.status}}
  return {status:200,body:{ok:true,data:payload}}
}

const ENTITY_PARAMS=new Set(["naicsCode","ueiSAM","page","size","registrationStatus","samRegistered","purposeOfRegistrationCode","includeSections","sensitivity"])
async function samEntities(body:Json){
  const key=samKey()
  if(!key)return {status:503,body:{ok:false,error:"SAM_GOV_KEY_NOT_CONFIGURED"}}
  const raw=body.params&&typeof body.params==="object"?body.params as Record<string,unknown>:{}
  const url=new URL("https://api.sam.gov/entity-information/v3/entities")
  url.searchParams.set("api_key",key)
  url.searchParams.set("registrationStatus","A")
  url.searchParams.set("samRegistered","Yes")
  url.searchParams.set("purposeOfRegistrationCode","Z2")
  url.searchParams.set("includeSections","entityRegistration,coreData,assertions")
  url.searchParams.set("sensitivity","public")
  for(const [name,value] of Object.entries(raw)){
    if(ENTITY_PARAMS.has(name)&&typeof value==="string"&&value.trim())url.searchParams.set(name,value.trim())
  }
  const response=await fetch(url,{headers:{accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(30_000)})
  const payload=await response.json().catch(()=>null)
  if(!response.ok)return {status:502,body:{ok:false,error:"SAM_ENTITY_REQUEST_FAILED",upstreamStatus:response.status}}
  return {status:200,body:{ok:true,data:payload}}
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return json(405,{ok:false,error:"method_not_allowed"})
  if(!(await authorizeGitHub(req)))return json(401,{ok:false,error:"unauthorized"})

  const url=Deno.env.get("SUPABASE_URL")
  const key=secretKey()
  if(!url||!key)return json(503,{ok:false,error:"supabase_admin_unavailable"})

  let body:Json
  try{body=await req.json() as Json}catch{return json(400,{ok:false,error:"invalid_json"})}
  const action=String(body.action??"")

  if(action==="health"){
    return json(200,{
      ok:true,
      serviceRoleConfigured:true,
      samKeyConfigured:Boolean(samKey()),
      contract:"SAM_RUNTIME_GATEWAY.v1",
    })
  }

  try{
    if(action==="db"){
      const request=body.request&&typeof body.request==="object"?body.request as DbRequest:{}
      return json(200,{ok:true,result:await dbAction(createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}}),request)})
    }
    if(action==="sam_search"){
      const result=await samSearch(body)
      return json(result.status,result.body)
    }
    if(action==="sam_entities"){
      const result=await samEntities(body)
      return json(result.status,result.body)
    }
    return json(400,{ok:false,error:"unsupported_action"})
  }catch(error){
    return json(502,{ok:false,error:"sam_runtime_gateway_failed",reason:error instanceof Error?error.message:"runtime_failed"})
  }
})
