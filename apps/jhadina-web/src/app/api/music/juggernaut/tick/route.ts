import {NextRequest,NextResponse} from 'next/server';
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity';
import {runMusicJuggernautTick} from '@/lib/music/music-juggernaut-tick';

export const dynamic='force-dynamic';

export async function POST(req:NextRequest){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const body=await req.json().catch(()=>({})) as {artistKey?:string;artistName?:string};
    const receipt=await runMusicJuggernautTick({userId:identity.userId,artistKey:body.artistKey,artistName:body.artistName});
    return NextResponse.json({success:true,data:receipt});
  }catch(error){
    const message=error instanceof Error?error.message:'Music Juggernaut tick failed';
    return NextResponse.json({success:false,error:message},{status:message.toLowerCase().includes('auth')?401:500});
  }
}
