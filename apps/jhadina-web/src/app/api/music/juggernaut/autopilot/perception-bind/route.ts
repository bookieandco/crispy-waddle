import {NextRequest,NextResponse} from 'next/server';
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity';
import {createClient} from '@/lib/supabase/server';
import {loadMusicJuggernautProjection} from '@/lib/music/music-juggernaut-service';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type Body={
  artistKey?:unknown;
  songId?:unknown;
  caseId?:unknown;
  artifactId?:unknown;
  minimumConfidence?:unknown;
  enabled?:unknown;
};

export async function POST(req:NextRequest){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const body=await req.json() as Body;
    const artistKey=text(body.artistKey)||'atwood-bookie';
    const songId=text(body.songId),caseId=text(body.caseId),artifactId=text(body.artifactId);
    if(!songId||!caseId||!artifactId){
      return NextResponse.json({success:false,error:'songId, caseId and artifactId are required'},{status:400});
    }
    const confidence=body.minimumConfidence===undefined?0.5:Number(body.minimumConfidence);
    if(!Number.isFinite(confidence)||confidence<0||confidence>1){
      return NextResponse.json({success:false,error:'minimumConfidence must be between 0 and 1'},{status:400});
    }
    const projection=await loadMusicJuggernautProjection({userId:identity.userId,artistKey,initialize:true});
    if(!projection)return NextResponse.json({success:false,error:'Music Juggernaut project not found'},{status:404});
    if(!projection.songs.some((song)=>String(song.id)===songId)){
      return NextResponse.json({success:false,error:'Song not found in this Music project'},{status:404});
    }
    const db=await createClient();
    const {data,error}=await db.rpc('jhadina_music_perception_bind',{
      p_project_id:String(projection.project.id),
      p_song_id:songId,
      p_case_id:caseId,
      p_artifact_id:artifactId,
      p_minimum_confidence:confidence,
      p_enabled:typeof body.enabled==='boolean'?body.enabled:true,
    }).single();
    if(error||!data)throw new Error('MUSIC_PERCEPTION_BINDING_WRITE_FAILED:'+(error?.message??'missing'));
    return NextResponse.json({success:true,data});
  }catch(error){
    const message=error instanceof Error?error.message:'Music perception binding failed';
    const status=/identity|session|signed in|authentication/i.test(message)?401
      :/NOT_FOUND|not found/i.test(message)?404
        :/REQUIRED|INVALID|between 0 and 1/i.test(message)?400
          :/NOT_CONFIGURED|not configured/i.test(message)?503
            :422;
    return NextResponse.json({success:false,error:message},{status});
  }
}
function text(value:unknown):string{return typeof value==='string'?value.trim():'';}
