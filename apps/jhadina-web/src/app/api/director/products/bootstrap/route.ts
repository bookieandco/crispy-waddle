import { NextResponse } from 'next/server';
import {
  planProductReferenceBootstrap,
  validateProductIdentityBible,
  type ProductBootstrapView,
  type ProductIdentityBible,
  type ProductReferenceUpload,
} from '@jhadina/director-core';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { requireDirectorProjectAuthority } from '@/lib/director-project-authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  projectId?: string;
  productId?: string;
  displayName?: string;
  referenceAssetIds?: string[];
  requiredLabelText?: string[];
  immutableTraits?: string[];
  canonicalVariantId?: string;
};

const PRODUCT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const PRODUCT_VIEWS = new Set<ProductBootstrapView>([
  'unknown','hero','front','back','left','right','top','bottom','detail','in-use',
]);

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
  const displayName = body.displayName?.trim() ?? '';
  const referenceAssetIds = [...new Set((body.referenceAssetIds ?? []).map((value) => value.trim()).filter(Boolean))];
  const requiredLabelText = [...new Set((body.requiredLabelText ?? []).map((value) => value.trim()).filter(Boolean))];

  if (!projectId || !productId || !displayName || !referenceAssetIds.length) {
    return NextResponse.json({
      ok: false,
      error: 'projectId, productId, displayName and referenceAssetIds are required',
    }, { status: 400 });
  }
  if (!PRODUCT_ID.test(productId)) {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_PRODUCT_ID_INVALID' }, { status: 400 });
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

  const { data: rows, error: referenceError } = await privileged
    .from('director_reference_media_assets')
    .select('id,project_id,sha256,reference_kind,view_hint,rights_ref,scan_evidence_ids,admission_status,scan_status')
    .eq('project_id', projectId)
    .eq('reference_kind', 'product')
    .in('id', referenceAssetIds);

  if (referenceError) return NextResponse.json({ ok: false, error: referenceError.message }, { status: 500 });
  if ((rows ?? []).length !== referenceAssetIds.length) {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_PRODUCT_REFERENCE_SET_INCOMPLETE' }, { status: 409 });
  }
  if ((rows ?? []).some((row) => row.admission_status !== 'admitted' || row.scan_status !== 'clean')) {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_PRODUCT_REFERENCES_NOT_ADMITTED' }, { status: 409 });
  }

  const byId = new Map((rows ?? []).map((row) => [String(row.id), row]));
  const uploads: ProductReferenceUpload[] = referenceAssetIds.map((id) => {
    const row = byId.get(id)!;
    const rawView = String(row.view_hint) as ProductBootstrapView;
    const view = PRODUCT_VIEWS.has(rawView) ? rawView : 'unknown';
    return {
      id,
      assetId: id,
      sha256: String(row.sha256),
      view,
      rightsRef: String(row.rights_ref),
      evidenceIds: Array.isArray(row.scan_evidence_ids) ? row.scan_evidence_ids.map(String) : [],
    };
  });

  const jobId = `product-bootstrap:${crypto.randomUUID()}`;
  let plan;
  try {
    plan = planProductReferenceBootstrap({
      id: jobId,
      projectId,
      productId,
      displayName,
      uploads,
      requiredLabelText,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'DIRECTOR_PRODUCT_BOOTSTRAP_INVALID' },
      { status: 400 },
    );
  }

  const canonicalUpload = uploads.find((upload) => upload.id === plan.canonicalUploadId) ?? uploads[0]!;
  const canonicalVariantId = body.canonicalVariantId?.trim() || `product-variant:${productId}:base`;
  const immutableTraits = [...new Set([
    ...(body.immutableTraits ?? []).map((value) => value.trim()).filter(Boolean),
    'preserve exact packaging geometry and proportions',
    'preserve canonical logo, colors, typography, and label layout',
    'do not invent or alter product claims',
  ])];

  const referenceViews = uploads.map((upload) => ({
    id: `product-view:${productId}:${upload.id}`,
    assetId: upload.assetId,
    sha256: upload.sha256,
    view: (upload.view === 'unknown' ? 'hero' : upload.view) as Exclude<ProductBootstrapView, 'unknown'>,
    evidenceIds: [...upload.evidenceIds],
  }));

  const productBible: ProductIdentityBible = {
    id: `product-bible:${projectId}:${productId}:v1`,
    projectId,
    productId,
    displayName,
    canonicalVariantId,
    referenceViews,
    labelAuthorities: requiredLabelText.map((text, index) => ({
      id: `product-label:${productId}:${index + 1}`,
      assetId: canonicalUpload.assetId,
      sha256: canonicalUpload.sha256,
      text,
      surface: 'front',
      evidenceIds: [...canonicalUpload.evidenceIds],
    })),
    immutableTraits,
    claimEvidenceIds: [],
    rightsEvidenceIds: [...new Set(uploads.map((upload) => upload.rightsRef))],
  };

  const bibleErrors = validateProductIdentityBible(productBible);
  if (bibleErrors.length) {
    return NextResponse.json({ ok: false, error: `DIRECTOR_PRODUCT_BIBLE_INVALID:${bibleErrors.join(';')}` }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await privileged.rpc('create_director_product_bootstrap_job', {
    p_job_id: jobId,
    p_project_id: projectId,
    p_user_id: user.id,
    p_product_id: productId,
    p_display_name: displayName,
    p_reference_asset_ids: referenceAssetIds,
    p_required_label_text: requiredLabelText,
    p_bootstrap_plan: plan,
    p_product_bible: productBible,
    p_now: now,
  });

  if (error) {
    const status = error.message.includes('duplicate') || error.message.includes('already exists') ? 409 : 500;
    return NextResponse.json({ ok: false, error: error.message }, { status });
  }

  return NextResponse.json({
    ok: true,
    productId,
    productBibleId: productBible.id,
    canonicalVariantId,
    bootstrapPlan: plan,
    bootstrapJob: data,
    status: 'reference_locked',
    next: 'product-aware video generation may start immediately; multi-view/label derivation remains enhancement work',
  }, { status: 201 });
}
