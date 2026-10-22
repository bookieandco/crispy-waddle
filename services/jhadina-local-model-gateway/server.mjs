import { createServer } from "node:http"
import { timingSafeEqual } from "node:crypto"
import { pathToFileURL } from "node:url"

const MAX_REQUEST_BYTES=260_000
const MAX_RESPONSE_BYTES=1_000_000
const LOOPBACK="127.0.0.1"

function cleanStatus(res,status,code){
 res.writeHead(status,{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"})
 res.end(JSON.stringify({success:false,error:code}))
}
function authorized(value,secret){
 if(typeof value!=="string"||!value.startsWith("Bearer "))return false
 const a=Buffer.from(value.slice(7)),b=Buffer.from(secret)
 return a.length===b.length&&timingSafeEqual(a,b)
}
function validateChat(input,model){
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("INVALID_REQUEST")
 const permitted=new Set(["model","messages","format","stream","options"])
 if(Object.keys(input).some(k=>!permitted.has(k)))throw Error("UNSUPPORTED_FIELD")
 if(input.model!==model||input.stream!==false||input.format!=="json")throw Error("MODEL_OR_MODE_INVALID")
 if(!Array.isArray(input.messages)||input.messages.length!==2)throw Error("MESSAGES_INVALID")
 const [system,user]=input.messages
 if(!system||!user||system.role!=="system"||user.role!=="user"||
  Object.keys(system).some(k=>!["role","content"].includes(k))||
  Object.keys(user).some(k=>!["role","content"].includes(k))||
  typeof system.content!=="string"||typeof user.content!=="string"||
  system.content.length>15_000||user.content.length>200_000)throw Error("MESSAGES_INVALID")
 if(!input.options||typeof input.options!=="object"||Array.isArray(input.options)||
    Object.keys(input.options).some(k=>!["temperature","num_predict"].includes(k))||
    typeof input.options.temperature!=="number"||!Number.isFinite(input.options.temperature)||
    input.options.temperature<0||input.options.temperature>1||
    !Number.isInteger(input.options.num_predict)||
    input.options.num_predict<1||input.options.num_predict>4096)throw Error("OPTIONS_INVALID")
 return {model,messages:[{role:"system",content:system.content},{role:"user",content:user.content}],
  format:"json",stream:false,options:{temperature:input.options.temperature,num_predict:input.options.num_predict}}
}
async function readRequest(req){
 const chunks=[];let size=0
 for await (const chunk of req){
  size+=chunk.length
  if(size>MAX_REQUEST_BYTES)throw Error("REQUEST_TOO_LARGE")
  chunks.push(chunk)
 }
 try{return JSON.parse(Buffer.concat(chunks).toString("utf8"))}catch{throw Error("INVALID_JSON")}
}
async function readResponse(response){
 if(!response.body)throw Error("UPSTREAM_EMPTY")
 const reader=response.body.getReader();const chunks=[];let size=0
 try{
  for(;;){
   const {done,value}=await reader.read()
   if(done)break
   size+=value.length
   if(size>MAX_RESPONSE_BYTES)throw Error("UPSTREAM_RESPONSE_TOO_LARGE")
   chunks.push(Buffer.from(value))
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 return Buffer.concat(chunks)
}
/** Hardened loopback-only adapter. Tunnel must terminate to 127.0.0.1:
 * NO direct public Ollama, no CORS, no model-selected tools or arbitrary URLs.
 */
export function createGateway({token,model,fetchImpl=fetch,now=Date.now,maxRequestsPerMinute=12}){
 if(typeof token!=="string"||Buffer.byteLength(token)<32)throw Error("GATEWAY_SECRET_REQUIRED")
 if(typeof model!=="string"||!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/.test(model)||
    /:cloud$/i.test(model))throw Error("LOCAL_MODEL_ONLY")
 let active=0,windowStarted=now(),count=0
 const server=createServer(async(req,res)=>{
  res.setHeader("access-control-allow-origin","null")
  if(!authorized(req.headers.authorization,token)){cleanStatus(res,401,"AUTH_REQUIRED");return}
  if(req.method==="GET"&&req.url==="/health"){
   res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"})
   res.end(JSON.stringify({status:"gateway_ready",model,localInferenceConfirmed:false}))
   return
  }
  if(req.method!=="POST"||req.url!=="/api/chat"){cleanStatus(res,404,"ROUTE_NOT_FOUND");return}
  if(!/^application\/json(?:\s*;|$)/i.test(String(req.headers["content-type"]??""))){
   cleanStatus(res,415,"CONTENT_TYPE_INVALID");return
  }
  if(Number(req.headers["content-length"]??0)>MAX_REQUEST_BYTES){
   cleanStatus(res,413,"REQUEST_TOO_LARGE");return
  }
  if(now()-windowStarted>=60_000){windowStarted=now();count=0}
  if(++count>maxRequestsPerMinute){cleanStatus(res,429,"RATE_LIMITED");return}
  if(active>=1){cleanStatus(res,429,"INFERENCE_BUSY");return}
  active++
  try{
   const input=validateChat(await readRequest(req),model)
   const reply=await fetchImpl("http://127.0.0.1:11434/api/chat",{
    method:"POST",redirect:"error",signal:AbortSignal.timeout(75_000),
    headers:{"content-type":"application/json"},body:JSON.stringify(input),
   })
   if(!reply.ok)throw Error("OLLAMA_UNAVAILABLE")
   const body=await readResponse(reply)
   const json=JSON.parse(body.toString("utf8"))
   if(!json?.message||typeof json.message.content!=="string")throw Error("OLLAMA_RESPONSE_INVALID")
   const safe={message:{role:"assistant",content:json.message.content},
     prompt_eval_count:typeof json.prompt_eval_count==="number"?json.prompt_eval_count:undefined,
     eval_count:typeof json.eval_count==="number"?json.eval_count:undefined}
   res.writeHead(200,{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"})
   res.end(JSON.stringify(safe))
  }catch(error){
   const code=error instanceof Error?error.message:"GATEWAY_ERROR"
   cleanStatus(res,code==="REQUEST_TOO_LARGE"?413:
     ["INVALID_JSON","INVALID_REQUEST","UNSUPPORTED_FIELD","MODEL_OR_MODE_INVALID","MESSAGES_INVALID","OPTIONS_INVALID"].includes(code)?400:503,
    code==="REQUEST_TOO_LARGE"?"REQUEST_TOO_LARGE":
     ["INVALID_JSON","INVALID_REQUEST","UNSUPPORTED_FIELD","MODEL_OR_MODE_INVALID","MESSAGES_INVALID","OPTIONS_INVALID"].includes(code)?"INVALID_INFERENCE_REQUEST":"LOCAL_INFERENCE_UNAVAILABLE")
  }finally{active--}
 })
 return server
}
export async function startGateway(options,port=8787){
 const server=createGateway(options)
 await new Promise((resolve,reject)=>{
  server.once("error",reject)
  server.listen(port,LOOPBACK,resolve)
 })
 return server
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const token=process.env.JHADINA_LOCAL_MODEL_GATEWAY_TOKEN
 const model=process.env.JHADINA_LOCAL_MODEL_NAME
 const port=Number(process.env.JHADINA_LOCAL_GATEWAY_PORT||8787)
 if(!Number.isInteger(port)||port<1024||port>65535){process.stderr.write("GATEWAY_PORT_INVALID\n");process.exitCode=1}
 else startGateway({token,model},port).then(()=>{
  process.stdout.write("Jhadina local model gateway listening on 127.0.0.1 (loopback only)\n")
 }).catch(()=>{process.stderr.write("GATEWAY_START_FAILED\n");process.exitCode=1})
}
