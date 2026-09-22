import { NextResponse } from 'next/server';
import {
  validateProductIdentityBible,
  type ProductIdentityBible,
} from '@jhadina/director-core';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { requireDirectorProjectAuthority } from '@/lib/director-project-authority';
import { SupabaseDirectorProductReferenceAssetResolver } from '@/lib/director-reference-asset-resolver';
import {
  createAndSubmitAskVideoJob,
  inspectAskVideoIntent,
} from '@/lib/director-video-job-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  projectId?: string;
  productId?: string;
  productBibleId?: string;
  prompt?: string;
  clientRequestId?: string;
  targetDurationSeconds?: number;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  mode?: 'standard' | 'short' | 'faceless' | 'long-form';
};

function buildVideoCommand(body: Body): string {
  const prompt = body.prompt?.trim() ?? '';
  if (inspectAskVideoIntent(prompt)) return prompt;
  const mode = body.mode === 'short' ? 'short video' : body.mode === 'long-form' ? 'long-form video' : 'video';
  const duration = Number.isFinite(body.targetDurationSeconds)
    ? ` ${Math.max(1, Math.min(3600, Number(body.targetDurationSeconds)))} seconds`
    : '';
  const aspect = body.aspectRatio ? ` ${body.aspectRatio}` : '';
  return `Create a${duration} ${mode}${aspect}: ${prompt}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });

  let body: Body;
  try {
    body = await request.json() as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const projectId = body.projectId?.trim() ?? '';
  const productId = body.productId?.trim() ?? '';
  const prompt = body.prompt?.trim() ?? '';
  if (!projectId || !productId || !prompt) {
    return NextResponse.json({ ok: false, error: 'projectId, productId and prompt are required' }, { status: 400 });
  }

  const privileged = createServiceRoleClient();
  if (!privileged) return NextResponse.json({ ok: false, error: 'Director durable storage is not configured' }, { status: 503 });

  try {
    await requireDirectorProjectAuthority(privileged, { projectId, userId: user.id, capability: 'edit' });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'DIRECTOR_PROJECT_ACCESS_DENIED' },
      { status: 403 },
    );
  }

  let query = privileged
    .from('director_product_bibles')
    .select('id,project_id,product_id,canonical_variant_id,bible')
    .eq('project_id', projectId)
    .eq('product_id', productId);

  if (body.productBibleId?.trim()) query = query.eq('id', body.productBibleId.trim());

  const { data: row, error: bibleError } = await query
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bibleError) return NextResponse.json({ ok: false, error: bibleError.message }, { status: 500 });
  if (!row) return NextResponse.json({ ok: false, error: 'DIRECTOR_PRODUCT_BIBLE_NOT_FOUND' }, { status: 404 });

  const bible = row.bible as ProductIdentityBible;
  const errors = validateProductIdentityBible(bible);
  if (errors.length) {
    return NextResponse.json({ ok: false, error: `DIRECTOR_PRODUCT_BIBLE_INVALID:${errors.join(';')}` }, { status: 409 });
  }

  const activeTask = buildVideoCommand(body);
  const intent = inspectAskVideoIntent(activeTask);
  if (!intent) return NextResponse.json({ ok: false, error: 'DIRECTOR_VIDEO_INTENT_NOT_DETECTED' }, { status: 400 });

  const resolver = new SupabaseDirectorProductReferenceAssetResolver(privileged);
  let referenceUris: string[];
  try {
    referenceUris = await Promise.all(
      bible.referenceViews.map(async (view) => (await resolver.resolve(view.assetId, projectId)).uri),
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'DIRECTOR_PRODUCT_REFERENCE_RESOLUTION_FAILED' },
      { status: 409 },
    );
  }

  const result = await createAndSubmitAskVideoJob({
    userId: user.id,
    activeTask,
    activeProject: projectId,
    clientRequestId: body.clientRequestId,
    referenceProduct: {
      productId,
      productBibleId: bible.id,
      canonicalVariantId: bible.canonicalVariantId,
      referenceAssetIds: bible.referenceViews.map((view) => view.assetId),
      referenceSha256s: bible.referenceViews.map((view) => view.sha256),
      referenceUris,
      labelAuthorities: bible.labelAuthorities.map((authority) => ({
        text: authority.text,
        surface: authority.surface,
      })),
    },
  });

  const blocked = result.job.status === 'blocked' || result.job.status === 'failed';
  return NextResponse.json({
    ok: !blocked,
    productId,
    productBibleId: bible.id,
    canonicalVariantId: bible.canonicalVariantId,
    videoJob: result.job,
    ...(blocked ? {
      error: result.job.error,
      requirement: 'Configure a product-reference-aware Director video provider; generic providers are intentionally excluded.',
    } : {}),
  }, { status: blocked ? 409 : 202 });
}
