import {NextResponse} from 'next/server';
import {createConfiguredDirectorHunyuanVideoProvider,createDirectorHunyuanHealthProvider} from '@/lib/director-hunyuan-video-provider';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
  const provider=createDirectorHunyuanHealthProvider();
  const generationEnabled=Boolean(createConfiguredDirectorHunyuanVideoProvider());
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
      error:cause instanceof Error?cause.message:'DIRECTOR_HUNYUAN_HEALTH_FAILED',
    },{headers:{'cache-control':'no-store'}});
  }
}
