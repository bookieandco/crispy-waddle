import { NextRequest, NextResponse } from 'next/server';
import { animatePetPortrait } from '@/lib/animation';
import { downloadOwnedCreativeImage } from '@/lib/creative-media';
import { OWNER_COOKIE } from '@/lib/platform';

export const runtime = 'nodejs';

/** The old route accepted arbitrary base64 and had no owner or cost guard.
 * Animate only an already-persisted portrait belonging to this cookie.
 * External image-to-video remains disabled until explicitly approved.
 */
export async function POST(request: NextRequest) {
  if (process.env.PUPSON_ANIMATION_APPROVED !== 'true' ||
      process.env.PUPSON_CREATIVE_JOBS_ENABLED !== 'true') {
    return NextResponse.json({success:false,error:'Animation is not activated on this private prototype.'},
      {status:503,headers:{'Cache-Control':'no-store'}});
  }
  const ownerToken = request.cookies.get(OWNER_COOKIE)?.value;
  if (!ownerToken) return NextResponse.json({success:false,error:'Creative session required.'},
    {status:401,headers:{'Cache-Control':'no-store'}});
  try {
    const body = await request.json() as {creativeOutputId?:unknown};
    if (typeof body.creativeOutputId !== 'string') {
      return NextResponse.json({success:false,error:'An approved session portrait is required.'},
        {status:400,headers:{'Cache-Control':'no-store'}});
    }
    const bytes = await downloadOwnedCreativeImage(body.creativeOutputId,ownerToken);
    if (!bytes) return NextResponse.json({success:false,error:'Portrait not found.'},
      {status:404,headers:{'Cache-Control':'no-store'}});
    const result = await animatePetPortrait({
      imageBuffer:Buffer.from(bytes),imageMimeType:'image/png'
    });
    if (!result.success) return NextResponse.json(
      {success:false,error:'Animation provider could not complete this preview.'},
      {status:502,headers:{'Cache-Control':'no-store'}});
    return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}});
  } catch {
    return NextResponse.json({success:false,error:'Animation is temporarily unavailable.'},
      {status:503,headers:{'Cache-Control':'no-store'}});
  }
}
