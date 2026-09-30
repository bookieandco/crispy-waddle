import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { saveDirectorCastRecord } from '@/lib/director-cast-repository';
import { inspectDirectorReferenceImage } from '@/lib/director-reference-media';
import { createConfiguredWholeVideoProviders } from '@/lib/director-whole-video-providers';
import { createConfiguredDirectorHunyuanVideoProvider } from '@/lib/director-hunyuan-video-provider';
import {
  BONEZ_CANON,
  BONEZ_CHARACTER_ID,
  BONEZ_REFERENCE_SOURCE_SHA256,
  BONEZ_PRODUCT_ID,
  BONEZ_PRODUCT_REFERENCE_ASSET_ID,
  BONEZ_PRODUCT_REFERENCE_SHA256,
  BONEZ_PROJECT_ID,
  BONEZ_REFERENCE_ASSET_ID,
  BONEZ_REFERENCE_SHA256,
  BONEZ_RIGHTS_REF,
  bonezAssetPackages,
  bonezCastRecord,
  bonezCreativeDirectives,
  bonezProductBible,
  bonezWorldState,
} from '@/lib/director-bonez-canon';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;

const CHAR_PREFIX='bonez_bootstrap_char_chunk_';
const PRODUCT_PREFIX='bonez_bootstrap_product_chunk_';
const DEFAULT_BONEZ_GATEWAY_URL=
  'https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway';

function sha256(bytes:Uint8Array):string{
  return createHash('sha256').update(bytes).digest('hex');
}

async function consumeToken(client:any,plain:string|undefined):Promise<string>{
  if(!plain) throw new Error('DIRECTOR_BONEZ_BOOTSTRAP_UNAUTHORIZED');
  const hash=createHash('sha256').update(plain).digest('hex');
  const now=new Date().toISOString();
  const {data,error}=await client.from('director_quality_bootstrap_tokens')
    .update({consumed_at:now})
    .eq('token_hash',hash)
    .is('consumed_at',null)
    .gt('expires_at',now)
    .select('user_id')
    .maybeSingle();
  if(error) throw error;
  if(!data?.user_id) throw new Error('DIRECTOR_BONEZ_BOOTSTRAP_UNAUTHORIZED');
  return String(data.user_id);
}

async function readChunkedBytes(client:any,prefix:string):Promise<Uint8Array>{
  const {data,error}=await client.from('director_runtime_config')
    .select('key,value')
    .like('key',prefix+'%')
    .order('key',{ascending:true});
  if(error) throw error;
  const rows=(data??[]) as Array<{key:string;value:string}>;
  if(!rows.length) throw new Error('DIRECTOR_BONEZ_REFERENCE_CHUNKS_MISSING');
  const encoded=rows.map(row=>row.value).join('');
  const bytes=new Uint8Array(Buffer.from(encoded,'base64'));
  if(!bytes.length) throw new Error('DIRECTOR_BONEZ_REFERENCE_BYTES_EMPTY');
  return bytes;
}

