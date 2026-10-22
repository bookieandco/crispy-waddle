import { NextRequest, NextResponse } from 'next/server';
import { downloadOwnedCreativeImage } from '@/lib/creative-media';
import { OWNER_COOKIE } from '@/lib/platform';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = {
  'Cache-Control':'private, no-store, max-age=0',
  'Cross-Origin-Resource-Policy':'same-origin',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ outputId: string }> },
) {
  const token = request.cookies.get(OWNER_COOKIE)?.value;
  if (!token) return NextResponse.json({success:false,error:'Private creative session required.'},
    {status:401,headers:PRIVATE_HEADERS});
  const {outputId} = await context.params;
  try {
    const bytes = await downloadOwnedCreativeImage(outputId, token);
    if (!bytes) return NextResponse.json({success:false,error:'Portrait not found.'},
      {status:404,headers:PRIVATE_HEADERS});
    return new NextResponse(Buffer.from(bytes), {
      status:200,
      headers:{...PRIVATE_HEADERS,'Content-Type':'image/png','Content-Length':String(bytes.byteLength)},
    });
  } catch {
    return NextResponse.json({success:false,error:'Could not load private portrait.'},
      {status:503,headers:PRIVATE_HEADERS});
  }
}
