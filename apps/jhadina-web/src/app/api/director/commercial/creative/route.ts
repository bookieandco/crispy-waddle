import { NextResponse } from 'next/server';
import {
  createCommercialCreativeConcept,
  validateProductIdentityBible,
  validateVisualStyleBible,
  type CommercialCreativeConcept,
  type ProductIdentityBible,
  type VisualStyleBible,
} from '@jhadina/director-core';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { requireDirectorProjectAuthority } from '@/lib/director-project-authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  projectId?: string;
  productBibleId?: string;
  styleBible?: VisualStyleBible;
  concept?: Omit<CommercialCreativeConcept, 'authority'> | CommercialCreativeConcept;
  sourceContentProjectId?: string;
  sourceSocialAssetId?: string;
};

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
  const productBibleId = body.productBibleId?.trim() ?? '';
  const styleBible = body.styleBible;
  const conceptInput = body.concept;
  if (!projectId || !productBibleId || !styleBible || !conceptInput) {
    return NextResponse.json({
      ok: false,
      error: 'projectId, productBibleId, styleBible and concept are required',
    }, { status: 400 });
  }

  const privileged = createServiceRoleClient();
  if (!privileged) {
    return NextResponse.json({ ok: false, error: 'Director durable storage is not configured' }, { status: 503 });
  }

  try {
    await requireDirectorProjectAuthority(privileged, { projectId, userId: user.id, capability: 'edit' });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'DIRECTOR_PROJECT_ACCESS_DENIED' },
      { status: 403 },
    );
  }

  if (styleBible.projectId !== projectId || conceptInput.projectId !== projectId) {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_AD_PROJECT_MISMATCH' }, { status: 409 });
  }

  const { data: productBibleRow, error: productBibleReadError } = await privileged
    .from('director_product_bibles')
    .select('id,project_id,product_id,canonical_variant_id,bible')
    .eq('id', productBibleId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (productBibleReadError) {
    return NextResponse.json({ ok: false, error: productBibleReadError.message }, { status: 500 });
  }
  if (!productBibleRow) {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_AD_PRODUCT_BIBLE_NOT_FOUND' }, { status: 404 });
  }

  const productBible = productBibleRow.bible as ProductIdentityBible;
  const productErrors = validateProductIdentityBible(productBible);
  const styleErrors = validateVisualStyleBible(styleBible);
  if (productErrors.length || styleErrors.length) {
    return NextResponse.json({
      ok: false,
      error: 'DIRECTOR_AD_BIBLE_INVALID',
      productErrors,
      styleErrors,
    }, { status: 400 });
  }

  let concept: CommercialCreativeConcept;
  try {
    const withoutAuthority = Object.fromEntries(
      Object.entries(conceptInput).filter(([key]) => key !== 'authority'),
    ) as Omit<CommercialCreativeConcept, 'authority'>;
    concept = createCommercialCreativeConcept(withoutAuthority);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'DIRECTOR_AD_CONCEPT_INVALID' },
      { status: 400 },
    );
  }

  if (concept.productBibleId !== productBibleId || concept.styleBibleId !== styleBible.id) {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_AD_BIBLE_MISMATCH' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data, error } = await privileged.rpc('save_director_commercial_creative_bundle', {
    p_user_id: user.id,
    p_project_id: projectId,
    p_product_bible_id: productBibleId,
    p_style_bible: styleBible,
    p_concept: concept,
    p_source_content_project_id: body.sourceContentProjectId?.trim() ?? '',
    p_source_social_asset_id: body.sourceSocialAssetId?.trim() ?? '',
    p_now: now,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    creative: data,
    productBibleId,
    styleBibleId: styleBible.id,
    conceptId: concept.id,
    authority: concept.authority,
    campaignAuthority: 'NONE',
  }, { status: 201 });
}
