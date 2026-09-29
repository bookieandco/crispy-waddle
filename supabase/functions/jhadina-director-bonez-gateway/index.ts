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

type Json=Record<string,unknown>;
function json(status:number,body:unknown):Response{
  return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","referrer-policy":"no-referrer"}});
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
async function uploadReference(client:any,input:{userId:string;assetId:string;bytes:Uint8Array;expectedSha:string;kind:"character"|"product";objectPath:string;filename:string;viewHint:string}){
  const actual=await sha256Bytes(input.bytes);
  if(actual!==input.expectedSha) throw new Error("DIRECTOR_BONEZ_REFERENCE_SHA_MISMATCH:"+input.kind);
  const dimensions=jpegDimensions(input.bytes);
  const upload=await client.storage.from("director-character-references").upload(input.objectPath,input.bytes,{contentType:"image/jpeg",upsert:true});
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
  const result=await client.from("director_runtime_config").delete().or("key.like."+CHAR_PREFIX+"%,key.like."+PRODUCT_PREFIX+"%");
  if(result.error) throw result.error;
}
function requireUserId(value:unknown):string{
  const userId=String(value??"").trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)){
    throw new Error("DIRECTOR_BONEZ_USER_ID_INVALID");
  }
  return userId;
}
function directBytes(body:any):{character:Uint8Array;product:Uint8Array}{
  const characterBase64=typeof body?.characterBase64==="string"?body.characterBase64:"";
  const productBase64=typeof body?.productBase64==="string"?body.productBase64:"";
  if(!characterBase64||!productBase64) throw new Error("DIRECTOR_BONEZ_DIRECT_BYTES_REQUIRED");
  const character=decodeBase64(characterBase64);
  const product=decodeBase64(productBase64);
  const maxEach=2_000_000;
  const maxCombined=3_000_000;
  if(!character.length||!product.length) throw new Error("DIRECTOR_BONEZ_REFERENCE_BYTES_EMPTY");
  if(character.length>maxEach||product.length>maxEach||character.length+product.length>maxCombined){
    throw new Error("DIRECTOR_BONEZ_DIRECT_BYTES_TOO_LARGE");
  }
  return {character,product};
}
async function main(req:Request):Promise<Response>{
  if(req.method!=="POST") return json(405,{ok:false,error:"method_not_allowed"});
  if(!(await authorizeVercel(req))) return json(401,{ok:false,error:"unauthorized"});
  const url=Deno.env.get("SUPABASE_URL");
  const key=secretKey();
  if(!url||!key) return json(503,{ok:false,error:"supabase_admin_unavailable"});
  const client=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  try{
    const body=await req.json() as Json;
    const canonical=requireCanonical(body);
    const directMode=(body as any).mode==="direct";
    const userId=directMode
      ? requireUserId((body as any).userId)
      : await consumeToken(client,String((body as any).token??""));
    const now=new Date().toISOString();

    const membership=await client.from("director_project_memberships").upsert({
      project_id:BONEZ_PROJECT_ID,user_id:userId,role:"owner",created_at:now,
    },{onConflict:"project_id,user_id"});
    if(membership.error) throw membership.error;

    let characterBytes:Uint8Array;
    let productBytes:Uint8Array;
    if(directMode){
      const direct=directBytes(body);
      characterBytes=direct.character;
      productBytes=direct.product;
    }else{
      [characterBytes,productBytes]=await Promise.all([readChunks(client,CHAR_PREFIX),readChunks(client,PRODUCT_PREFIX)]);
    }
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
    if(!directMode) await cleanupChunks(client);

    return json(200,{
      ok:true,phase:"DIRECTOR-QUALITY.2-LIVE",projectId:BONEZ_PROJECT_ID,characterId:BONEZ_CHARACTER_ID,
      references:{character:characterRef,product:productRef},
      cast:{id:"cast:bonez:v1",appearanceVariantId:"appearance:bonez:canonical:v1"},
      assetPackageIds:canonical.packages.map((pkg:any)=>String(pkg.id)),
      worldStateId:String(world.id),creativeDirectiveCount:canonical.directives.length,productBibleId:String(product.id),
      voiceIdentityIds:(voices.data??[]).map((row:any)=>String(row.id)),
      privilegedTransport:"vercel-oidc-supabase-edge",
      admissionMode:directMode?"direct-authenticated-upload":"staged-token",
    });
  }catch(error){
    console.error("jhadina-director-bonez-gateway",error instanceof Error?error.message:String(error));
    const message=error instanceof Error?error.message:"DIRECTOR_BONEZ_BOOTSTRAP_FAILED";
    return json(message==="DIRECTOR_BONEZ_BOOTSTRAP_UNAUTHORIZED"?401:500,{ok:false,error:message});
  }
}
Deno.serve(main);
