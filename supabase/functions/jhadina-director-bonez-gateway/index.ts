import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "npm:jose@5.10.0";

const ALLOWED_ISSUERS=new Set(["https://oidc.vercel.com/bookieandcos-projects","https://oidc.vercel.com"]);
const AUDIENCE="https://vercel.com/bookieandcos-projects";
const SUBJECT="owner:bookieandcos-projects:project:crispy-waddle-jhadina-web:environment:production";
const OWNER_ID="team_NYQJ3NwijZZ6UJQdOdc5FjmX";
const PROJECT_ID="prj_QK9bYgb8lwUvJgsYfJG6YLSzVPco";
const PROJECT_NAME="crispy-waddle-jhadina-web";
const OWNER="bookieandcos-projects";

const BONEZ_PROJECT_ID="director:bonez:production-quality:v1";
const BONEZ_CHARACTER_ID="bonez";
const BONEZ_REFERENCE_ASSET_ID="director-ref:bonez:canonical:v2";
const BONEZ_REFERENCE_SHA256="fb188ca50aa7a2278fee921c9e366d30ec3442e044e62a07f83d3ff78e5ba1f6";
const BONEZ_PRODUCT_REFERENCE_ASSET_ID="director-ref:bonez:product-print:v2";
const BONEZ_PRODUCT_REFERENCE_SHA256="fb188ca50aa7a2278fee921c9e366d30ec3442e044e62a07f83d3ff78e5ba1f6";
const BONEZ_REFERENCE_SOURCE_SHA256="fb188ca50aa7a2278fee921c9e366d30ec3442e044e62a07f83d3ff78e5ba1f6";
const BONEZ_RIGHTS_REF="model-generated-reference:bonez:v2:2026-09-29";
const CHAR_PREFIX="bonez_bootstrap_char_chunk_";
const PRODUCT_PREFIX="bonez_bootstrap_product_chunk_";
const VOICE_SOURCE_KEY="bonez_voice_candidate_source_url_v1";
const VOICE_TASK_ID="4c04699b-bbc2-4e40-8d8e-502d6a71d959";
const VOICE_ASSET_ID="asset:audio:bonez:voice-audition:v1";
const VOICE_OBJECT_PATH="bonez/voice-candidates/Bonez_voice_audition_v1.mp3";
const VOICE_RECEIPT_ID="voice-candidate:bonez:runway:"+VOICE_TASK_ID;
const VOICE_RECEIPT_SHA256="cc388b7d4d874dfc62c6e7aaa5193928d2473cbc036ade112603a1cfa25707cd";
const VOICE_REQUEST_TRANSCRIPT="[low, amused] You ever notice the dead got better stories than the living? [chuckles] Pull up a chair. I got time.";
const SPEAKER_QC_MODEL_ID="speechbrain/spkrec-ecapa-voxceleb";
const SPEAKER_QC_MODEL_REVISION="ff989f88e92ccc120569763824f8eedd5afc9039";
const SPEAKER_QC_SAMPLE_RATE_HZ=16000;
const SPEAKER_QC_QUANTIZATION="l2-int16-v1";
const SPEAKER_QC_URL_KEY="director_speaker_qc_url";
const SPEAKER_QC_TOKEN_KEY="director_speaker_qc_token";
const VOICE_IDENTITY_ID="voice:bonez:canonical:v1";
const VOICE_SAMPLE_ID="voice-sample:bonez:audition:v1";
const VOICE_BINDING_ID="voice-provider:bonez:runway:v1";
const VOICE_VARIANT_ID="voice-variant:bonez:en:v1";
const VOICE_APPROVAL_RECEIPT_ID="voice-approval:bonez:canonical:v1";
const BONEZ_VOICE_RUNTIME_URL_KEY="director_bonez_voice_runtime_url";
const BONEZ_VOICE_RUNTIME_TOKEN_KEY="director_bonez_voice_runtime_token";
const HUNYUAN_RUNTIME_URL_KEY="director_hunyuan_worker_url";
const HUNYUAN_RUNTIME_TOKEN_KEY="director_hunyuan_worker_token";

type Json=Record<string,unknown>;

function json(status:number,body:unknown):Response{
  return new Response(JSON.stringify(body),{status,headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    "referrer-policy":"no-referrer",
  }});
}

