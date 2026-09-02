import { NextResponse } from 'next/server';
import { runDirectorSubmissionReconciliation } from '@/lib/director-submission-reconciliation';
import { createDirectorGenerationProviders } from '@/lib/director-generation-provider-factory';
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
  const providers = createDirectorGenerationProviders();
  const result = await runDirectorSubmissionReconciliation(client, providers);
  return NextResponse.json({ ok: true, ...result });
}