async function uploadReference(input:{
  client:any;userId:string;assetId:string;bytes:Uint8Array;expectedSha:string;
  kind:'character'|'product';objectPath:string;filename:string;viewHint:'close-up'|'front';
}){
  const actual=sha256(input.bytes);
  if(actual!==input.expectedSha) throw new Error('DIRECTOR_BONEZ_REFERENCE_SHA_MISMATCH:'+input.kind);
  const inspection=inspectDirectorReferenceImage(input.bytes,'image/jpeg');
  const {error:uploadError}=await input.client.storage.from('director-character-references')
    .upload(input.objectPath,input.bytes,{contentType:'image/jpeg',upsert:true});
  if(uploadError) throw uploadError;

  const evidence=[
    'source:model-generated-bonez-canonical-v2',
    'reference-source-sha256:'+BONEZ_REFERENCE_SOURCE_SHA256,
    'source-format:image-jpeg',
    'signature:image-jpeg',
    'dimensions:'+inspection.width+'x'+inspection.height,
    'sha256:'+actual,
    'vision-review:fictional-horror-reference',
  ];
  const {error:rowError}=await input.client.from('director_reference_media_assets').upsert({
    id:input.assetId,
    project_id:BONEZ_PROJECT_ID,
    user_id:input.userId,
    bucket_id:'director-character-references',
    object_path:input.objectPath,
    original_filename:input.filename,
    mime_type:'image/jpeg',
    byte_size:input.bytes.byteLength,
    width:inspection.width,
    height:inspection.height,
    sha256:actual,
    view_hint:input.viewHint,
    rights_ref:BONEZ_RIGHTS_REF,
    consent_ref:null,
    admission_status:'admitted',
    scan_status:'clean',
    scan_evidence_ids:evidence,
    rejection_reason:null,
    reference_kind:input.kind,
    admitted_at:new Date().toISOString(),
    updated_at:new Date().toISOString(),
  },{onConflict:'id'});
  if(rowError) throw rowError;
  return {assetId:input.assetId,sha256:actual,width:inspection.width,height:inspection.height,evidence};
}

async function cleanupChunks(client:any){
  const {error}=await client.from('director_runtime_config')
    .delete()
    .or('key.like.'+CHAR_PREFIX+'%,key.like.'+PRODUCT_PREFIX+'%');
  if(error) throw error;
}

async function collectReadiness(voiceIdentityIds:string[]){
  const wholeVideoProviders=createConfiguredWholeVideoProviders().map(provider=>({
    id:provider.descriptor.id,
    name:provider.descriptor.name,
    productionQualityEligible:Boolean(provider.descriptor.productionQualityEligible),
    supportsCharacterReference:Boolean(provider.descriptor.supportsCharacterReference),
    supportsProductReference:Boolean(provider.descriptor.supportsProductReference),
    maximumDurationSeconds:provider.descriptor.maximumDurationSeconds??null,
    health:String(provider.descriptor.health??'unknown'),
  }));
  const hunyuan=createConfiguredDirectorHunyuanVideoProvider();
  let hunyuanHealth:Readonly<Record<string,unknown>>|null=null;
  let hunyuanHealthError:string|null=null;
  let hunyuanProductionReady=false;
  if(hunyuan){
    try{
      hunyuanHealth=await hunyuan.health();
      hunyuanProductionReady=hunyuanHealth.status==='ready'&&hunyuanHealth.productionReady===true;
    }catch(cause){
      hunyuanHealthError=cause instanceof Error?cause.message:'DIRECTOR_HUNYUAN_HEALTH_FAILED';
    }
  }
  const providers=[
    ...wholeVideoProviders,
    ...(hunyuan?[{
      id:hunyuan.id,
      name:'Director HunyuanVideo-1.5',
      productionQualityEligible:Boolean(hunyuan.productionQualityEligible),
      supportsCharacterReference:true,
      supportsProductReference:false,
      maximumDurationSeconds:null,
      health:hunyuanProductionReady?'ready':'blocked',
    }]:[]),
  ];
  const eligibleProviders=providers.filter(provider=>provider.productionQualityEligible);
  const liveEligibleProviders=eligibleProviders.filter(provider=>provider.health==='ready');
  return {
    movieGradeVoiceApproved:voiceIdentityIds.length>0,
    voiceIdentityIds,
    configuredProviders:providers,
    productionQualityProviderIds:eligibleProviders.map(provider=>provider.id),
    liveProductionQualityProviderIds:liveEligibleProviders.map(provider=>provider.id),
    hunyuan:{
      configured:Boolean(hunyuan),
      productionReady:hunyuanProductionReady,
      health:hunyuanHealth,
      error:hunyuanHealthError,
    },
    productionFinalCanLaunch:voiceIdentityIds.length>0&&liveEligibleProviders.length>0,
  };
}

