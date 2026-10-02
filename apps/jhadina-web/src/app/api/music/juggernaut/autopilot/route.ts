import {NextRequest,NextResponse} from 'next/server';
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity';
import {runMusicAutopilot} from '@/lib/music/music-autopilot-service';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type Body={artistKey?:unknown;artistName?:unknown;runKey?:unknown};

export async function POST(req:NextRequest){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const body=await req.json().catch(()=>({})) as Body;
    const data=await runMusicAutopilot({
      userId:identity.userId,
      artistKey:text(body.artistKey)||undefined,
      artistName:text(body.artistName)||undefined,
      runKey:text(body.runKey)||undefined,
    });
    return NextResponse.json({success:true,data});
  }catch(error){
    const message=error instanceof Error?error.message:'Music autopilot run failed';
    const status=/identity|session|signed in|authentication/i.test(message)?401
      :/LEASE_UNAVAILABLE/.test(message)?409
        :/NOT_CONFIGURED|not configured/i.test(message)?503
          :422;
    return NextResponse.json({success:false,error:message},{status});
  }
}

function text(value:unknown):string{
  return typeof value==='string'?value.trim():'';
}
