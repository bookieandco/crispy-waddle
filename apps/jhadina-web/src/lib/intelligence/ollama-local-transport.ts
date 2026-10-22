import type { LocalInferenceTransport } from "@jhadina/intelligence-core"

/**
 * The Ollama daemon is NOT an Internet service. Production may contact only
 * an explicitly configured HTTPS hostname with a separate gateway token.
 * No credential, private prompt or screenshot may be sent to arbitrary URLs.
 * Never bind a daemon directly to the public Internet.
 */
export type LocalModelConnection = Readonly<{
 baseUrl:string
 model:string
 allowedHost?:string
 token?:string
 accessClientId?:string
 accessClientSecret?:string
 production?:boolean
}>
type FetchLike = typeof fetch

export function resolveLocalModelConnection(env?:{
 JHADINA_LOCAL_MODEL_URL?:string;JHADINA_LOCAL_MODEL_NAME?:string;
 JHADINA_LOCAL_MODEL_ALLOWED_HOST?:string;JHADINA_LOCAL_MODEL_GATEWAY_TOKEN?:string;
 JHADINA_LOCAL_MODEL_ACCESS_CLIENT_ID?:string;JHADINA_LOCAL_MODEL_ACCESS_CLIENT_SECRET?:string;
 NODE_ENV?:string;
}):LocalModelConnection|null{
 env=env??{
  JHADINA_LOCAL_MODEL_URL:process.env.JHADINA_LOCAL_MODEL_URL,
  JHADINA_LOCAL_MODEL_NAME:process.env.JHADINA_LOCAL_MODEL_NAME,
  JHADINA_LOCAL_MODEL_ALLOWED_HOST:process.env.JHADINA_LOCAL_MODEL_ALLOWED_HOST,
  JHADINA_LOCAL_MODEL_GATEWAY_TOKEN:process.env.JHADINA_LOCAL_MODEL_GATEWAY_TOKEN,
  JHADINA_LOCAL_MODEL_ACCESS_CLIENT_ID:process.env.JHADINA_LOCAL_MODEL_ACCESS_CLIENT_ID,
  JHADINA_LOCAL_MODEL_ACCESS_CLIENT_SECRET:process.env.JHADINA_LOCAL_MODEL_ACCESS_CLIENT_SECRET,
  NODE_ENV:process.env.NODE_ENV,
 }
 const baseUrl=env.JHADINA_LOCAL_MODEL_URL?.trim()
 const model=env.JHADINA_LOCAL_MODEL_NAME?.trim()
 if(!baseUrl || !model)return null
 return {baseUrl,model,allowedHost:env.JHADINA_LOCAL_MODEL_ALLOWED_HOST?.trim(),
   token:env.JHADINA_LOCAL_MODEL_GATEWAY_TOKEN?.trim(),
   accessClientId:env.JHADINA_LOCAL_MODEL_ACCESS_CLIENT_ID?.trim(),
   accessClientSecret:env.JHADINA_LOCAL_MODEL_ACCESS_CLIENT_SECRET?.trim(),
   production:env.NODE_ENV==="production"}
}

export function validateLocalModelEndpoint(connection:LocalModelConnection):URL {
 if(!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/.test(connection.model))throw Error("LOCAL_MODEL_NAME_INVALID")
 let target:URL
 try{target=new URL(connection.baseUrl)}catch{throw Error("LOCAL_MODEL_URL_INVALID")}
 if(target.username||target.password||target.hash||target.search || !["","/"].includes(target.pathname))throw Error("LOCAL_MODEL_URL_INVALID")
 const loopback=target.hostname==="localhost"||target.hostname==="127.0.0.1"||target.hostname==="[::1]"
 if(Boolean(connection.accessClientId)!==Boolean(connection.accessClientSecret))
  throw Error("LOCAL_MODEL_ACCESS_CREDENTIAL_PAIR_REQUIRED")
 if((connection.accessClientId||connection.accessClientSecret)&&
   (!connection.token||target.protocol!=="https:"))
  throw Error("LOCAL_MODEL_PRIVATE_GATEWAY_REQUIRED")
 if(connection.production){
  if(target.protocol!=="https:" || !connection.allowedHost || target.hostname!==connection.allowedHost || !connection.token)
   throw Error("LOCAL_MODEL_PRIVATE_GATEWAY_REQUIRED")
 }else if(!loopback && (target.protocol!=="https:" || !connection.allowedHost || target.hostname!==connection.allowedHost || !connection.token)){
  throw Error("LOCAL_MODEL_PRIVATE_GATEWAY_REQUIRED")
 }
 if(loopback && !connection.production && target.protocol!=="http:"&&target.protocol!=="https:")
  throw Error("LOCAL_MODEL_URL_INVALID")
 return new URL("/api/chat",target)
}

async function readBounded(response:Response,max=1_000_000):Promise<string>{
 if(!response.body)throw Error("LOCAL_MODEL_EMPTY_RESPONSE")
 const reader=response.body.getReader()
 const parts:Uint8Array[]=[]
 let size=0
 try{
  for(;;){
   const part=await reader.read()
   if(part.done)break
   if(part.value){size+=part.value.length;if(size>max)throw Error("LOCAL_MODEL_RESPONSE_TOO_LARGE");parts.push(part.value)}
  }
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 const all=new Uint8Array(size);let offset=0
 for(const p of parts){all.set(p,offset);offset+=p.length}
 return new TextDecoder().decode(all)
}

export function createOllamaLocalInferenceTransport(connection:LocalModelConnection,fetchImpl:FetchLike=fetch):LocalInferenceTransport{
 const endpoint=validateLocalModelEndpoint(connection)
 return {async generate(input){
  if(input.model!==connection.model)throw Error("LOCAL_MODEL_NOT_ALLOWLISTED")
  if(input.prompt.length>200_000)throw Error("LOCAL_MODEL_CONTEXT_TOO_LARGE")
  const response=await fetchImpl(endpoint.href,{
   method:"POST",redirect:"error",signal:AbortSignal.timeout(20_000),
   headers:{"content-type":"application/json",
    ...(connection.token?{authorization:"Bearer "+connection.token}:{}),
    ...(connection.accessClientId&&connection.accessClientSecret?{
      "CF-Access-Client-Id":connection.accessClientId,
      "CF-Access-Client-Secret":connection.accessClientSecret,
    }:{})},
   body:JSON.stringify({model:input.model,stream:false,format:"json",
      messages:[{role:"system",content:input.system},{role:"user",content:input.prompt}],
      options:{temperature:0.2,num_predict:Math.min(Math.max(input.maxOutputTokens,256),4096)}}),
  })
  if(!response.ok)throw Error("LOCAL_MODEL_UNAVAILABLE")
  const data=JSON.parse(await readBounded(response)) as {message?:{content?:unknown};prompt_eval_count?:unknown;eval_count?:unknown}
  const text=data.message?.content
  if(typeof text!=="string" || !text.trim())throw Error("LOCAL_MODEL_RESPONSE_INVALID")
  return {text,inputTokens:typeof data.prompt_eval_count==="number"?data.prompt_eval_count:undefined,
   outputTokens:typeof data.eval_count==="number"?data.eval_count:undefined}
 }}
}