function gatewayCanonicalPayload(now:string){
  const gatewayPrincipal='vercel-oidc-bonez-gateway';
  return {
    projectId:BONEZ_PROJECT_ID,
    characterId:BONEZ_CHARACTER_ID,
    rightsRef:BONEZ_RIGHTS_REF,
    referenceSourceSha256:BONEZ_REFERENCE_SOURCE_SHA256,
    references:{
      character:{assetId:BONEZ_REFERENCE_ASSET_ID,expectedSha:BONEZ_REFERENCE_SHA256},
      product:{assetId:BONEZ_PRODUCT_REFERENCE_ASSET_ID,expectedSha:BONEZ_PRODUCT_REFERENCE_SHA256},
    },
    cast:bonezCastRecord(now,gatewayPrincipal),
    packages:bonezAssetPackages(now),
    world:bonezWorldState(now),
    directives:bonezCreativeDirectives(now),
    productBible:bonezProductBible(),
  };
}

async function vercelOidcToken(request:Request):Promise<string|undefined>{
  const environmentToken=process.env.VERCEL_OIDC_TOKEN?.trim();
  if(environmentToken) return environmentToken;
  return request.headers.get('x-vercel-oidc-token')?.trim()||undefined;
}

async function forwardToBonezGateway(request:Request,token:string|undefined):Promise<NextResponse>{
  const oidc=await vercelOidcToken(request);
  if(!oidc){
    return NextResponse.json({ok:false,error:'DIRECTOR_VERCEL_OIDC_REQUIRED'},{status:503});
  }
  const endpoint=process.env.JHADINA_DIRECTOR_BONEZ_GATEWAY_URL?.trim()||DEFAULT_BONEZ_GATEWAY_URL;
  const response=await fetch(endpoint,{
    method:'POST',
    headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json'},
    body:JSON.stringify({token,canonical:gatewayCanonicalPayload(new Date().toISOString())}),
    cache:'no-store',
  });
  const payload=await response.json().catch(()=>({ok:false,error:'DIRECTOR_BONEZ_GATEWAY_INVALID_JSON'})) as Record<string,unknown>;
  if(!response.ok) return NextResponse.json(payload,{status:response.status});
  const voiceIdentityIds=Array.isArray(payload.voiceIdentityIds)
    ? payload.voiceIdentityIds.map(value=>String(value))
    : [];
  const readiness=await collectReadiness(voiceIdentityIds);
  return NextResponse.json({
    ...payload,
    canon:BONEZ_CANON,
    readiness,
    truthBoundary:{
      referenceDerivative:true,
      referenceSourcePreservedBySha256:BONEZ_REFERENCE_SOURCE_SHA256,
      unconfirmedOriginNotCanonized:true,
      noQualityClaimYet:true,
    },
  },{headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}});
}

