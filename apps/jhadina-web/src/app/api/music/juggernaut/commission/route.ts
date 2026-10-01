import {NextResponse} from 'next/server';
import {createRequestIdentityVerifier} from '@/lib/auth/request-identity';
import {
  loadAtwoodBookieCommissioningStatus,
  runAtwoodBookieCommissioning,
} from '@/lib/music/music-commissioning-service';

export const dynamic='force-dynamic';

export async function GET(){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const data=await loadAtwoodBookieCommissioningStatus({userId:identity.userId});
    return NextResponse.json({success:true,data});
  }catch(error){
    const message=error instanceof Error?error.message:'Unable to load Music commissioning status';
    return NextResponse.json({success:false,error:message},{status:message.toLowerCase().includes('auth')?401:500});
  }
}

export async function POST(){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({});
    const data=await runAtwoodBookieCommissioning({userId:identity.userId});
    return NextResponse.json({success:true,data});
  }catch(error){
    const message=error instanceof Error?error.message:'Music commissioning failed';
    return NextResponse.json({success:false,error:message},{status:message.toLowerCase().includes('auth')?401:500});
  }
}
