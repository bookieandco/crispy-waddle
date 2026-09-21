import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, isAdminSession } from '@/lib/admin-auth';
import { hotspots } from '@/data/hotspots';
import { rest } from '@/lib/platform';
import {
  validSampleEvidence,
  type SampleEvidence,
} from '@/lib/catalog-certification';

interface MappingInput {
  productId: string;
  variantId: string;
  providerProductId: string;
  providerVariantId: string;
  blueprintId: string;
  printProviderId: string;
  printArea: string;
  baseCostCents?: number;
  certificationStatus: 'sandbox_verified' | 'sample_verified';
  sampleEvidence?: SampleEvidence;
}

export async function POST(request: NextRequest) {
  if (!isAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const input = (await request.json().catch(() => null)) as MappingInput | null;
  const hotspot = input && hotspots.find((item) => item.id === input.productId);
  const variant = hotspot?.fulfillment?.variants.find(
    (item) => item.variantId === input?.variantId
  );
  if (
    !input ||
    !hotspot ||
    !variant ||
    !input.providerProductId ||
    !input.providerVariantId ||
    !input.blueprintId ||
    !input.printProviderId ||
    !input.printArea ||
    !['sandbox_verified', 'sample_verified'].includes(input.certificationStatus) ||
    (input.baseCostCents !== undefined &&
      (!Number.isInteger(input.baseCostCents) || input.baseCostCents < 0))
  ) {
    return NextResponse.json(
      { success: false, error: 'A complete, known product mapping is required.' },
      { status: 400 }
    );
  }

  const existing = await rest<
    Array<{
      id: string;
      provider: string;
      provider_product_id: string;
      provider_variant_id: string;
      blueprint_id: string | null;
      print_provider_id: string | null;
      print_area: string;
      certification_status: string;
      metadata: Record<string, unknown> | null;
    }>
  >(
    `pupson_catalog_variants?select=id,provider,provider_product_id,provider_variant_id,blueprint_id,print_provider_id,print_area,certification_status,metadata&product_id=eq.${encodeURIComponent(input.productId)}&variant_id=eq.${encodeURIComponent(input.variantId)}&limit=1`
  );

  if (input.certificationStatus === 'sample_verified') {
    const prior = existing[0];
    const sameSandboxMapping =
      prior?.provider === 'printify' &&
      ['sandbox_verified', 'sample_verified'].includes(prior.certification_status) &&
      prior.provider_product_id === input.providerProductId &&
      prior.provider_variant_id === input.providerVariantId &&
      String(prior.blueprint_id ?? '') === input.blueprintId &&
      String(prior.print_provider_id ?? '') === input.printProviderId &&
      prior.print_area === input.printArea;
    if (!sameSandboxMapping) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Physical-sample certification requires the exact same mapping to pass sandbox certification first.',
        },
        { status: 409 }
      );
    }
    if (!validSampleEvidence(input.sampleEvidence)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Physical-sample certification requires a received provider order and passing placement, color, material, and damage inspection evidence.',
        },
        { status: 400 }
      );
    }
  }

  const certifiedAt = new Date().toISOString();
  const priorMetadata = existing[0]?.metadata ?? {};
  const metadata = {
    ...priorMetadata,
    certification: {
      status: input.certificationStatus,
      certifiedAt,
      ...(input.certificationStatus === 'sample_verified'
        ? { sampleEvidence: input.sampleEvidence }
        : { sandboxEvidence: { mappingReviewedAt: certifiedAt } }),
    },
  };

  const rows = await rest<Array<{ id: string }>>(
    'pupson_catalog_variants?on_conflict=product_id,variant_id',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        product_id: input.productId,
        variant_id: input.variantId,
        provider: 'printify',
        provider_product_id: input.providerProductId,
        provider_variant_id: input.providerVariantId,
        blueprint_id: input.blueprintId,
        print_provider_id: input.printProviderId,
        print_area: input.printArea,
        retail_price_cents: variant.priceCents,
        base_cost_cents: input.baseCostCents ?? null,
        active: true,
        certification_status: input.certificationStatus,
        certified_at: certifiedAt,
        metadata,
      }),
    }
  );

  return NextResponse.json({
    success: true,
    mappingId: rows[0]?.id,
    certificationStatus: input.certificationStatus,
  });
}
