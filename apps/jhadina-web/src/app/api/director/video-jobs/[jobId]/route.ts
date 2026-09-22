import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { getAskVideoJobForUser } from '@/lib/director-video-job-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function storageObjectPath(uri: string): string | undefined {
  const prefix = 'storage://director-media/';
  return uri.startsWith(prefix) ? uri.slice(prefix.length) : undefined;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });

  const { jobId } = await context.params;
  const job = await getAskVideoJobForUser(user.id, jobId);
  if (!job) return NextResponse.json({ ok: false, error: 'Director video job not found' }, { status: 404 });

  let previewUrl: string | undefined;
  if (job.previewAssetId) {
    const privileged = createServiceRoleClient();
    if (!privileged) return NextResponse.json({ ok: false, error: 'DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED' }, { status: 503 });

    const { data: asset, error } = await privileged
      .from('director_generated_editing_assets')
      .select('id,project_id,uri')
      .eq('id', job.previewAssetId)
      .eq('project_id', job.projectId)
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const objectPath = asset?.uri ? storageObjectPath(String(asset.uri)) : undefined;
    if (objectPath) {
      const { data: signed, error: signedError } = await privileged.storage
        .from('director-media')
        .createSignedUrl(objectPath, 3600);
      if (signedError) return NextResponse.json({ ok: false, error: signedError.message }, { status: 500 });
      previewUrl = signed?.signedUrl;
    }
  }

  return NextResponse.json({ ok: true, job, previewUrl: previewUrl ?? null });
}
