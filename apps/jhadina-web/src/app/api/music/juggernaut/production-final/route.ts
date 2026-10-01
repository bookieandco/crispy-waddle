import {NextRequest,NextResponse} from 'next/server';
import {certifyMusicJuggernautProductionFinal} from '@jhadina/growth-core';
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity';
import {loadMusicJuggernautProjection} from '@/lib/music/music-juggernaut-service';

export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const artistKey=req.nextUrl.searchParams.get('artistKey')?.trim()||'atwood-bookie';
    const certification=certifyMusicJuggernautProductionFinal();
    const projection=await loadMusicJuggernautProjection({userId:identity.userId,artistKey});
    return NextResponse.json({
      success:true,
      data:{
        version:certification.version,
        productionCertified:certification.passed,
        certification,
        durableRuntimeReachable:true,
        projectPresent:Boolean(projection),
        runtimeDataState:projection?'PROJECT_AVAILABLE':'NO_PROJECT_DATA',
        currentMode:projection?.mode??'SEARCH',
        dataWarnings:projection?.dataWarnings??[],
        externalActionsStarted:false,
        authority:'CERTIFICATION_ONLY',
      },
    });
  }catch(error){
    const message=error instanceof Error?error.message:'Music Juggernaut production certification failed';
    return NextResponse.json({success:false,error:message},{status:message.toLowerCase().includes('auth')?401:500});
  }
}
