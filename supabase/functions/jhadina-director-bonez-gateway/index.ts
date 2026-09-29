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
const BONEZ_REFERENCE_ASSET_ID="director-ref:bonez:canonical:v1";
const BONEZ_REFERENCE_SHA256="bc3cf5b39b814eac4a18320ece12cc026d5607e1baa41e0355584efa050d89cc";
const BONEZ_PRODUCT_REFERENCE_ASSET_ID="director-ref:bonez:product-print:v1";
const BONEZ_PRODUCT_REFERENCE_SHA256="8e09332025a170adf956d726e2774cab7987ec6052644375960bf467bc2847ef";
const BONEZ_ORIGINAL_UPLOAD_SHA256="f50dbd93ab245e9098fb7237c8149cf20c445fe22fdea9070741f38f43d9c881";
const BONEZ_RIGHTS_REF="user-supplied-reference:bonez:2026-09-28";
const CHAR_PREFIX="bonez_bootstrap_char_chunk_";
const PRODUCT_PREFIX="bonez_bootstrap_product_chunk_";
const VOICE_SOURCE_KEY="bonez_voice_candidate_source_url_v1";
const VOICE_TASK_ID="4c04699b-bbc2-4e40-8d8e-502d6a71d959";
const VOICE_ASSET_ID="asset:audio:bonez:voice-audition:v1";
const VOICE_OBJECT_PATH="bonez/voice-candidates/Bonez_voice_audition_v1.mp3";
const VOICE_RECEIPT_ID="voice-candidate:bonez:runway:"+VOICE_TASK_ID;
const VOICE_RECEIPT_SHA256="cc388b7d4d874dfc62c6e7aaa5193928d2473cbc036ade112603a1cfa25707cd";
const VOICE_REQUEST_TRANSCRIPT="[low, amused] You ever notice the dead got better stories than the living? [chuckles] Pull up a chair. I got time.";

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
    "source:user-uploaded-bonez-canonical",
    "original-upload-sha256:"+BONEZ_ORIGINAL_UPLOAD_SHA256,
    "sanitized-reencode:pillow-rgb-jpeg",
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
  if(c.rightsRef!==BONEZ_RIGHTS_REF||c.originalUploadSha256!==BONEZ_ORIGINAL_UPLOAD_SHA256) throw new Error("DIRECTOR_BONEZ_CANONICAL_PAYLOAD_INVALID");
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

async function bootstrap(client:any,body:any,authenticatedUserId?:string){
  const canonical=requireCanonical(body);
  const userId=await consumeToken(client,String(body?.token??""));
  if(authenticatedUserId&&userId!==authenticatedUserId){
    throw new Error("DIRECTOR_BONEZ_BOOTSTRAP_USER_MISMATCH");
  }
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
    uploadReference(client,{userId,bytes:characterBytes,assetId:BONEZ_REFERENCE_ASSET_ID,expectedSha:BONEZ_REFERENCE_SHA256,kind:"character",objectPath:"bonez/v1/bonez-canonical-character-v1.jpg",filename:"bonez-canonical-character-v1.jpg",viewHint:"close-up"}),
    uploadReference(client,{userId,bytes:productBytes,assetId:BONEZ_PRODUCT_REFERENCE_ASSET_ID,expectedSha:BONEZ_PRODUCT_REFERENCE_SHA256,kind:"product",objectPath:"bonez/v1/bonez-lair-art-print-v1.jpg",filename:"bonez-lair-art-print-v1.jpg",viewHint:"front"}),
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

    let authenticatedUserId:string|undefined;
    const vercelAuthorized=await authorizeVercel(req);
    if(!vercelAuthorized){
      if(action!=="stage") return json(401,{ok:false,error:"unauthorized"});
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
    if(action==="voice-candidate") return json(200,await recordVoiceCandidate(client));
    if(action!=="bootstrap") return json(400,{ok:false,error:"unsupported_action"});
    return json(200,await bootstrap(client,body));
  }catch(error){
    console.error("jhadina-director-bonez-gateway",error instanceof Error?error.message:String(error));
    const message=error instanceof Error?error.message:"DIRECTOR_BONEZ_GATEWAY_FAILED";
    const unauthorized=new Set([
      "DIRECTOR_BONEZ_BOOTSTRAP_UNAUTHORIZED",
      "DIRECTOR_BONEZ_STAGE_USER_MISMATCH",
      "DIRECTOR_BONEZ_BOOTSTRAP_USER_MISMATCH",
    ]);
    return json(unauthorized.has(message)?401:500,{ok:false,error:message});
  }
}

Deno.serve(main);
