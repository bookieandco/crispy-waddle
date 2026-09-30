import {NextRequest,NextResponse} from 'next/server';
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity';
import {loadMusicJuggernautProjection} from '@/lib/music/music-juggernaut-service';
import {stageMusicCreativePresence} from '@/lib/music/music-presence-bridge';

export const dynamic='force-dynamic';

export async function POST(req:NextRequest){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const body=await req.json() as {artistKey?:string;briefId?:string;destinationUrl?:string};
    const artistKey=body.artistKey?.trim()||'atwood-bookie';
    const projection=await loadMusicJuggernautProjection({userId:identity.userId,artistKey});
    if(!projection)return NextResponse.json({success:false,error:'Music Juggernaut project not found'},{status:404});
    const brief=projection.creativePortfolio?.briefs.find((item)=>item.id===body.briefId)??projection.creativePortfolio?.briefs[0];
    const song=projection.rankedSongs[0];
    if(!brief||!song)return NextResponse.json({success:false,error:'No evidence-backed creative brief is ready'},{status:409});
    const metadata=projection.project.metadata&&typeof projection.project.metadata==='object'&&!Array.isArray(projection.project.metadata)?projection.project.metadata as Record<string,unknown>:{};
    const stored=await stageMusicCreativePresence({
      userId:identity.userId,
      brandId:typeof metadata.brandId==='string'?metadata.brandId:undefined,
      song:{id:song.id,title:song.title,evidenceRefs:song.evidenceRefs},
      brief,
      destinationUrl:body.destinationUrl,
    });
    return NextResponse.json({success:true,data:{presenceCampaign:stored,authority:'MARKETING_STRATEGY_ONLY',externalPublishStarted:false}});
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to stage Music creative';
    return NextResponse.json({success:false,error:message},{status:message.toLowerCase().includes('auth')?401:500});
  }
}
