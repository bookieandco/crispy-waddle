import {NextRequest,NextResponse} from 'next/server';
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity';
import {perceiveSongSectionsIntoJuggernaut} from '@/lib/music/music-section-perception-bridge';
import {createServiceRoleClient} from '@/lib/supabase/service-role';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type Body={
  artistKey?:unknown;
  songId?:unknown;
  caseId?:unknown;
  artifactId?:unknown;
  minimumConfidence?:unknown;
};

export async function POST(req:NextRequest){
  const claimedUserId=req.headers.get('x-jhadina-user-id')?.trim();
  try{
    const identity=await (await createRequestIdentityVerifier()).verify(
      claimedUserId?{userId:claimedUserId}:{},
    );
    const body=await req.json() as Body;
    const artistKey=text(body.artistKey)||'atwood-bookie';
    const songId=text(body.songId);
    const caseId=text(body.caseId);
    const artifactId=text(body.artifactId);
    if(!songId||!caseId||!artifactId){
      return NextResponse.json({success:false,error:'songId, caseId and artifactId are required'},{status:400});
    }
    const client=createServiceRoleClient();
    if(!client)throw new Error('MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED');
    const minimumConfidence=body.minimumConfidence===undefined?undefined:Number(body.minimumConfidence);
    if(minimumConfidence!==undefined&&(!Number.isFinite(minimumConfidence)||minimumConfidence<0||minimumConfidence>1)){
      return NextResponse.json({success:false,error:'minimumConfidence must be between 0 and 1'},{status:400});
    }
    const data=await perceiveSongSectionsIntoJuggernaut({
      client,
      userId:identity.userId,
      artistKey,
      songId,
      caseId,
      artifactId,
      minimumConfidence,
    });
    return NextResponse.json({success:true,data});
  }catch(error){
    const message=error instanceof Error?error.message:'Music section perception failed';
    const status=/identity|session|signed in|authentication/i.test(message)?401
      :/NOT_FOUND|not found/i.test(message)?404
        :/NOT_CONFIGURED|not configured|bearer token|required/i.test(message)?503
          :/NO_ADMITTED_SECTIONS/i.test(message)?409
            :422;
    return NextResponse.json({success:false,error:message},{status});
  }
}

function text(value:unknown):string{
  return typeof value==='string'?value.trim():'';
}
