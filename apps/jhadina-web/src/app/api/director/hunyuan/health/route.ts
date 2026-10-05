import {NextResponse} from 'next/server';
import {enforceArtifactDeployment} from '@jhadina/reference-provenance';
import {createConfiguredDirectorHunyuanVideoProvider,createDirectorHunyuanHealthProvider} from '@/lib/director-hunyuan-video-provider';
import {createRuntimeServiceRoleClient} from '@/lib/supabase/service-role';
import {loadDirectorGenerationArtifactDeployment} from '@/lib/director-generation-artifact-deployment';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
  const provider=await createDirectorHunyuanHealthProvider();
  const generationEnabled=Boolean(await createConfiguredDirectorHunyuanVideoProvider());
  let governedGenerationReady=false;
  let governedGenerationError:string|undefined;
  const client=await createRuntimeServiceRoleClient();
  if(!client){
    governedGenerationError='DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED';
  }else{
    try{
      const deployment=await loadDirectorGenerationArtifactDeployment(client);
      await enforceArtifactDeployment(deployment.ledger,deployment.requirement,deployment.verifiedAt);
      governedGenerationReady=true;
    }catch(cause){
      governedGenerationError=cause instanceof Error?cause.message:'DIRECTOR_ARTIFACT_DEPLOYMENT_PROOF_FAILED';
    }
  }
  try{
    const health=await provider.health();
    const productionReady=health.status==='ready'&&health.productionReady===true;
    return NextResponse.json({
      ok:true,
      configured:true,
      providerId:provider.id,
      status:productionReady?'ready':String(health.status??'blocked'),
      productionReady,
      generationEnabled,
      governedGenerationReady,
      ...(governedGenerationError?{governedGenerationError}:{}),
      health,
    },{headers:{'cache-control':'no-store'}});
  }catch(cause){
    return NextResponse.json({
      ok:true,
      configured:true,
      providerId:provider.id,
      status:'unavailable',
      productionReady:false,
      generationEnabled,
      governedGenerationReady,
      ...(governedGenerationError?{governedGenerationError}:{}),
      error:cause instanceof Error?cause.message:'DIRECTOR_HUNYUAN_HEALTH_FAILED',
    },{headers:{'cache-control':'no-store'}});
  }
}
