import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, isAdminSession } from '@/lib/admin-auth';
import { hotspots } from '@/data/hotspots';
import { rest } from '@/lib/platform';

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
}

export async function POST(request: NextRequest) {
  if (!isAdminSession(request.cookies.get(ADMIN_COOKIE)?.value))
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
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
        certified_at: new Date().toISOString(),
      }),
    }
  );
  return NextResponse.json({ success: true, mappingId: rows[0]?.id });
}
