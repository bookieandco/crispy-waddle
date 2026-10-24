import { NextRequest, NextResponse } from 'next/server';
import { getRecentCreativeArtwork } from '@/lib/creative-jobs';
import { OWNER_COOKIE } from '@/lib/platform';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const headers = {'Cache-Control':'private, no-store, max-age=0'};
  const ownerToken = request.cookies.get(OWNER_COOKIE)?.value;
  if (!ownerToken) return NextResponse.json({success:true,artwork:null},{headers});
  try {
    const job = await getRecentCreativeArtwork(ownerToken);
    const artwork = job?.status === 'succeeded' && job.outputId && job.previewUrl ? {
      petIdentityId:job.petIdentityId,
      petName:job.petName,
      creativeOutputId:job.outputId,
      previewUrl:job.previewUrl,
    } : null;
    return NextResponse.json({success:true,artwork},{headers});
  } catch {
    return NextResponse.json({success:false,error:'Private artwork is temporarily unavailable.'},
      {status:503,headers});
  }
}
