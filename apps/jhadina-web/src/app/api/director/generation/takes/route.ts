import { NextResponse } from 'next/server';
import type { PlannedGeneration } from '@jhadina/director-core';
import { createConfiguredDirectorGenerationRuntime } from '@/lib/director-generation-composition';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  projectId:string; runId:string; gateId:string;
  take:{takeId:string;sceneId:string;storyboardBoardId:string;prompt:string;locked?:('character'|'location'|'performance'|'camera'|'lighting'|'wardrobe')[];referenceCharacterIds?:string[];referenceAssetIds?:string[];targetRuntimeSeconds?:number};
  plan:PlannedGeneration;
};
function isBody(v:unknown):v is Body { if(!v||typeof v!=='object')return false; const b=v as Partial<Body>; return typeof b.projectId==='string'&&typeof b.runId==='string'&&typeof b.gateId==='string'&&!!b.take&&!!b.plan&&typeof b.take.takeId==='string'&&typeof b.take.sceneId==='string'&&typeof b.take.storyboardBoardId==='string'&&typeof b.take.prompt==='string'&&typeof b.plan.modelId==='string'; }

export async function POST(request:Request){
  const secret=process.env.DIRECTOR_API_SECRET;
  if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`) return NextResponse.json({ok:false},{status:401});
  const client=createServiceRoleClient(); if(!client)return NextResponse.json({ok:false,error:'DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED'},{status:503});
  let raw:unknown; try{raw=await request.json();}catch{return NextResponse.json({ok:false,error:'DIRECTOR_INVALID_JSON'},{status:400});}
  if(!isBody(raw))return NextResponse.json({ok:false,error:'DIRECTOR_INVALID_TAKE_REQUEST'},{status:400});
  try{
    const rt=await createConfiguredDirectorGenerationRuntime(client);
    if(!rt.hasModel(raw.plan.modelId))return NextResponse.json({ok:false,error:'DIRECTOR_MODEL_NOT_REGISTERED'},{status:400});
    const authority=await rt.authority.resolve({projectId:raw.projectId,runId:raw.runId,gateId:raw.gateId,storyboardBoardId:raw.take.storyboardBoardId});
    const take={...raw.take,projectId:raw.projectId,locked:raw.take.locked??[],referenceCharacterIds:raw.take.referenceCharacterIds??[],referenceAssetIds:raw.take.referenceAssetIds??[]};
    const job=await rt.generation.submitTake(take,raw.plan,{run:authority.run,gate:authority.gate,storyboardStage:authority.storyboardStage,generationStage:authority.generationStage});
    return NextResponse.json({ok:true,job},{status:202});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'DIRECTOR_GENERATION_SUBMISSION_FAILED'},{status:409});}
}
