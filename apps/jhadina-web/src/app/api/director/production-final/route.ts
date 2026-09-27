import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { requireDirectorProjectAuthority } from '@/lib/director-project-authority';
import {
  advanceDirectorProductionFinalProgram,
  getDirectorProductionFinalProgram,
  startDirectorProductionFinalProgram,
} from '@/lib/director-production-final-service';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;

type Body={
  action?:'start'|'advance';
  programId?:string;
  sourceProjectId?:string;
  characterId?:string;
  productId?:string;
};

async function authenticated(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  return user;
}

export async function POST(request:Request){
  const user=await authenticated();
  if(!user) return NextResponse.json({ok:false,error:'Authentication required'},{status:401});

  let body:Body;
  try{ body=await request.json() as Body; }
  catch{ return NextResponse.json({ok:false,error:'Invalid JSON'},{status:400}); }

  const privileged=createServiceRoleClient();
  if(!privileged) return NextResponse.json({ok:false,error:'Director durable storage is not configured'},{status:503});

  try{
    if(body.action==='advance'){
      const programId=body.programId?.trim()??'';
      if(!programId) return NextResponse.json({ok:false,error:'programId is required'},{status:400});
      const program=await getDirectorProductionFinalProgram(privileged,user.id,programId);
      if(!program) return NextResponse.json({ok:false,error:'DIRECTOR_PRODUCTION_FINAL_PROGRAM_NOT_FOUND'},{status:404});
      await requireDirectorProjectAuthority(privileged,{
        projectId:program.sourceProjectId,userId:user.id,capability:'approve',
      });
      const advanced=await advanceDirectorProductionFinalProgram(privileged,user.id,programId);
      return NextResponse.json({
        ok:advanced.status==='passed',
        program:advanced,
        qualityClaim:advanced.status==='passed',
        ...(advanced.status!=='passed'?{
          pending:true,
          boundary:'FINAL passes only after four distinct real-production quality receipts pass deterministic Director QC.',
        }:{}),
      },{status:advanced.status==='failed'?409:200});
    }

    const sourceProjectId=body.sourceProjectId?.trim()??'';
    const characterId=body.characterId?.trim()??'';
    const productId=body.productId?.trim()??'';
    if(!sourceProjectId||!characterId||!productId){
      return NextResponse.json({
        ok:false,
        error:'sourceProjectId, characterId and productId are required',
      },{status:400});
    }
    await requireDirectorProjectAuthority(privileged,{
      projectId:sourceProjectId,userId:user.id,capability:'approve',
    });
    const program=await startDirectorProductionFinalProgram(privileged,{
      ownerUserId:user.id,
      sourceProjectId,
      characterId,
      productId,
      ...(body.programId?.trim()?{programId:body.programId.trim()}:{}),
    });
    return NextResponse.json({
      ok:program.status==='passed',
      program,
      qualityClaim:program.status==='passed',
      ...(program.status!=='passed'?{
        pending:true,
        boundary:'Rendering or runtime setup is not a cinematic-quality PASS. Advance after real provider and QC receipts are available.',
      }:{}),
    },{status:program.status==='failed'||program.status==='blocked'?409:202});
  }catch(error){
    const message=error instanceof Error?error.message:'DIRECTOR_PRODUCTION_FINAL_REQUEST_FAILED';
    const status=/ACCESS|CAPABILITY/.test(message)?403:/NOT_FOUND/.test(message)?404:409;
    return NextResponse.json({ok:false,error:message,qualityClaim:false},{status});
  }
}

export async function GET(request:Request){
  const user=await authenticated();
  if(!user) return NextResponse.json({ok:false,error:'Authentication required'},{status:401});
  const programId=new URL(request.url).searchParams.get('programId')?.trim()??'';
  if(!programId) return NextResponse.json({ok:false,error:'programId is required'},{status:400});
  const privileged=createServiceRoleClient();
  if(!privileged) return NextResponse.json({ok:false,error:'Director durable storage is not configured'},{status:503});
  const program=await getDirectorProductionFinalProgram(privileged,user.id,programId);
  if(!program) return NextResponse.json({ok:false,error:'DIRECTOR_PRODUCTION_FINAL_PROGRAM_NOT_FOUND'},{status:404});
  try{
    await requireDirectorProjectAuthority(privileged,{
      projectId:program.sourceProjectId,userId:user.id,capability:'read',
    });
  }catch(error){
    return NextResponse.json({
      ok:false,error:error instanceof Error?error.message:'DIRECTOR_PROJECT_ACCESS_DENIED',
    },{status:403});
  }
  return NextResponse.json({
    ok:true,
    program,
    qualityClaim:program.status==='passed',
  });
}
