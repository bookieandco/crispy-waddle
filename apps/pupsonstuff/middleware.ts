
import { NextRequest, NextResponse } from 'next/server';
import { previewApiBlocked } from '@/lib/cloudflare-preview-policy';

/**
 * Strong view-only boundary for the first commercial-host preview.
 * No pet images, orders, AI jobs, payment webhooks or admin endpoints are
 * admitted until a separate, explicitly approved rollout.
 * In standard Vercel/production deployments this rule is inactive.
 */
export function middleware(request: NextRequest) {
  const blocked = previewApiBlocked(
    request.nextUrl.pathname,
    request.method,
    process.env.PUPSON_CLOUDFLARE_PREVIEW_ONLY === 'true',
  );
  if (blocked) {
    return NextResponse.json(
      { success: false, error: 'PupsonStuff preview is read-only.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
