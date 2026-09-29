import {createHash,randomBytes} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {
  BONEZ_PRODUCT_REFERENCE_SHA256,
  BONEZ_PROJECT_ID,
  BONEZ_REFERENCE_SHA256,
} from '@/lib/director-bonez-canon';

const CHAR_PREFIX='bonez_bootstrap_char_chunk_';
const PRODUCT_PREFIX='bonez_bootstrap_product_chunk_';
const VOICE_SOURCE_KEY='bonez_voice_candidate_source_url_v1';
const VOICE_TASK_ID='4c04699b-bbc2-4e40-8d8e-502d6a71d959';
const VOICE_ASSET_ID='asset:audio:bonez:voice-audition:v1';
const VOICE_OBJECT_PATH='bonez/voice-candidates/Bonez_voice_audition_v1.mp3';
const VOICE_RECEIPT_ID='voice-candidate:bonez:runway:'+VOICE_TASK_ID;
const VOICE_RECEIPT_SHA256='cc388b7d4d874dfc62c6e7aaa5193928d2473cbc036ade112603a1cfa25707cd';
const VOICE_REQUEST_TRANSCRIPT='[low, amused] You ever notice the dead got better stories than the living? [chuckles] Pull up a chair. I got time.';

function sha256(bytes:Uint8Array|string){
  return createHash('sha256').update(bytes).digest('hex');
}

async function writeChunks(client:SupabaseClient,prefix:string,bytes:Uint8Array){
  const encoded=Buffer.from(bytes).toString('base64');
  const chunkSize=32000;
  const rows:Array<{key:string;value:string;sensitive:boolean;updated_at:string}>=[];
  for(let offset=0,index=0;offset<encoded.length;offset+=chunkSize,index++){
    rows.push({
      key:prefix+String(index).padStart(4,'0'),
      value:encoded.slice(offset,offset+chunkSize),
      sensitive:true,
      updated_at:new Date().toISOString(),
    });
  }
  if(!rows.length) throw new Error('DIRECTOR_BONEZ_REFERENCE_BYTES_EMPTY');
  const {error}=await client.from('director_runtime_config').upsert(rows,{onConflict:'key'});
  if(error) throw error;
  return rows.length;
}

async function cleanupChunks(client:SupabaseClient){
  const {error}=await client.from('director_runtime_config').delete()
    .or('key.like.'+CHAR_PREFIX+'%,key.like.'+PRODUCT_PREFIX+'%');
  if(error) throw error;
}

export async function stageBonezReferenceDerivatives(
  client:SupabaseClient,
  input:{userId:string;characterBytes:Uint8Array;productBytes:Uint8Array},
){
  const lookup=await client.auth.admin.getUserById(input.userId);
  if(lookup.error||!lookup.data?.user) throw new Error('DIRECTOR_BONEZ_STAGE_USER_INVALID');
  if(sha256(input.characterBytes)!==BONEZ_REFERENCE_SHA256) throw new Error('DIRECTOR_BONEZ_REFERENCE_SHA_MISMATCH:character');
  if(sha256(input.productBytes)!==BONEZ_PRODUCT_REFERENCE_SHA256) throw new Error('DIRECTOR_BONEZ_REFERENCE_SHA_MISMATCH:product');

  await cleanupChunks(client);
  const [characterChunks,productChunks]=await Promise.all([
    writeChunks(client,CHAR_PREFIX,input.characterBytes),
    writeChunks(client,PRODUCT_PREFIX,input.productBytes),
  ]);

  const purge=await client.from('director_quality_bootstrap_tokens')
    .delete().eq('user_id',input.userId).is('consumed_at',null);
  if(purge.error) throw purge.error;

  const token=randomBytes(32).toString('base64url');
  const expiresAt=new Date(Date.now()+15*60*1000).toISOString();
  const write=await client.from('director_quality_bootstrap_tokens').insert({
    token_hash:sha256(token),user_id:input.userId,expires_at:expiresAt,
  });
  if(write.error) throw write.error;

  return {
    ok:true,
    phase:'DIRECTOR-QUALITY.2-STAGED',
    token,
    expiresAt,
    character:{sha256:BONEZ_REFERENCE_SHA256,byteSize:input.characterBytes.byteLength,chunks:characterChunks},
    product:{sha256:BONEZ_PRODUCT_REFERENCE_SHA256,byteSize:input.productBytes.byteLength,chunks:productChunks},
  };
}

