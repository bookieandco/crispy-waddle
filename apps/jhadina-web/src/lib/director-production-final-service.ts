import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DIRECTOR_PRODUCTION_FINAL_PROGRAM,
  deriveDirectorProductionFinalProgramStatus,
  resolveCharacterSceneIdentity,
  validateProductIdentityBible,
  type DirectorProductionFinalFixtureRun,
  type DirectorProductionFinalProgramRun,
  type ProductIdentityBible,
} from '@jhadina/director-core';
import { loadDirectorCastRecord } from '@/lib/director-cast-repository';
import {
  SupabaseDirectorCharacterReferenceAssetResolver,
  SupabaseDirectorProductReferenceAssetResolver,
} from '@/lib/director-reference-asset-resolver';
import { createAndSubmitAskVideoJob } from '@/lib/director-video-job-service';
import { reconcileDirectorVideoJobs } from '@/lib/director-video-job-reconciler';
import { DirectorProductionFinalRepository } from '@/lib/director-production-final-repository';

type ProgramRow={
  id:string;
  owner_user_id:string;
  source_project_id:string;
  character_id:string;
  product_id:string|null;
  status:DirectorProductionFinalProgramRun['status'];
  fixtures:DirectorProductionFinalFixtureRun[]|null;
  evidence_ids:string[]|null;
  error:string|null;
  created_at:string;
  updated_at:string;
};

function toRun(row:ProgramRow):DirectorProductionFinalProgramRun{
  return Object.freeze({
    id:row.id,
    ownerUserId:row.owner_user_id,
    sourceProjectId:row.source_project_id,
    characterId:row.character_id,
    ...(row.product_id?{productId:row.product_id}:{}),
    status:row.status,
    fixtures:Object.freeze([...(row.fixtures??[])]),
    evidenceIds:Object.freeze([...(row.evidence_ids??[])]),
    createdAt:row.created_at,
    updatedAt:row.updated_at,
    authority:'DIRECTOR_PRODUCTION_FINAL_PROGRAM',
  });
}

async function loadProgram(client:SupabaseClient,id:string,ownerUserId:string):Promise<DirectorProductionFinalProgramRun|undefined>{
  const {data,error}=await client.from('director_production_final_programs')
    .select('*').eq('id',id).eq('owner_user_id',ownerUserId).maybeSingle();
  if(error) throw error;
  return data?toRun(data as ProgramRow):undefined;
}

async function loadProductBible(
  client:SupabaseClient,
  sourceProjectId:string,
  productId:string,
):Promise<ProductIdentityBible>{
  const {data,error}=await client.from('director_product_bibles')
    .select('bible')
    .eq('project_id',sourceProjectId)
    .eq('product_id',productId)
    .order('updated_at',{ascending:false})
    .limit(1)
    .maybeSingle();
  if(error) throw error;
  if(!data?.bible) throw new Error('DIRECTOR_PRODUCTION_FINAL_PRODUCT_BIBLE_REQUIRED');
  const bible=data.bible as ProductIdentityBible;
  const reasons=validateProductIdentityBible(bible);
  if(reasons.length) throw new Error(`DIRECTOR_PRODUCTION_FINAL_PRODUCT_BIBLE_INVALID:${reasons.join(',')}`);
  return bible;
}

export async function startDirectorProductionFinalProgram(
  client:SupabaseClient,
  input:{ownerUserId:string;sourceProjectId:string;characterId:string;productId:string;programId?:string},
):Promise<DirectorProductionFinalProgramRun>{
  const programId=input.programId?.trim()||`director-production-final:${randomUUID()}`;
  const existing=await loadProgram(client,programId,input.ownerUserId);
  if(existing) return existing;

  const cast=await loadDirectorCastRecord(client,{projectId:input.sourceProjectId,characterId:input.characterId});
  const resolved=resolveCharacterSceneIdentity(cast,{
    projectId:input.sourceProjectId,
    characterId:input.characterId,
    continuityRef:cast.continuityRef,
    appearanceVariantId:cast.canonicalAppearanceVariantId,
    ...(cast.voice?{
      voiceIdentityId:cast.voice.voiceIdentityId,
      voiceVariantId:cast.voice.defaultVariantId,
      language:cast.voice.primaryLanguage,
    }:{}),
  });
  if(!cast.voice) throw new Error('DIRECTOR_PRODUCTION_FINAL_MOVIE_GRADE_VOICE_REQUIRED');

  const product=await loadProductBible(client,input.sourceProjectId,input.productId);
  const characterResolver=new SupabaseDirectorCharacterReferenceAssetResolver(client);
  const productResolver=new SupabaseDirectorProductReferenceAssetResolver(client);
  const characterUris=await Promise.all(
    resolved.referenceAssetIds.map(async(assetId)=>(await characterResolver.resolve(assetId,input.sourceProjectId)).uri),
  );
  const productUris=await Promise.all(
    product.referenceViews.map(async(view)=>(await productResolver.resolve(view.assetId,input.sourceProjectId)).uri),
  );

  const now=new Date().toISOString();
  const {error:createError}=await client.from('director_production_final_programs').insert({
    id:programId,
    owner_user_id:input.ownerUserId,
    source_project_id:input.sourceProjectId,
    character_id:input.characterId,
    product_id:input.productId,
    status:'launching',
    fixtures:[],
    evidence_ids:[`source-project:${input.sourceProjectId}`,cast.id,product.id],
    created_at:now,
    updated_at:now,
  });
  if(createError) throw createError;

  const fixtureRuns:DirectorProductionFinalFixtureRun[]=[];
  for(const fixture of DIRECTOR_PRODUCTION_FINAL_PROGRAM){
    try{
      const job=await createAndSubmitAskVideoJob({
        userId:input.ownerUserId,
        activeTask:fixture.prompt,
        clientRequestId:`${programId}:${fixture.kind}`,
        productionQuality:true,
        referenceCharacter:{
          characterId:input.characterId,
          continuityRef:resolved.continuityRef,
          appearanceVariantId:resolved.sceneAppearanceVariantId,
          referenceAssetIds:[...resolved.referenceAssetIds],
          referenceSha256s:[...resolved.referenceSha256s],
          referenceUris:characterUris,
          productionPlan:{
            program:'DIRECTOR-PRODUCTION.FINAL',
            fixtureKind:fixture.kind,
            requiredProductionSignals:[...fixture.requiredProductionSignals],
            requiresDialogue:fixture.requiresDialogue,
            sourceProjectId:input.sourceProjectId,
          },
        },
        ...(fixture.requiresProductReference?{
          referenceProduct:{
            productId:input.productId,
            productBibleId:product.id,
            canonicalVariantId:product.canonicalVariantId,
            referenceAssetIds:product.referenceViews.map(view=>view.assetId),
            referenceSha256s:product.referenceViews.map(view=>view.sha256),
            referenceUris:productUris,
            labelAuthorities:product.labelAuthorities.map(authority=>({text:authority.text,surface:authority.surface})),
          },
        }:{}),
      });
      fixtureRuns.push({
        kind:fixture.kind,
        projectId:job.job.projectId,
        videoJobId:job.job.id,
        status:job.job.status==='blocked'?'blocked':job.job.status==='failed'?'failed':'rendering',
        ...(job.job.error?{error:job.job.error}:{}),
      });
    }catch(error){
      fixtureRuns.push({
        kind:fixture.kind,
        projectId:`unlaunched:${fixture.kind}`,
        videoJobId:`unlaunched:${fixture.kind}`,
        status:'failed',
        error:error instanceof Error?error.message:'DIRECTOR_PRODUCTION_FINAL_FIXTURE_LAUNCH_FAILED',
      });
    }
  }

  const status=deriveDirectorProductionFinalProgramStatus(fixtureRuns);
  const firstError=fixtureRuns.find(fixture=>fixture.error)?.error??null;
  const {error:updateError}=await client.from('director_production_final_programs').update({
    status,
    fixtures:fixtureRuns,
    error:firstError,
    updated_at:new Date().toISOString(),
  }).eq('id',programId).eq('owner_user_id',input.ownerUserId);
  if(updateError) throw updateError;
  return (await loadProgram(client,programId,input.ownerUserId))!;
}

