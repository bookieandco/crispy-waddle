import {NextResponse} from 'next/server';
import {createConfiguredDirectorHunyuanVideoProvider} from '@/lib/director-hunyuan-video-provider';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
  const provider=createConfiguredDirectorHunyuanVideoProvider();
  if(!provider){
    return NextResponse.json({
      ok:true,
      configured:false,
      providerId:'hunyuan-video-1.5',
      status:'not-configured',
      productionReady:false,
    },{headers:{'cache-control':'no-store'}});
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
      health,
    },{headers:{'cache-control':'no-store'}});
  }catch(cause){
    return NextResponse.json({
      ok:true,
      configured:true,
      providerId:provider.id,
      status:'unavailable',
      productionReady:false,
      error:cause instanceof Error?cause.message:'DIRECTOR_HUNYUAN_HEALTH_FAILED',
    },{headers:{'cache-control':'no-store'}});
  }
}