export async function recordBonezVoiceAuditionCandidate(client:SupabaseClient){
  const {data,error}=await client.from('director_runtime_config').select('value')
    .eq('key',VOICE_SOURCE_KEY).maybeSingle();
  if(error) throw error;
  const sourceUrl=String(data?.value??'').trim();
  if(!sourceUrl) throw new Error('DIRECTOR_BONEZ_VOICE_SOURCE_MISSING');

  const parsed=new URL(sourceUrl);
  if(parsed.protocol!=='https:'||parsed.hostname!=='dnznrvs05pmza.cloudfront.net'||
     !parsed.pathname.endsWith('/Bonez_voice_audition_v1.mp3')){
    throw new Error('DIRECTOR_BONEZ_VOICE_SOURCE_INVALID');
  }

  const response=await fetch(sourceUrl,{redirect:'follow',cache:'no-store'});
  if(!response.ok) throw new Error('DIRECTOR_BONEZ_VOICE_FETCH_FAILED:'+response.status);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(!bytes.length) throw new Error('DIRECTOR_BONEZ_VOICE_BYTES_EMPTY');
  const digest=sha256(bytes);

  const upload=await client.storage.from('director-media').upload(
    VOICE_OBJECT_PATH,
    bytes,
    {contentType:'audio/mpeg',upsert:true,cacheControl:'0'},
  );
  if(upload.error) throw upload.error;

  const asset=await client.from('director_generated_editing_assets').upsert({
    id:VOICE_ASSET_ID,
    project_id:BONEZ_PROJECT_ID,
    generation_job_id:VOICE_TASK_ID,
    provider_id:'runway-speech',
    media_type:'audio',
    uri:'storage://director-media/'+VOICE_OBJECT_PATH,
    mime_type:'audio/mpeg',
    sha256:digest,
    model_id:'eleven_v3',
    workflow_id:null,
    workflow_version:null,
    loras:[],
    prompt:'Bonez voice audition v1',
    metadata:{
      candidate:true,
      canonical:false,
      approved:false,
      characterId:'bonez',
      durationSeconds:9.04,
      voicePreset:'Grungle',
      sourceTaskId:VOICE_TASK_ID,
      sourceKind:'synthetic-preset-audition',
      qualityClaim:false,
      transcript:'You ever notice the dead got better stories than the living? Pull up a chair. I got time.',
    },
    approval_policy:'studio_qc',
  },{onConflict:'id'})
    .select('id,project_id,media_type,uri,mime_type,sha256,provider_id,model_id,approval_policy,metadata')
    .single();
  if(asset.error) throw asset.error;

  const receipt=await client.from('director_voice_candidate_receipts').upsert({
    id:VOICE_RECEIPT_ID,
    project_id:BONEZ_PROJECT_ID,
    character_id:'bonez',
    provider:'runway',
    provider_task_id:VOICE_TASK_ID,
    model_id:'eleven_v3',
    provider_voice_ref:'Grungle',
    primary_language:'en',
    speed:0.88,
    duration_seconds:9.04,
    prompt_label:'Bonez voice audition v1',
    transcript:VOICE_REQUEST_TRANSCRIPT,
    receipt_sha256:VOICE_RECEIPT_SHA256,
    artifact_sha256:digest,
    approval_state:'candidate_unapproved',
    artifact_hash_status:'verified',
    provenance_refs:[
      'runway-task:'+VOICE_TASK_ID,
      'storage:director-media/'+VOICE_OBJECT_PATH,
      'non-cloned-preset-audition',
      'not-canonical',
      'artifact-sha256:'+digest,
    ],
    updated_at:new Date().toISOString(),
  },{onConflict:'provider,provider_task_id'});
  if(receipt.error) throw receipt.error;

  const cleanup=await client.from('director_runtime_config').delete().eq('key',VOICE_SOURCE_KEY);
  if(cleanup.error) throw cleanup.error;

  return {
    ok:true,
    phase:'DIRECTOR-QUALITY.3-VOICE-CANDIDATE',
    asset:asset.data,
    candidateReceipt:{
      id:VOICE_RECEIPT_ID,
      receiptSha256:VOICE_RECEIPT_SHA256,
      artifactSha256:digest,
      artifactHashStatus:'verified',
      approvalState:'candidate_unapproved',
    },
    approved:false,
  };
}