async function bootstrap(request:Request){
  const url=new URL(request.url);
  const token=url.searchParams.get('token')??undefined;
  const client=createServiceRoleClient();
  if(!client) return forwardToBonezGateway(request,token);
  try{
    const userId=await consumeToken(client,token);
    const now=new Date().toISOString();

    const {error:membershipError}=await client.from('director_project_memberships').upsert({
      project_id:BONEZ_PROJECT_ID,user_id:userId,role:'owner',created_at:now,
    },{onConflict:'project_id,user_id'});
    if(membershipError) throw membershipError;

    const [characterBytes,productBytes]=await Promise.all([
      readChunkedBytes(client,CHAR_PREFIX),
      readChunkedBytes(client,PRODUCT_PREFIX),
    ]);
    const [characterRef,productRef]=await Promise.all([
      uploadReference({
        client,userId,assetId:BONEZ_REFERENCE_ASSET_ID,bytes:characterBytes,
        expectedSha:BONEZ_REFERENCE_SHA256,kind:'character',
        objectPath:'bonez/v2/bonez-canonical-character-v2.jpg',
        filename:'bonez-canonical-character-v2.jpg',viewHint:'close-up',
      }),
      uploadReference({
        client,userId,assetId:BONEZ_PRODUCT_REFERENCE_ASSET_ID,bytes:productBytes,
        expectedSha:BONEZ_PRODUCT_REFERENCE_SHA256,kind:'product',
        objectPath:'bonez/v2/bonez-lair-art-print-v2.jpg',
        filename:'bonez-lair-art-print-v2.jpg',viewHint:'front',
      }),
    ]);

    await saveDirectorCastRecord(client,{cast:bonezCastRecord(now,userId),approvedByUserId:userId});

    const packages=bonezAssetPackages(now);
    for(const pkg of packages){
      const {error}=await client.from('director_production_asset_packages').upsert({
        id:pkg.id,project_id:BONEZ_PROJECT_ID,owner_user_id:userId,version:pkg.version,kind:pkg.kind,
        source_fingerprint:pkg.sourceFingerprint,package:pkg,
        evidence_ids:['canon:bonez','reference:'+BONEZ_REFERENCE_SHA256],
        created_at:now,updated_at:now,
      },{onConflict:'id'});
      if(error) throw error;
    }

    const world=bonezWorldState(now);
    const {error:worldError}=await client.from('director_world_state_versions').upsert({
      id:world.id,project_id:BONEZ_PROJECT_ID,owner_user_id:userId,version:world.version,
      world_kind:world.kind,state:world,evidence_ids:['canon:bonez:lair','image:bonez:canonical'],created_at:now,
    },{onConflict:'id'});
    if(worldError) throw worldError;

    for(const directive of bonezCreativeDirectives(now)){
      const {error}=await client.from('director_creative_directives').upsert({
        id:directive.id,project_id:BONEZ_PROJECT_ID,owner_user_id:userId,scope:directive.scope,
        scope_ref:directive.scopeRef,key:directive.key,mode:directive.mode,
        value:directive.value??null,created_by:directive.createdBy,
        evidence_ids:[...directive.evidenceIds],created_at:directive.createdAt,
      },{onConflict:'id'});
      if(error) throw error;
    }

    const product=bonezProductBible();
    const {error:productBibleError}=await client.from('director_product_bibles').upsert({
      id:product.id,project_id:BONEZ_PROJECT_ID,product_id:BONEZ_PRODUCT_ID,
      canonical_variant_id:product.canonicalVariantId,bible:product,
      approved_by_user_id:userId,created_at:now,updated_at:now,
    },{onConflict:'id'});
    if(productBibleError) throw productBibleError;

    const {data:voiceRows,error:voiceError}=await client.from('director_voice_identities')
      .select('id,source,approved_at').eq('project_id',BONEZ_PROJECT_ID).eq('character_id',BONEZ_CHARACTER_ID);
    if(voiceError) throw voiceError;

    const voiceIdentityIds=(voiceRows??[]).map((row:any)=>String(row.id));
    const readiness=await collectReadiness(voiceIdentityIds);

    await cleanupChunks(client);

    return NextResponse.json({
      ok:true,
      phase:'DIRECTOR-QUALITY.2-LIVE',
      projectId:BONEZ_PROJECT_ID,
      characterId:BONEZ_CHARACTER_ID,
      canon:BONEZ_CANON,
      references:{character:characterRef,product:productRef},
      cast:{id:'cast:bonez:v1',appearanceVariantId:'appearance:bonez:canonical:v1'},
      assetPackageIds:packages.map(pkg=>pkg.id),
      worldStateId:world.id,
      creativeDirectiveCount:bonezCreativeDirectives(now).length,
      productBibleId:product.id,
      readiness,
      truthBoundary:{
        referenceDerivative:true,
        referenceSourcePreservedBySha256:BONEZ_REFERENCE_SOURCE_SHA256,
        unconfirmedOriginNotCanonized:true,
        noQualityClaimYet:true,
      },
    },{headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}});
  }catch(cause){
    const message=cause instanceof Error?cause.message:'DIRECTOR_BONEZ_BOOTSTRAP_FAILED';
    return NextResponse.json({ok:false,error:message},{status:message==='DIRECTOR_BONEZ_BOOTSTRAP_UNAUTHORIZED'?401:500});
  }
}

export async function GET(request:Request){
  return bootstrap(request);
}
