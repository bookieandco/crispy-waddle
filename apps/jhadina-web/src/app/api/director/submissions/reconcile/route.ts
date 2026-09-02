import { NextResponse } from 'next/server';
import { createConfiguredDirectorGenerationRuntime } from '@/lib/director-generation-composition';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const client = await createSupabaseServerClient();
  const { reconciler } = createConfiguredDirectorGenerationRuntime(client);
  const result = await reconciler.runOnce(25);
  return NextResponse.json({ ok: true, ...result });
}
