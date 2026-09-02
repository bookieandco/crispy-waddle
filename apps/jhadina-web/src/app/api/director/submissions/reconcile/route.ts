import { NextResponse } from 'next/server';
import { createConfiguredDirectorGenerationRuntime } from '@/lib/director-generation-composition';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const client = createServiceRoleClient();
  if (!client) {
    return NextResponse.json(
      { ok: false, error: 'DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  const { reconciler } = createConfiguredDirectorGenerationRuntime(client);
  const result = await reconciler.runOnce(25);
  return NextResponse.json({ ok: true, ...result });
}