function secretKey():string|undefined{
  const modern=Deno.env.get("SUPABASE_SECRET_KEYS");
  if(modern){
    try{
      const parsed=JSON.parse(modern) as Record<string,string>;
      if(parsed.default) return parsed.default;
    }catch{}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??undefined;
}

async function authorizeVercel(req:Request):Promise<boolean>{
  const authorization=req.headers.get("authorization")??"";
  if(!authorization.startsWith("Bearer ")) return false;
  const token=authorization.slice(7).trim();
  if(!token) return false;
  let decoded:ReturnType<typeof decodeJwt>;
  try{decoded=decodeJwt(token);}catch{return false;}
  const issuer=typeof decoded.iss==="string"?decoded.iss:"";
  if(!ALLOWED_ISSUERS.has(issuer)) return false;
  try{
    const jwks=createRemoteJWKSet(new URL(issuer+"/.well-known/jwks"));
    const verified=await jwtVerify(token,jwks,{issuer,audience:AUDIENCE});
    const p=verified.payload as Record<string,unknown>;
    return p.sub===SUBJECT&&p.owner===OWNER&&p.owner_id===OWNER_ID&&
      p.project===PROJECT_NAME&&p.project_id===PROJECT_ID&&p.environment==="production";
  }catch{return false;}
}

async function sha256Text(value:string):Promise<string>{
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function sha256Bytes(value:Uint8Array):Promise<string>{
  const bytes=await crypto.subtle.digest("SHA-256",value);
  return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

function decodeBase64(value:string):Uint8Array{
  const raw=atob(value);
  const out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
  return out;
}

function base64Url(bytes:Uint8Array):string{
  let raw="";
  for(const byte of bytes) raw+=String.fromCharCode(byte);
  return btoa(raw).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}

function base64Bytes(bytes:Uint8Array):string{
  let raw="";
  const step=0x8000;
  for(let offset=0;offset<bytes.length;offset+=step){
    const chunk=bytes.subarray(offset,Math.min(bytes.length,offset+step));
    for(const byte of chunk) raw+=String.fromCharCode(byte);
  }
  return btoa(raw);
}

function jpegDimensions(bytes:Uint8Array):{width:number;height:number}{
  if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8) throw new Error("DIRECTOR_BONEZ_REFERENCE_JPEG_INVALID");
  const sof=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  let i=2;
  while(i+9<bytes.length){
    if(bytes[i]!==0xff){i+=1;continue;}
    while(i<bytes.length&&bytes[i]===0xff)i+=1;
    const marker=bytes[i++];
    if(marker===0xd8||marker===0xd9) continue;
    if(i+1>=bytes.length) break;
    const length=(bytes[i]<<8)|bytes[i+1];
    if(length<2||i+length>bytes.length) break;
    if(sof.has(marker)){
      const height=(bytes[i+3]<<8)|bytes[i+4];
      const width=(bytes[i+5]<<8)|bytes[i+6];
      if(!width||!height) break;
      return {width,height};
    }
    i+=length;
  }
  throw new Error("DIRECTOR_BONEZ_REFERENCE_DIMENSIONS_MISSING");
}

async function consumeToken(client:any,plain:string):Promise<string>{
  if(!plain) throw new Error("DIRECTOR_BONEZ_BOOTSTRAP_UNAUTHORIZED");
  const tokenHash=await sha256Text(plain);
  const now=new Date().toISOString();
  const result=await client.from("director_quality_bootstrap_tokens")
    .update({consumed_at:now})
    .eq("token_hash",tokenHash).is("consumed_at",null).gt("expires_at",now)
    .select("user_id").maybeSingle();
  if(result.error) throw result.error;
  if(!result.data?.user_id) throw new Error("DIRECTOR_BONEZ_BOOTSTRAP_UNAUTHORIZED");
  return String(result.data.user_id);
}

async function readChunks(client:any,prefix:string):Promise<Uint8Array>{
  const result=await client.from("director_runtime_config").select("key,value").like("key",prefix+"%").order("key",{ascending:true});
  if(result.error) throw result.error;
  const rows=(result.data??[]) as Array<{key:string;value:string}>;
  if(!rows.length) throw new Error("DIRECTOR_BONEZ_REFERENCE_CHUNKS_MISSING");
  const bytes=decodeBase64(rows.map(r=>r.value).join(""));
  if(!bytes.length) throw new Error("DIRECTOR_BONEZ_REFERENCE_BYTES_EMPTY");
  return bytes;
}

async function uploadReference(client:any,input:{
  userId:string;assetId:string;bytes:Uint8Array;expectedSha:string;
  kind:"character"|"product";objectPath:string;filename:string;viewHint:string;
}){
  const actual=await sha256Bytes(input.bytes);
  if(actual!==input.expectedSha) throw new Error("DIRECTOR_BONEZ_REFERENCE_SHA_MISMATCH:"+input.kind);
  const dimensions=jpegDimensions(input.bytes);
  const upload=await client.storage.from("director-character-references")
    .upload(input.objectPath,input.bytes,{contentType:"image/jpeg",upsert:true});
  if(upload.error) throw upload.error;
  const evidence=[
    "source:model-generated-bonez-canonical-v2",
    "reference-source-sha256:"+BONEZ_REFERENCE_SOURCE_SHA256,
    "source-format:image-jpeg",
    "signature:image-jpeg",
    "dimensions:"+dimensions.width+"x"+dimensions.height,
    "sha256:"+actual,
    "vision-review:fictional-horror-reference",
  ];
  const row=await client.from("director_reference_media_assets").upsert({
    id:input.assetId,project_id:BONEZ_PROJECT_ID,user_id:input.userId,
    bucket_id:"director-character-references",object_path:input.objectPath,original_filename:input.filename,
    mime_type:"image/jpeg",byte_size:input.bytes.byteLength,width:dimensions.width,height:dimensions.height,
    sha256:actual,view_hint:input.viewHint,rights_ref:BONEZ_RIGHTS_REF,consent_ref:null,
    admission_status:"admitted",scan_status:"clean",scan_evidence_ids:evidence,rejection_reason:null,
    reference_kind:input.kind,admitted_at:new Date().toISOString(),updated_at:new Date().toISOString(),
  },{onConflict:"id"});
  if(row.error) throw row.error;
  return {assetId:input.assetId,sha256:actual,width:dimensions.width,height:dimensions.height,evidence};
}

function requireCanonical(body:any){
  const c=body?.canonical;
  if(!c||c.projectId!==BONEZ_PROJECT_ID||c.characterId!==BONEZ_CHARACTER_ID) throw new Error("DIRECTOR_BONEZ_CANONICAL_PAYLOAD_INVALID");
  if(c.rightsRef!==BONEZ_RIGHTS_REF||c.referenceSourceSha256!==BONEZ_REFERENCE_SOURCE_SHA256) throw new Error("DIRECTOR_BONEZ_CANONICAL_PAYLOAD_INVALID");
  if(c.references?.character?.assetId!==BONEZ_REFERENCE_ASSET_ID||c.references?.character?.expectedSha!==BONEZ_REFERENCE_SHA256) throw new Error("DIRECTOR_BONEZ_CHARACTER_REFERENCE_AUTHORITY_MISMATCH");
  if(c.references?.product?.assetId!==BONEZ_PRODUCT_REFERENCE_ASSET_ID||c.references?.product?.expectedSha!==BONEZ_PRODUCT_REFERENCE_SHA256) throw new Error("DIRECTOR_BONEZ_PRODUCT_REFERENCE_AUTHORITY_MISMATCH");
  if(c.cast?.id!=="cast:bonez:v1"||c.cast?.characterId!==BONEZ_CHARACTER_ID||c.cast?.projectId!==BONEZ_PROJECT_ID) throw new Error("DIRECTOR_BONEZ_CAST_AUTHORITY_MISMATCH");
  if(!Array.isArray(c.packages)||!Array.isArray(c.directives)||!c.world||!c.productBible) throw new Error("DIRECTOR_BONEZ_CANONICAL_PAYLOAD_INCOMPLETE");
  return c;
}

async function cleanupChunks(client:any){
  const result=await client.from("director_runtime_config").delete()
    .or("key.like."+CHAR_PREFIX+"%,key.like."+PRODUCT_PREFIX+"%");
  if(result.error) throw result.error;
}

async function writeChunks(client:any,prefix:string,bytes:Uint8Array){
  const encoded=base64Url(bytes).replaceAll("-","+").replaceAll("_","/");
  const padded=encoded+"=".repeat((4-(encoded.length%4))%4);
  const chunkSize=32000;
  const rows=[];
  for(let offset=0,index=0;offset<padded.length;offset+=chunkSize,index++){
    rows.push({
      key:prefix+String(index).padStart(4,"0"),
      value:padded.slice(offset,offset+chunkSize),
      sensitive:true,
      updated_at:new Date().toISOString(),
    });
  }
  if(!rows.length) throw new Error("DIRECTOR_BONEZ_REFERENCE_BYTES_EMPTY");
  const result=await client.from("director_runtime_config").upsert(rows,{onConflict:"key"});
  if(result.error) throw result.error;
  return rows.length;
}

async function stageReferences(client:any,body:any,authenticatedUserId?:string){
  const requestedUserId=String(body?.userId??"").trim();
  if(authenticatedUserId&&requestedUserId&&requestedUserId!==authenticatedUserId){
    throw new Error("DIRECTOR_BONEZ_STAGE_USER_MISMATCH");
  }
  const userId=authenticatedUserId||requestedUserId;
  if(!userId) throw new Error("DIRECTOR_BONEZ_STAGE_USER_REQUIRED");
  const userLookup=await client.auth.admin.getUserById(userId);
  if(userLookup.error||!userLookup.data?.user) throw new Error("DIRECTOR_BONEZ_STAGE_USER_INVALID");

  const characterBytes=decodeBase64(String(body?.characterBase64??""));
  const productBytes=decodeBase64(String(body?.productBase64??""));
  if(await sha256Bytes(characterBytes)!==BONEZ_REFERENCE_SHA256) throw new Error("DIRECTOR_BONEZ_REFERENCE_SHA_MISMATCH:character");
  if(await sha256Bytes(productBytes)!==BONEZ_PRODUCT_REFERENCE_SHA256) throw new Error("DIRECTOR_BONEZ_REFERENCE_SHA_MISMATCH:product");
  jpegDimensions(characterBytes);
  jpegDimensions(productBytes);

  await cleanupChunks(client);
  const [characterChunks,productChunks]=await Promise.all([
    writeChunks(client,CHAR_PREFIX,characterBytes),
    writeChunks(client,PRODUCT_PREFIX,productBytes),
  ]);

  const expired=await client.from("director_quality_bootstrap_tokens")
    .delete().eq("user_id",userId).is("consumed_at",null);
  if(expired.error) throw expired.error;

  const tokenBytes=new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token=base64Url(tokenBytes);
  const tokenHash=await sha256Text(token);
  const expiresAt=new Date(Date.now()+15*60*1000).toISOString();
  const tokenWrite=await client.from("director_quality_bootstrap_tokens").insert({
    token_hash:tokenHash,user_id:userId,expires_at:expiresAt,
  });
  if(tokenWrite.error) throw tokenWrite.error;

  return {
    ok:true,
    phase:"DIRECTOR-QUALITY.2-STAGED",
    token,
    expiresAt,
    character:{sha256:BONEZ_REFERENCE_SHA256,byteSize:characterBytes.byteLength,chunks:characterChunks},
    product:{sha256:BONEZ_PRODUCT_REFERENCE_SHA256,byteSize:productBytes.byteLength,chunks:productChunks},
  };
}

async function recordVoiceCandidate(client:any){
  const config=await client.from("director_runtime_config").select("value").eq("key",VOICE_SOURCE_KEY).maybeSingle();
  if(config.error) throw config.error;
  const sourceUrl=String(config.data?.value??"").trim();
  if(!sourceUrl) throw new Error("DIRECTOR_BONEZ_VOICE_SOURCE_MISSING");
  const parsed=new URL(sourceUrl);
  if(parsed.protocol!=="https:"||parsed.hostname!=="dnznrvs05pmza.cloudfront.net"||
     !parsed.pathname.endsWith("/Bonez_voice_audition_v1.mp3")){
    throw new Error("DIRECTOR_BONEZ_VOICE_SOURCE_INVALID");
  }

  const response=await fetch(sourceUrl,{redirect:"follow"});
  if(!response.ok) throw new Error("DIRECTOR_BONEZ_VOICE_FETCH_FAILED:"+response.status);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(!bytes.length) throw new Error("DIRECTOR_BONEZ_VOICE_BYTES_EMPTY");
  const sha256=await sha256Bytes(bytes);

  const upload=await client.storage.from("director-media")
    .upload(VOICE_OBJECT_PATH,bytes,{contentType:"audio/mpeg",upsert:true,cacheControl:"0"});
  if(upload.error) throw upload.error;

  const asset=await client.from("director_generated_editing_assets").upsert({
    id:VOICE_ASSET_ID,
    project_id:BONEZ_PROJECT_ID,
    generation_job_id:VOICE_TASK_ID,
    provider_id:"runway-speech",
    media_type:"audio",
    uri:"storage://director-media/"+VOICE_OBJECT_PATH,
    mime_type:"audio/mpeg",
    sha256,
    model_id:"eleven_v3",
    workflow_id:null,
    workflow_version:null,
    loras:[],
    prompt:"Bonez voice audition v1",
    metadata:{
      candidate:true,
      canonical:false,
      approved:false,
      characterId:BONEZ_CHARACTER_ID,
      durationSeconds:9.04,
      voicePreset:"Grungle",
      sourceTaskId:VOICE_TASK_ID,
      sourceKind:"synthetic-preset-audition",
      qualityClaim:false,
      transcript:"You ever notice the dead got better stories than the living? Pull up a chair. I got time.",
    },
    approval_policy:"studio_qc",
  },{onConflict:"id"}).select("id,project_id,media_type,uri,mime_type,sha256,provider_id,model_id,approval_policy,metadata").single();
  if(asset.error) throw asset.error;

  const receipt=await client.from("director_voice_candidate_receipts").upsert({
    id:VOICE_RECEIPT_ID,
    project_id:BONEZ_PROJECT_ID,
    character_id:BONEZ_CHARACTER_ID,
    provider:"runway",
    provider_task_id:VOICE_TASK_ID,
    model_id:"eleven_v3",
    provider_voice_ref:"Grungle",
    primary_language:"en",
    speed:0.88,
    duration_seconds:9.04,
    prompt_label:"Bonez voice audition v1",
    transcript:VOICE_REQUEST_TRANSCRIPT,
    receipt_sha256:VOICE_RECEIPT_SHA256,
    artifact_sha256:sha256,
    approval_state:"candidate_unapproved",
    artifact_hash_status:"verified",
    provenance_refs:[
      "runway-task:"+VOICE_TASK_ID,
      "storage:director-media/"+VOICE_OBJECT_PATH,
      "non-cloned-preset-audition",
      "not-canonical",
      "artifact-sha256:"+sha256,
    ],
    updated_at:new Date().toISOString(),
  },{onConflict:"provider,provider_task_id"});
  if(receipt.error) throw receipt.error;

  const cleanup=await client.from("director_runtime_config").delete().eq("key",VOICE_SOURCE_KEY);
  if(cleanup.error) throw cleanup.error;

  return {
    ok:true,
    phase:"DIRECTOR-QUALITY.3-VOICE-CANDIDATE",
    asset:asset.data,
    candidateReceipt:{
      id:VOICE_RECEIPT_ID,
      receiptSha256:VOICE_RECEIPT_SHA256,
      artifactSha256:sha256,
      artifactHashStatus:"verified",
      approvalState:"candidate_unapproved",
    },
    approved:false,
  };
}

async function hunyuanRuntimeConfig(client:any):Promise<{baseUrl:string;token?:string}|null>{
  const result=await client.from("director_runtime_config")
    .select("key,value")
    .in("key",[HUNYUAN_RUNTIME_URL_KEY,HUNYUAN_RUNTIME_TOKEN_KEY]);
  if(result.error) throw result.error;
  const values=new Map<string,string>((result.data??[]).map((row:any)=>[String(row.key),String(row.value??"")]));
  const rawUrl=(values.get(HUNYUAN_RUNTIME_URL_KEY)??"").trim();
  const token=(values.get(HUNYUAN_RUNTIME_TOKEN_KEY)??"").trim();
  if(!rawUrl) return null;
  const parsed=new URL(rawUrl);
  if(parsed.protocol!=="https:"||!parsed.hostname.endsWith(".proxy.runpod.net")||parsed.username||parsed.password){
    throw new Error("DIRECTOR_HUNYUAN_RUNTIME_URL_NOT_ADMITTED");
  }
  parsed.pathname=parsed.pathname.replace(/\/+$/,"");
  parsed.search="";
  parsed.hash="";
  return {
    baseUrl:parsed.toString().replace(/\/$/,""),
    ...(token?{token}:{}),
  };
}

async function hunyuanRuntimeBinding(client:any){
  const config=await hunyuanRuntimeConfig(client);
  if(!config){
    return {
      ok:true,
      configured:false,
      baseUrl:null,
      staticTokenConfigured:false,
      authority:"DIRECTOR_HUNYUAN_RUNTIME_BINDING_URL_ONLY",
    };
  }
  return {
    ok:true,
    configured:true,
    baseUrl:config.baseUrl,
    staticTokenConfigured:Boolean(config.token),
    authority:"DIRECTOR_HUNYUAN_RUNTIME_BINDING_URL_ONLY",
  };
}

async function hunyuanRuntimeStatus(client:any){
  let config:{baseUrl:string;token?:string}|null;
  try{config=await hunyuanRuntimeConfig(client);}
  catch{return {configured:true,productionReady:false,status:"invalid-config"};}
  if(!config) return {configured:false,productionReady:false,status:"not-configured"};
  try{
    const response=await fetch(config.baseUrl+"/health",{
      signal:AbortSignal.timeout(15_000),
      redirect:"error",
    });
    const health=await response.json().catch(()=>({})) as Record<string,unknown>;
    const productionReady=response.ok&&health.status==="ready"&&health.productionReady===true;
    return {
      configured:true,
      productionReady,
      status:productionReady?"ready":String(health.status??(response.ok?"blocked":"unavailable")),
      minimumGpuMemoryMb:health.minimumGpuMemoryMb??null,
      checkpointTreeReady:health.checkpointTreeReady??null,
      licenseAcknowledged:health.licenseAcknowledged??null,
      territoryAcknowledged:health.territoryAcknowledged??null,
      reasons:Array.isArray(health.reasons)?health.reasons.map(String):[],
    };
  }catch{
    return {configured:true,productionReady:false,status:"unavailable"};
  }
}

async function bonezVoiceRuntimeStatus(client:any){
  const result=await client.from("director_runtime_config")
    .select("key,value")
    .in("key",[BONEZ_VOICE_RUNTIME_URL_KEY,BONEZ_VOICE_RUNTIME_TOKEN_KEY]);
  if(result.error) throw result.error;
  const values=new Map<string,string>((result.data??[]).map((row:any)=>[String(row.key),String(row.value??"")]));
  const rawUrl=(values.get(BONEZ_VOICE_RUNTIME_URL_KEY)??"").trim();
  const token=(values.get(BONEZ_VOICE_RUNTIME_TOKEN_KEY)??"").trim();
  if(!rawUrl||!token) return {configured:false,productionReady:false,status:"not-configured"};
  try{
    const parsed=new URL(rawUrl);
    const allowedHost=parsed.hostname.endsWith(".up.railway.app")||parsed.hostname.endsWith(".proxy.runpod.net");
    if(parsed.protocol!=="https:"||!allowedHost||parsed.username||parsed.password){
      return {configured:true,productionReady:false,status:"invalid-config"};
    }
    parsed.pathname=parsed.pathname.replace(/\/+$/,"");
    parsed.search="";
    parsed.hash="";
    const response=await fetch(parsed.toString().replace(/\/$/,"")+"/health",{
      headers:{authorization:"Bearer "+token},
      signal:AbortSignal.timeout(15_000),
      redirect:"error",
    });
    const health=await response.json().catch(()=>({})) as Record<string,unknown>;
    const productionReady=response.ok&&health.status==="ready"&&health.productionReady===true
      &&health.provider==="runway-speech"&&health.modelId==="eleven_v3"&&health.providerVoiceRef==="Grungle";
    return {
      configured:true,
      productionReady,
      status:productionReady?"ready":String(health.status??(response.ok?"blocked":"unavailable")),
      provider:health.provider??null,
      modelId:health.modelId??null,
      providerVoiceRef:health.providerVoiceRef??null,
    };
  }catch{
    return {configured:true,productionReady:false,status:"unavailable"};
  }
}

async function speakerQcRuntimeConfig(client:any):Promise<{baseUrl:string;token:string}|null>{
  const result=await client.from("director_runtime_config")
    .select("key,value")
    .in("key",[SPEAKER_QC_URL_KEY,SPEAKER_QC_TOKEN_KEY]);
  if(result.error) throw result.error;
  const values=new Map<string,string>((result.data??[]).map((row:any)=>[String(row.key),String(row.value??"")]));
  const rawUrl=(values.get(SPEAKER_QC_URL_KEY)??"").trim();
  const token=(values.get(SPEAKER_QC_TOKEN_KEY)??"").trim();
  if(!rawUrl||!token) return null;
  const parsed=new URL(rawUrl);
  const allowedHost=parsed.hostname.endsWith(".up.railway.app")||parsed.hostname.endsWith(".proxy.runpod.net");
  if(parsed.protocol!=="https:"||!allowedHost||parsed.username||parsed.password){
    throw new Error("DIRECTOR_SPEAKER_QC_RUNTIME_URL_NOT_ADMITTED");
  }
  parsed.pathname=parsed.pathname.replace(/\/+$/,"");
  parsed.search="";
  parsed.hash="";
  return {baseUrl:parsed.toString().replace(/\/$/,""),token};
}

async function speakerQcRuntimeStatus(client:any){
  let config:{baseUrl:string;token:string}|null;
  try{
    config=await speakerQcRuntimeConfig(client);
  }catch(cause){
    return {
      configured:true,
      productionReady:false,
      status:"invalid-config",
      error:cause instanceof Error?cause.message:"DIRECTOR_SPEAKER_QC_RUNTIME_CONFIG_INVALID",
    };
  }
  if(!config) return {configured:false,productionReady:false,status:"not-configured"};
  try{
    const response=await fetch(config.baseUrl+"/health",{
      signal:AbortSignal.timeout(15_000),
      redirect:"error",
    });
    const health=await response.json().catch(()=>({})) as Record<string,unknown>;
    const productionReady=response.ok&&health.status==="ready"&&health.productionReady===true;
    return {
      configured:true,
      productionReady,
      status:productionReady?"ready":String(health.status??(response.ok?"blocked":"unavailable")),
      health:{
        status:health.status??null,
        productionReady:health.productionReady===true,
        modelId:health.modelId??null,
        modelRevision:health.modelRevision??null,
        modelReady:health.modelReady??null,
        sampleRateHz:health.sampleRateHz??null,
        quantization:health.quantization??null,
        reasons:Array.isArray(health.reasons)?health.reasons.map(String):[],
      },
    };
  }catch(cause){
    return {
      configured:true,
      productionReady:false,
      status:"unavailable",
      error:cause instanceof Error?cause.message:"DIRECTOR_SPEAKER_QC_HEALTH_FAILED",
    };
  }
}

async function speakerFingerprintSource(client:any){
  const asset=await client.from("director_generated_editing_assets")
    .select("id,sha256,mime_type,uri,metadata")
    .eq("id",VOICE_ASSET_ID)
    .maybeSingle();
  if(asset.error) throw asset.error;
  const row=asset.data as any;
  if(!row) throw new Error("DIRECTOR_BONEZ_VOICE_CANDIDATE_MISSING");
  const metadata=row.metadata??{};
  if(metadata.candidate!==true||metadata.canonical!==false||metadata.approved!==false){
    throw new Error("DIRECTOR_BONEZ_VOICE_CANDIDATE_NOT_ADMITTED");
  }
  const expectedSha=String(row.sha256??"");
  if(!/^[a-f0-9]{64}$/i.test(expectedSha)) throw new Error("DIRECTOR_BONEZ_VOICE_CANDIDATE_HASH_INVALID");
  const downloaded=await client.storage.from("director-media").download(VOICE_OBJECT_PATH);
  if(downloaded.error) throw downloaded.error;
  const bytes=new Uint8Array(await downloaded.data.arrayBuffer());
  if(!bytes.length) throw new Error("DIRECTOR_BONEZ_VOICE_BYTES_EMPTY");
  const actualSha=await sha256Bytes(bytes);
  if(actualSha!==expectedSha) throw new Error("DIRECTOR_BONEZ_VOICE_STORAGE_HASH_MISMATCH");
  return {
    ok:true,
    phase:"DIRECTOR-QUALITY.3-SPEAKER-QC-SOURCE",
    sourceAssetId:VOICE_ASSET_ID,
    sourceSha256:actualSha,
    mimeType:String(row.mime_type??"audio/mpeg"),
    audioBase64:base64Bytes(bytes),
    candidate:true,
    canonical:false,
    approved:false,
  };
}

async function recordSpeakerFingerprintReceipt(client:any,body:any){
  const receipt=body?.receipt;
  if(!receipt||typeof receipt!=="object") throw new Error("DIRECTOR_SPEAKER_QC_RECEIPT_REQUIRED");

  const asset=await client.from("director_generated_editing_assets")
    .select("id,sha256,metadata")
    .eq("id",VOICE_ASSET_ID)
    .maybeSingle();
  if(asset.error) throw asset.error;
  const row=asset.data as any;
  if(!row) throw new Error("DIRECTOR_BONEZ_VOICE_CANDIDATE_MISSING");
  const assetSha=String(row.sha256??"");
  const metadata=row.metadata??{};
  if(metadata.candidate!==true||metadata.canonical!==false||metadata.approved!==false){
    throw new Error("DIRECTOR_BONEZ_VOICE_CANDIDATE_NOT_ADMITTED");
  }

  const sourceSha=String(receipt.sourceSha256??"");
  const normalizedSha=String(receipt.normalizedAudioSha256??"");
  const embeddingSha=String(receipt.embeddingSha256??"");
  const fingerprintRef=String(receipt.fingerprintRef??"");
  const dimensions=Number(receipt.embeddingDimensions);
  const duration=Number(receipt.durationSeconds);
  if(String(receipt.sourceAssetId??"")!==VOICE_ASSET_ID) throw new Error("DIRECTOR_SPEAKER_QC_SOURCE_ASSET_MISMATCH");
  if(sourceSha!==assetSha) throw new Error("DIRECTOR_SPEAKER_QC_SOURCE_HASH_MISMATCH");
  if(String(receipt.modelId??"")!==SPEAKER_QC_MODEL_ID) throw new Error("DIRECTOR_SPEAKER_QC_MODEL_ID_MISMATCH");
  if(String(receipt.modelRevision??"")!==SPEAKER_QC_MODEL_REVISION) throw new Error("DIRECTOR_SPEAKER_QC_MODEL_REVISION_MISMATCH");
  if(String(receipt.quantization??"")!==SPEAKER_QC_QUANTIZATION) throw new Error("DIRECTOR_SPEAKER_QC_QUANTIZATION_MISMATCH");
  if(Number(receipt.sampleRateHz)!==SPEAKER_QC_SAMPLE_RATE_HZ) throw new Error("DIRECTOR_SPEAKER_QC_SAMPLE_RATE_MISMATCH");
  if(receipt.qualityClaim!==false) throw new Error("DIRECTOR_SPEAKER_QC_QUALITY_CLAIM_FORBIDDEN");
  if(!/^[a-f0-9]{64}$/i.test(normalizedSha)||!/^[a-f0-9]{64}$/i.test(embeddingSha)){
    throw new Error("DIRECTOR_SPEAKER_QC_HASH_INVALID");
  }
  if(!Number.isInteger(dimensions)||dimensions<=0||!Number.isFinite(duration)||duration<=0){
    throw new Error("DIRECTOR_SPEAKER_QC_RECEIPT_INVALID");
  }
  const expectedPrefix="speaker-embedding:ecapa-voxceleb:"+SPEAKER_QC_MODEL_REVISION.slice(0,12)+":sha256:";
  if(fingerprintRef!==expectedPrefix+embeddingSha){
    throw new Error("DIRECTOR_SPEAKER_QC_FINGERPRINT_REF_INVALID");
  }

  const id="speaker-fingerprint:bonez:ecapa:"+SPEAKER_QC_MODEL_REVISION.slice(0,12)+":"+embeddingSha.slice(0,16);
  const written=await client.from("director_speaker_fingerprint_receipts").upsert({
    id,
    project_id:BONEZ_PROJECT_ID,
    character_id:BONEZ_CHARACTER_ID,
    source_asset_id:VOICE_ASSET_ID,
    source_sha256:sourceSha,
    normalized_audio_sha256:normalizedSha,
    model_id:SPEAKER_QC_MODEL_ID,
    model_revision:SPEAKER_QC_MODEL_REVISION,
    embedding_dimensions:dimensions,
    embedding_sha256:embeddingSha,
    fingerprint_ref:fingerprintRef,
    quantization:SPEAKER_QC_QUANTIZATION,
    sample_rate_hz:SPEAKER_QC_SAMPLE_RATE_HZ,
    duration_seconds:duration,
    quality_claim:false,
    evidence_ids:[
      VOICE_RECEIPT_ID,
      VOICE_ASSET_ID,
      "source-sha256:"+sourceSha,
      "embedding-sha256:"+embeddingSha,
    ],
  },{onConflict:"project_id,character_id,source_sha256,model_id,model_revision"})
    .select("id,source_asset_id,source_sha256,model_id,model_revision,embedding_dimensions,embedding_sha256,fingerprint_ref,quantization,sample_rate_hz,duration_seconds,quality_claim,created_at")
    .single();
  if(written.error) throw written.error;

  return {
    ok:true,
    phase:"DIRECTOR-QUALITY.3-SPEAKER-FINGERPRINT",
    receipt:{
      id:String(written.data.id),
      sourceAssetId:String(written.data.source_asset_id),
      sourceSha256:String(written.data.source_sha256),
      modelId:String(written.data.model_id),
      modelRevision:String(written.data.model_revision),
      embeddingDimensions:Number(written.data.embedding_dimensions),
      embeddingSha256:String(written.data.embedding_sha256),
      fingerprintRef:String(written.data.fingerprint_ref),
      quantization:String(written.data.quantization),
      sampleRateHz:Number(written.data.sample_rate_hz),
      durationSeconds:Number(written.data.duration_seconds),
      qualityClaim:Boolean(written.data.quality_claim),
      createdAt:String(written.data.created_at),
    },
    approved:false,
  };
}

async function runSpeakerFingerprint(client:any){
  const config=await speakerQcRuntimeConfig(client);
  if(!config) throw new Error("DIRECTOR_SPEAKER_QC_RUNTIME_NOT_CONFIGURED");
  const runtime=await speakerQcRuntimeStatus(client);
  if(runtime.productionReady!==true) throw new Error("DIRECTOR_SPEAKER_QC_RUNTIME_NOT_READY");

  const source=await speakerFingerprintSource(client);
  const response=await fetch(config.baseUrl+"/v1/fingerprint",{
    method:"POST",
    headers:{
      authorization:"Bearer "+config.token,
      "content-type":"application/json",
    },
    body:JSON.stringify({
      mimeType:source.mimeType,
      audioBase64:source.audioBase64,
      expectedSourceSha256:source.sourceSha256,
    }),
    signal:AbortSignal.timeout(120_000),
    redirect:"error",
  });
  const fingerprint=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok){
    throw new Error("DIRECTOR_SPEAKER_QC_FINGERPRINT_FAILED:"+response.status);
  }
  if(String(fingerprint.sourceSha256??"")!==source.sourceSha256){
    throw new Error("DIRECTOR_SPEAKER_QC_SOURCE_HASH_MISMATCH");
  }
  const persisted=await recordSpeakerFingerprintReceipt(client,{
    receipt:{sourceAssetId:VOICE_ASSET_ID,...fingerprint},
  });
  return {
    ...persisted,
    runtime,
    authority:"DIRECTOR_SPEAKER_QC_EVIDENCE_ONLY",
    canonicalVoiceIdentityCreated:false,
  };
}

async function approveBonezVoiceIdentity(client:any,body:any,userId:string|undefined){
  if(!userId) throw new Error("DIRECTOR_BONEZ_VOICE_APPROVER_REQUIRED");
  if(body?.approve!==true) throw new Error("DIRECTOR_BONEZ_VOICE_EXPLICIT_APPROVAL_REQUIRED");

  const expectedCandidateSha=String(body?.expectedCandidateSha256??"").trim().toLowerCase();
  const expectedFingerprintRef=String(body?.expectedFingerprintRef??"").trim();
  const minimumSimilarity=Number(body?.minimumSpeakerSimilarity);
  if(!/^[a-f0-9]{64}$/.test(expectedCandidateSha)) throw new Error("DIRECTOR_BONEZ_VOICE_EXPECTED_SHA_REQUIRED");
  if(!expectedFingerprintRef.startsWith("speaker-embedding:ecapa-voxceleb:")) throw new Error("DIRECTOR_BONEZ_VOICE_EXPECTED_FINGERPRINT_REQUIRED");
  if(!Number.isFinite(minimumSimilarity)||minimumSimilarity<=0||minimumSimilarity>1){
    throw new Error("DIRECTOR_BONEZ_VOICE_SIMILARITY_FLOOR_INVALID");
  }

  const [membership,cast,candidate,candidateReceipt,fingerprint]=await Promise.all([
    client.from("director_project_memberships")
      .select("role").eq("project_id",BONEZ_PROJECT_ID).eq("user_id",userId).maybeSingle(),
    client.from("director_cast_characters")
      .select("id,character_id").eq("project_id",BONEZ_PROJECT_ID).eq("character_id",BONEZ_CHARACTER_ID).maybeSingle(),
    client.from("director_generated_editing_assets")
      .select("id,sha256,provider_id,model_id,metadata")
      .eq("id",VOICE_ASSET_ID).maybeSingle(),
    client.from("director_voice_candidate_receipts")
      .select("id,artifact_sha256,approval_state,artifact_hash_status")
      .eq("id",VOICE_RECEIPT_ID).maybeSingle(),
    client.from("director_speaker_fingerprint_receipts")
      .select("id,source_asset_id,source_sha256,fingerprint_ref,model_id,model_revision,quality_claim")
      .eq("project_id",BONEZ_PROJECT_ID)
      .eq("character_id",BONEZ_CHARACTER_ID)
      .eq("source_asset_id",VOICE_ASSET_ID)
      .eq("source_sha256",expectedCandidateSha)
      .eq("fingerprint_ref",expectedFingerprintRef)
      .maybeSingle(),
  ]);
  for(const result of [membership,cast,candidate,candidateReceipt,fingerprint]){
    if(result.error) throw result.error;
  }
  const role=String((membership.data as any)?.role??"");
  if(role!=="owner"&&role!=="editor") throw new Error("DIRECTOR_BONEZ_VOICE_APPROVAL_AUTHORITY_REQUIRED");
  if(!cast.data) throw new Error("DIRECTOR_QUALITY_2_REQUIRED");

  const candidateRow=candidate.data as any;
  const receiptRow=candidateReceipt.data as any;
  const fingerprintRow=fingerprint.data as any;
  if(!candidateRow||!receiptRow) throw new Error("DIRECTOR_BONEZ_VOICE_CANDIDATE_MISSING");
  const metadata=candidateRow.metadata??{};
  const actualCandidateSha=String(candidateRow.sha256??"").toLowerCase();
  if(
    candidateRow.id!==VOICE_ASSET_ID||
    actualCandidateSha!==expectedCandidateSha||
    metadata.candidate!==true||
    metadata.canonical!==false||
    metadata.approved!==false
  ) throw new Error("DIRECTOR_BONEZ_VOICE_CANDIDATE_MISMATCH");
  if(
    String(receiptRow.artifact_sha256??"").toLowerCase()!==actualCandidateSha||
    receiptRow.artifact_hash_status!=="verified"||
    !["candidate_unapproved","approved"].includes(String(receiptRow.approval_state??""))
  ) throw new Error("DIRECTOR_BONEZ_VOICE_CANDIDATE_RECEIPT_INVALID");
  if(
    !fingerprintRow||
    fingerprintRow.source_asset_id!==VOICE_ASSET_ID||
    String(fingerprintRow.source_sha256??"").toLowerCase()!==actualCandidateSha||
    fingerprintRow.fingerprint_ref!==expectedFingerprintRef||
    fingerprintRow.model_id!==SPEAKER_QC_MODEL_ID||
    fingerprintRow.model_revision!==SPEAKER_QC_MODEL_REVISION||
    fingerprintRow.quality_claim!==false
  ) throw new Error("DIRECTOR_BONEZ_SPEAKER_FINGERPRINT_REQUIRED");

  const provider=String(candidateRow.provider_id??"");
  const modelId=String(candidateRow.model_id??"");
  const providerVoiceRef=String(metadata.voicePreset??"");
  if(provider!=="runway-speech"||modelId!=="eleven_v3"||providerVoiceRef!=="Grungle"){
    throw new Error("DIRECTOR_BONEZ_VOICE_PROVIDER_PROVENANCE_MISMATCH");
  }

  const now=new Date().toISOString();
  const identity=await client.from("director_voice_identities").upsert({
    id:VOICE_IDENTITY_ID,
    project_id:BONEZ_PROJECT_ID,
    character_id:BONEZ_CHARACTER_ID,
    display_name:"Bonez canonical voice — v1",
    source:"preset",
    consent_ref:null,
    primary_language:"en",
    default_variant_id:VOICE_VARIANT_ID,
    speaker_fingerprint_refs:[expectedFingerprintRef],
    minimum_speaker_similarity:minimumSimilarity,
    approved_at:now,
    approved_by:userId,
  },{onConflict:"id"});
  if(identity.error) throw identity.error;

  const sample=await client.from("director_voice_reference_samples").upsert({
    id:VOICE_SAMPLE_ID,
    voice_identity_id:VOICE_IDENTITY_ID,
    asset_id:VOICE_ASSET_ID,
    sha256:actualCandidateSha,
    language:"en",
    transcript:"You ever notice the dead got better stories than the living? Pull up a chair. I got time.",
    duration_seconds:9.04,
    rights_ref:"provider-preset:runway:eleven_v3:Grungle",
    quality_evidence_ids:[VOICE_RECEIPT_ID,String(fingerprintRow.id),expectedFingerprintRef],
  },{onConflict:"id"});
  if(sample.error) throw sample.error;

  const binding=await client.from("director_voice_provider_bindings").upsert({
    id:VOICE_BINDING_ID,
    voice_identity_id:VOICE_IDENTITY_ID,
    provider,
    model_id:modelId,
    provider_voice_ref:providerVoiceRef,
    reusable_prompt_ref:null,
    speaker_embedding_ref:expectedFingerprintRef,
    reference_sample_ids:[VOICE_SAMPLE_ID],
    supported_languages:["en"],
    sample_rate_hz:null,
    provenance_refs:[
      "runway-task:"+VOICE_TASK_ID,
      VOICE_RECEIPT_ID,
      String(fingerprintRow.id),
      "asset-sha256:"+actualCandidateSha,
    ],
    enabled:true,
  },{onConflict:"id"});
  if(binding.error) throw binding.error;

  const variant=await client.from("director_voice_language_variants").upsert({
    id:VOICE_VARIANT_ID,
    voice_identity_id:VOICE_IDENTITY_ID,
    language:"en",
    locale:"en-US",
    pronunciation_lexicon_ref:null,
    accent_policy:"preserve-identity",
    delivery_style:"low, unhurried, darkly amused, cynical supernatural host",
    provider_binding_ids:[VOICE_BINDING_ID],
  },{onConflict:"id"});
  if(variant.error) throw variant.error;

  const approval=await client.from("director_voice_identity_approval_receipts").upsert({
    id:VOICE_APPROVAL_RECEIPT_ID,
    project_id:BONEZ_PROJECT_ID,
    character_id:BONEZ_CHARACTER_ID,
    voice_identity_id:VOICE_IDENTITY_ID,
    candidate_asset_id:VOICE_ASSET_ID,
    candidate_sha256:actualCandidateSha,
    candidate_receipt_id:VOICE_RECEIPT_ID,
    speaker_fingerprint_receipt_id:String(fingerprintRow.id),
    speaker_fingerprint_ref:expectedFingerprintRef,
    minimum_speaker_similarity:minimumSimilarity,
    provider,
    model_id:modelId,
    provider_voice_ref:providerVoiceRef,
    authority:"DIRECTOR_EXPLICIT_VOICE_APPROVAL",
    evidence_ids:[
      VOICE_ASSET_ID,
      VOICE_RECEIPT_ID,
      String(fingerprintRow.id),
      expectedFingerprintRef,
      "asset-sha256:"+actualCandidateSha,
    ],
    approved_by:userId,
    approved_at:now,
  },{onConflict:"id"});
  if(approval.error) throw approval.error;

  const candidateApproval=await client.from("director_voice_candidate_receipts")
    .update({approval_state:"approved",updated_at:now})
    .eq("id",VOICE_RECEIPT_ID);
  if(candidateApproval.error) throw candidateApproval.error;

  return {
    ok:true,
    phase:"DIRECTOR-QUALITY.3-VOICE-APPROVED",
    voiceIdentityId:VOICE_IDENTITY_ID,
    approvalReceiptId:VOICE_APPROVAL_RECEIPT_ID,
    candidateSha256:actualCandidateSha,
    speakerFingerprintRef:expectedFingerprintRef,
    minimumSpeakerSimilarity:minimumSimilarity,
    provider:{id:provider,modelId,providerVoiceRef},
    approvedBy:userId,
    approvedAt:now,
    authority:"DIRECTOR_EXPLICIT_VOICE_APPROVAL",
    productionVoiceRuntimeCommissioned:false,
  };
}

async function qualityStatus(client:any){
  const [refsResult,castResult,voicesResult,candidateResult,candidateReceiptResult,speakerFingerprintResult,voiceApprovalResult,liveTakeResult,repairResult,videosResult,chunksResult,tokensResult]=await Promise.all([
    client.from("director_reference_media_assets")
      .select("id,sha256,reference_kind,admission_status,scan_status")
      .eq("project_id",BONEZ_PROJECT_ID)
      .in("id",[BONEZ_REFERENCE_ASSET_ID,BONEZ_PRODUCT_REFERENCE_ASSET_ID]),
    client.from("director_cast_characters")
      .select("id,character_id,canonical_appearance_variant_id,approved_at")
      .eq("project_id",BONEZ_PROJECT_ID)
      .eq("character_id",BONEZ_CHARACTER_ID)
      .maybeSingle(),
    client.from("director_voice_identities")
      .select("id,source,speaker_fingerprint_refs,minimum_speaker_similarity,approved_at")
      .eq("project_id",BONEZ_PROJECT_ID)
      .eq("character_id",BONEZ_CHARACTER_ID),
    client.from("director_generated_editing_assets")
      .select("id,sha256,provider_id,model_id,approval_policy,metadata")
      .eq("id",VOICE_ASSET_ID)
      .maybeSingle(),
    client.from("director_voice_candidate_receipts")
      .select("id,receipt_sha256,artifact_sha256,approval_state,artifact_hash_status")
      .eq("id",VOICE_RECEIPT_ID)
      .maybeSingle(),
    client.from("director_speaker_fingerprint_receipts")
      .select("id,source_asset_id,source_sha256,model_id,model_revision,embedding_dimensions,embedding_sha256,fingerprint_ref,quantization,sample_rate_hz,duration_seconds,quality_claim,created_at")
      .eq("project_id",BONEZ_PROJECT_ID)
      .eq("character_id",BONEZ_CHARACTER_ID)
      .order("created_at",{ascending:false})
      .limit(10),
    client.from("director_voice_identity_approval_receipts")
      .select("id,voice_identity_id,candidate_sha256,speaker_fingerprint_receipt_id,speaker_fingerprint_ref,minimum_speaker_similarity,provider,model_id,provider_voice_ref,authority,approved_by,approved_at")
      .eq("project_id",BONEZ_PROJECT_ID)
      .eq("character_id",BONEZ_CHARACTER_ID)
      .order("approved_at",{ascending:false}),
    client.from("director_live_take_qc_receipts")
      .select("id,purpose,reference_asset_id,reference_sha256,audio_asset_id,voice_identity_id,speaker_fingerprint_receipt_id,speaker_fingerprint_ref,provider_id,model_id,model_version,provider_job_id,provider_runtime_receipt_id,seed,output_asset_id,output_sha256,content_type,measured_duration_seconds,storage_verified,production_provider,performance_evidence,observations,qc_policy_id,qc_admissible,expected_failure_observed,qc_reasons,evidence_ids,created_at")
      .eq("project_id",BONEZ_PROJECT_ID)
      .eq("character_id",BONEZ_CHARACTER_ID)
      .order("created_at",{ascending:false})
      .limit(20),
    client.from("director_quality5_localized_repair_receipts")
      .select("id,failure_take_receipt_id,source_asset_id,source_sha256,repaired_asset_id,repaired_sha256,provider_id,model_id,model_version,provider_job_id,provider_runtime_receipt_id,repair_plan,post_repair_observations,preservation_evidence,repair_duration_seconds,qc_admissible,qc_reasons,evidence_ids,created_at")
      .eq("project_id",BONEZ_PROJECT_ID)
      .eq("character_id",BONEZ_CHARACTER_ID)
      .order("created_at",{ascending:false})
      .limit(20),
    client.from("director_generated_editing_assets")
      .select("id,sha256,provider_id,model_id,metadata,created_at")
      .eq("project_id",BONEZ_PROJECT_ID)
      .eq("media_type","video")
      .order("created_at",{ascending:false})
      .limit(20),
    client.from("director_runtime_config")
      .select("key")
      .or("key.like."+CHAR_PREFIX+"%,key.like."+PRODUCT_PREFIX+"%"),
    client.from("director_quality_bootstrap_tokens")
      .select("token_hash",{count:"exact",head:true})
      .is("consumed_at",null)
      .gt("expires_at",new Date().toISOString()),
  ]);
  for(const result of [refsResult,castResult,voicesResult,candidateResult,candidateReceiptResult,speakerFingerprintResult,voiceApprovalResult,liveTakeResult,repairResult,videosResult,chunksResult,tokensResult]){
    if(result.error) throw result.error;
  }
  const [speakerQcRuntime,bonezVoiceRuntime,hunyuanRuntime]=await Promise.all([
    speakerQcRuntimeStatus(client),
    bonezVoiceRuntimeStatus(client),
    hunyuanRuntimeStatus(client),
  ]);
  const voices=(voicesResult.data??[]) as Array<any>;
  const voiceIds=voices.map(row=>String(row.id));
  let bindingRows:Array<any>=[];
  if(voiceIds.length){
    const bindings=await client.from("director_voice_provider_bindings")
      .select("id,voice_identity_id,provider,model_id,provider_voice_ref,enabled,provenance_refs")
      .in("voice_identity_id",voiceIds)
      .eq("enabled",true);
    if(bindings.error) throw bindings.error;
    bindingRows=(bindings.data??[]) as Array<any>;
  }
  return {
    ok:true,
    phase:"DIRECTOR-BONEZ-QUALITY-PREFLIGHT-DATA",
    projectId:BONEZ_PROJECT_ID,
    references:(refsResult.data??[]).map((row:any)=>({
      id:String(row.id),
      sha256:String(row.sha256),
      referenceKind:String(row.reference_kind),
      admissionStatus:String(row.admission_status),
      scanStatus:String(row.scan_status),
    })),
    cast:castResult.data?{
      id:String((castResult.data as any).id),
      characterId:String((castResult.data as any).character_id),
      canonicalAppearanceVariantId:String((castResult.data as any).canonical_appearance_variant_id),
      approvedAt:String((castResult.data as any).approved_at),
    }:null,
    voiceIdentities:voices.map((row:any)=>({
      id:String(row.id),
      source:String(row.source),
      speakerFingerprintRefs:Array.isArray(row.speaker_fingerprint_refs)?row.speaker_fingerprint_refs.map(String):[],
      minimumSpeakerSimilarity:Number(row.minimum_speaker_similarity),
      approvedAt:String(row.approved_at),
    })),
    voiceProviderBindings:bindingRows.map((row:any)=>({
      id:String(row.id),
      voiceIdentityId:String(row.voice_identity_id),
      provider:String(row.provider),
      modelId:String(row.model_id),
      providerVoiceRef:row.provider_voice_ref?String(row.provider_voice_ref):null,
      provenanceRefs:Array.isArray(row.provenance_refs)?row.provenance_refs.map(String):[],
    })),
    voiceCandidate:candidateResult.data?{
      id:String((candidateResult.data as any).id),
      sha256:String((candidateResult.data as any).sha256),
      providerId:String((candidateResult.data as any).provider_id),
      modelId:String((candidateResult.data as any).model_id),
      approvalPolicy:String((candidateResult.data as any).approval_policy),
      metadata:(candidateResult.data as any).metadata??{},
    }:null,
    voiceCandidateReceipt:candidateReceiptResult.data?{
      id:String((candidateReceiptResult.data as any).id),
      receiptSha256:String((candidateReceiptResult.data as any).receipt_sha256),
      artifactSha256:(candidateReceiptResult.data as any).artifact_sha256
        ?String((candidateReceiptResult.data as any).artifact_sha256):null,
      approvalState:String((candidateReceiptResult.data as any).approval_state),
      artifactHashStatus:String((candidateReceiptResult.data as any).artifact_hash_status),
    }:null,
    speakerQcRuntime,
    bonezVoiceRuntime,
    hunyuanRuntime,
    voiceApprovalReceipts:(voiceApprovalResult.data??[]).map((row:any)=>({
      id:String(row.id),
      voiceIdentityId:String(row.voice_identity_id),
      candidateSha256:String(row.candidate_sha256),
      speakerFingerprintReceiptId:String(row.speaker_fingerprint_receipt_id),
      speakerFingerprintRef:String(row.speaker_fingerprint_ref),
      minimumSpeakerSimilarity:Number(row.minimum_speaker_similarity),
      provider:String(row.provider),
      modelId:String(row.model_id),
      providerVoiceRef:row.provider_voice_ref?String(row.provider_voice_ref):null,
      authority:String(row.authority),
      approvedBy:String(row.approved_by),
      approvedAt:String(row.approved_at),
    })),
    liveTakeQcReceipts:(liveTakeResult.data??[]).map((row:any)=>({
      id:String(row.id),
      purpose:String(row.purpose),
      referenceAssetId:String(row.reference_asset_id),
      referenceSha256:String(row.reference_sha256),
      audioAssetId:String(row.audio_asset_id),
      voiceIdentityId:String(row.voice_identity_id),
      speakerFingerprintReceiptId:String(row.speaker_fingerprint_receipt_id),
      speakerFingerprintRef:String(row.speaker_fingerprint_ref),
      providerId:String(row.provider_id),
      modelId:String(row.model_id),
      modelVersion:String(row.model_version),
      providerJobId:String(row.provider_job_id),
      providerRuntimeReceiptId:String(row.provider_runtime_receipt_id),
      seed:Number(row.seed),
      outputAssetId:String(row.output_asset_id),
      outputSha256:String(row.output_sha256),
      contentType:String(row.content_type),
      measuredDurationSeconds:Number(row.measured_duration_seconds),
      storageVerified:Boolean(row.storage_verified),
      productionProvider:Boolean(row.production_provider),
      performanceEvidence:row.performance_evidence??{},
      observations:Array.isArray(row.observations)?row.observations:[],
      qcPolicyId:String(row.qc_policy_id),
      qcAdmissible:Boolean(row.qc_admissible),
      expectedFailureObserved:Boolean(row.expected_failure_observed),
      qcReasons:Array.isArray(row.qc_reasons)?row.qc_reasons.map(String):[],
      evidenceIds:Array.isArray(row.evidence_ids)?row.evidence_ids.map(String):[],
      createdAt:String(row.created_at),
    })),
    quality5RepairReceipts:(repairResult.data??[]).map((row:any)=>({
      id:String(row.id),
      failureTakeReceiptId:String(row.failure_take_receipt_id),
      sourceAssetId:String(row.source_asset_id),
      sourceSha256:String(row.source_sha256),
      repairedAssetId:String(row.repaired_asset_id),
      repairedSha256:String(row.repaired_sha256),
      providerId:String(row.provider_id),
      modelId:String(row.model_id),
      modelVersion:String(row.model_version),
      providerJobId:String(row.provider_job_id),
      providerRuntimeReceiptId:String(row.provider_runtime_receipt_id),
      repairPlan:row.repair_plan??{},
      postRepairObservations:Array.isArray(row.post_repair_observations)?row.post_repair_observations:[],
      preservationEvidence:row.preservation_evidence??{},
      repairDurationSeconds:Number(row.repair_duration_seconds),
      qcAdmissible:Boolean(row.qc_admissible),
      qcReasons:Array.isArray(row.qc_reasons)?row.qc_reasons.map(String):[],
      evidenceIds:Array.isArray(row.evidence_ids)?row.evidence_ids.map(String):[],
      createdAt:String(row.created_at),
    })),
    speakerFingerprintReceipts:(speakerFingerprintResult.data??[]).map((row:any)=>({
      id:String(row.id),
      sourceAssetId:String(row.source_asset_id),
      sourceSha256:String(row.source_sha256),
      modelId:String(row.model_id),
      modelRevision:String(row.model_revision),
      embeddingDimensions:Number(row.embedding_dimensions),
      embeddingSha256:String(row.embedding_sha256),
      fingerprintRef:String(row.fingerprint_ref),
      quantization:String(row.quantization),
      sampleRateHz:Number(row.sample_rate_hz),
      durationSeconds:Number(row.duration_seconds),
      qualityClaim:Boolean(row.quality_claim),
      createdAt:String(row.created_at),
    })),
    recentVideoArtifacts:(videosResult.data??[]).map((row:any)=>({
      id:String(row.id),
      sha256:String(row.sha256),
      providerId:String(row.provider_id),
      modelId:String(row.model_id),
      metadata:row.metadata??{},
      createdAt:String(row.created_at),
    })),
    stagedChunkCount:(chunksResult.data??[]).length,
    activeBootstrapTokenCount:tokensResult.count??0,
  };
}

async function bootstrap(client:any,body:any){
  const canonical=requireCanonical(body);
  const userId=await consumeToken(client,String(body?.token??""));
  const now=new Date().toISOString();

  const membership=await client.from("director_project_memberships").upsert({
    project_id:BONEZ_PROJECT_ID,user_id:userId,role:"owner",created_at:now,
  },{onConflict:"project_id,user_id"});
  if(membership.error) throw membership.error;

  const [characterBytes,productBytes]=await Promise.all([
    readChunks(client,CHAR_PREFIX),
    readChunks(client,PRODUCT_PREFIX),
  ]);
  const [characterRef,productRef]=await Promise.all([
    uploadReference(client,{userId,bytes:characterBytes,assetId:BONEZ_REFERENCE_ASSET_ID,expectedSha:BONEZ_REFERENCE_SHA256,kind:"character",objectPath:"bonez/v2/bonez-canonical-character-v2.jpg",filename:"bonez-canonical-character-v2.jpg",viewHint:"close-up"}),
    uploadReference(client,{userId,bytes:productBytes,assetId:BONEZ_PRODUCT_REFERENCE_ASSET_ID,expectedSha:BONEZ_PRODUCT_REFERENCE_SHA256,kind:"product",objectPath:"bonez/v2/bonez-lair-art-print-v2.jpg",filename:"bonez-lair-art-print-v2.jpg",viewHint:"front"}),
  ]);

  const cast=canonical.cast;
  const castWrite=await client.from("director_cast_characters").upsert({
    id:cast.id,project_id:BONEZ_PROJECT_ID,character_id:BONEZ_CHARACTER_ID,display_name:cast.displayName,
    archetype:cast.archetype,continuity_ref:cast.continuityRef,behavior_dna_ref:cast.behaviorDnaRef??null,
    rig_asset_id:cast.rigAssetId??null,canonical_appearance_variant_id:cast.canonicalAppearanceVariantId,
    locked_traits:[...(cast.lockedTraits??[])],identity_fingerprint_refs:[...(cast.identityFingerprintRefs??[])],
    approved_at:now,approved_by:userId,
  },{onConflict:"project_id,character_id"});
  if(castWrite.error) throw castWrite.error;

  for(const variant of cast.appearanceVariants??[]){
    const write=await client.from("director_character_appearance_variants").upsert({
      id:variant.id,project_id:BONEZ_PROJECT_ID,character_id:BONEZ_CHARACTER_ID,kind:variant.kind,label:variant.label,
      reference_asset_ids:[...(variant.referenceAssetIds??[])],reference_sha256s:[...(variant.referenceSha256s??[])],
      wardrobe_notes:[...(variant.wardrobeNotes??[])],appearance_notes:[...(variant.appearanceNotes??[])],
      approved_at:now,approved_by:userId,
    },{onConflict:"id"});
    if(write.error) throw write.error;
  }

  for(const pkg of canonical.packages){
    const write=await client.from("director_production_asset_packages").upsert({
      id:pkg.id,project_id:BONEZ_PROJECT_ID,owner_user_id:userId,version:pkg.version,kind:pkg.kind,
      source_fingerprint:pkg.sourceFingerprint,package:pkg,evidence_ids:["canon:bonez","reference:"+BONEZ_REFERENCE_SHA256],
      created_at:now,updated_at:now,
    },{onConflict:"id"});
    if(write.error) throw write.error;
  }

  const world=canonical.world;
  const worldWrite=await client.from("director_world_state_versions").upsert({
    id:world.id,project_id:BONEZ_PROJECT_ID,owner_user_id:userId,version:world.version,
    world_kind:world.kind,state:world,evidence_ids:["canon:bonez:lair","image:bonez:canonical"],created_at:now,
  },{onConflict:"id"});
  if(worldWrite.error) throw worldWrite.error;

  for(const directive of canonical.directives){
    const write=await client.from("director_creative_directives").upsert({
      id:directive.id,project_id:BONEZ_PROJECT_ID,owner_user_id:userId,scope:directive.scope,
      scope_ref:directive.scopeRef,key:directive.key,mode:directive.mode,value:directive.value??null,
      created_by:directive.createdBy,evidence_ids:[...(directive.evidenceIds??[])],created_at:directive.createdAt??now,
    },{onConflict:"id"});
    if(write.error) throw write.error;
  }

  const product=canonical.productBible;
  const productWrite=await client.from("director_product_bibles").upsert({
    id:product.id,project_id:BONEZ_PROJECT_ID,product_id:product.productId,
    canonical_variant_id:product.canonicalVariantId,bible:product,approved_by_user_id:userId,
    created_at:now,updated_at:now,
  },{onConflict:"id"});
  if(productWrite.error) throw productWrite.error;

  const voices=await client.from("director_voice_identities").select("id,source,approved_at")
    .eq("project_id",BONEZ_PROJECT_ID).eq("character_id",BONEZ_CHARACTER_ID);
  if(voices.error) throw voices.error;
  await cleanupChunks(client);

  return {
    ok:true,phase:"DIRECTOR-QUALITY.2-LIVE",projectId:BONEZ_PROJECT_ID,characterId:BONEZ_CHARACTER_ID,
    references:{character:characterRef,product:productRef},
    cast:{id:"cast:bonez:v1",appearanceVariantId:"appearance:bonez:canonical:v1"},
    assetPackageIds:canonical.packages.map((pkg:any)=>String(pkg.id)),
    worldStateId:String(world.id),creativeDirectiveCount:canonical.directives.length,productBibleId:String(product.id),
    voiceIdentityIds:(voices.data??[]).map((row:any)=>String(row.id)),
    privilegedTransport:"vercel-oidc-supabase-edge",
  };
}

async function main(req:Request):Promise<Response>{
  if(req.method!=="POST") return json(405,{ok:false,error:"method_not_allowed"});
  const url=Deno.env.get("SUPABASE_URL");
  const key=secretKey();
  if(!url||!key) return json(503,{ok:false,error:"supabase_admin_unavailable"});
  const client=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  try{
    const body=await req.json() as Json;
    const action=String((body as any).action??"bootstrap");
    const vercelAuthorized=await authorizeVercel(req);
    let authenticatedUserId:string|undefined;

    if(!vercelAuthorized){
      if(action!=="stage"&&action!=="voice-approve") return json(401,{ok:false,error:"unauthorized"});
      const authorization=req.headers.get("authorization")??"";
      const token=authorization.startsWith("Bearer ")?authorization.slice(7).trim():"";
      if(!token) return json(401,{ok:false,error:"DIRECTOR_BONEZ_USER_AUTH_REQUIRED"});
      const verified=await client.auth.getUser(token);
      if(verified.error||!verified.data?.user?.id){
        return json(401,{ok:false,error:"DIRECTOR_BONEZ_USER_AUTH_INVALID"});
      }
      authenticatedUserId=String(verified.data.user.id);
    }

    if(action==="stage") return json(200,await stageReferences(client,body,authenticatedUserId));
    if(action==="voice-approve") return json(200,await approveBonezVoiceIdentity(client,body,authenticatedUserId));
    if(action==="voice-candidate") return json(200,await recordVoiceCandidate(client));
    if(action==="speaker-fingerprint-source") return json(200,await speakerFingerprintSource(client));
    if(action==="speaker-fingerprint-receipt") return json(200,await recordSpeakerFingerprintReceipt(client,body));
    if(action==="speaker-fingerprint-run") return json(200,await runSpeakerFingerprint(client));
    if(action==="hunyuan-runtime-binding") return json(200,await hunyuanRuntimeBinding(client));
    if(action==="status") return json(200,await qualityStatus(client));
    if(action!=="bootstrap") return json(400,{ok:false,error:"unsupported_action"});
    return json(200,await bootstrap(client,body));
  }catch(error){
    console.error("jhadina-director-bonez-gateway",error instanceof Error?error.message:String(error));
    const message=error instanceof Error?error.message:"DIRECTOR_BONEZ_GATEWAY_FAILED";
    const unauthorized=new Set([
      "DIRECTOR_BONEZ_BOOTSTRAP_UNAUTHORIZED",
      "DIRECTOR_BONEZ_STAGE_USER_MISMATCH",
    ]);
    const forbidden=new Set([
      "DIRECTOR_BONEZ_VOICE_APPROVAL_AUTHORITY_REQUIRED",
    ]);
    const conflict=new Set([
      "DIRECTOR_QUALITY_2_REQUIRED",
      "DIRECTOR_BONEZ_VOICE_CANDIDATE_MISSING",
      "DIRECTOR_BONEZ_VOICE_CANDIDATE_MISMATCH",
      "DIRECTOR_BONEZ_VOICE_CANDIDATE_RECEIPT_INVALID",
      "DIRECTOR_BONEZ_SPEAKER_FINGERPRINT_REQUIRED",
      "DIRECTOR_BONEZ_VOICE_PROVIDER_PROVENANCE_MISMATCH",
    ]);
    const badRequest=new Set([
      "DIRECTOR_BONEZ_VOICE_APPROVER_REQUIRED",
      "DIRECTOR_BONEZ_VOICE_EXPLICIT_APPROVAL_REQUIRED",
      "DIRECTOR_BONEZ_VOICE_EXPECTED_SHA_REQUIRED",
      "DIRECTOR_BONEZ_VOICE_EXPECTED_FINGERPRINT_REQUIRED",
      "DIRECTOR_BONEZ_VOICE_SIMILARITY_FLOOR_INVALID",
    ]);
    const unavailable=new Set([
      "DIRECTOR_SPEAKER_QC_RUNTIME_NOT_CONFIGURED",
      "DIRECTOR_SPEAKER_QC_RUNTIME_NOT_READY",
    ]);
    const status=unauthorized.has(message)?401:
      forbidden.has(message)?403:
      conflict.has(message)?409:
      badRequest.has(message)?400:
      unavailable.has(message)?503:500;
    return json(status,{ok:false,error:message});
  }
}

Deno.serve(main);