export async function advanceDirectorProductionFinalProgram(
  client:SupabaseClient,
  ownerUserId:string,
  programId:string,
):Promise<DirectorProductionFinalProgramRun>{
  const current=await loadProgram(client,programId,ownerUserId);
  if(!current) throw new Error('DIRECTOR_PRODUCTION_FINAL_PROGRAM_NOT_FOUND');
  if(current.status==='passed'||current.status==='failed') return current;

  await reconcileDirectorVideoJobs(client,{limit:25});
  const ids=current.fixtures.map(fixture=>fixture.videoJobId).filter(id=>!id.startsWith('unlaunched:'));
  const {data,error}=ids.length
    ? await client.from('director_video_jobs').select('id,project_id,status,error').in('id',ids)
    : {data:[],error:null};
  if(error) throw error;
  const byId=new Map((data??[]).map(row=>[String(row.id),row]));
  const fixtureRuns=current.fixtures.map((fixture)=>{
    const row=byId.get(fixture.videoJobId) as {status?:string;error?:string|null}|undefined;
    if(!row) return fixture;
    const status:DirectorProductionFinalFixtureRun['status']=
      row.status==='failed'?'failed':
      row.status==='blocked'?'blocked':
      row.status==='preview_ready'?'awaiting-quality-evidence':
      'rendering';
    return Object.freeze({
      ...fixture,
      status,
      ...(row.error?{error:String(row.error)}:{}),
    });
  });

  const repository=new DirectorProductionFinalRepository(client);
  const expectedProjects=Object.fromEntries(
    fixtureRuns.map((fixture)=>[fixture.kind,fixture.projectId]),
  ) as Readonly<Partial<Record<(typeof fixtureRuns)[number]['kind'],string>>>;
  const matrix=await repository.evaluatePersistedFinalMatrix(ownerUserId,expectedProjects);
  if(matrix.admissible){
    const passed=fixtureRuns.map(fixture=>Object.freeze({...fixture,status:'passed' as const,error:undefined}));
    const {error:passError}=await client.from('director_production_final_programs').update({
      status:'passed',
      fixtures:passed,
      evidence_ids:[...new Set([...current.evidenceIds,'DIRECTOR-PRODUCTION.FINAL:QUALITY-MATRIX:PASS'])],
      error:null,
      updated_at:new Date().toISOString(),
    }).eq('id',programId).eq('owner_user_id',ownerUserId);
    if(passError) throw passError;
    return (await loadProgram(client,programId,ownerUserId))!;
  }

  const status=deriveDirectorProductionFinalProgramStatus(fixtureRuns);
  const firstError=fixtureRuns.find(fixture=>fixture.error)?.error??null;
  const {error:updateError}=await client.from('director_production_final_programs').update({
    status,
    fixtures:fixtureRuns,
    error:firstError,
    updated_at:new Date().toISOString(),
  }).eq('id',programId).eq('owner_user_id',ownerUserId);
  if(updateError) throw updateError;
  return (await loadProgram(client,programId,ownerUserId))!;
}

export async function getDirectorProductionFinalProgram(
  client:SupabaseClient,
  ownerUserId:string,
  programId:string,
):Promise<DirectorProductionFinalProgramRun|undefined>{
  return loadProgram(client,programId,ownerUserId);
}
